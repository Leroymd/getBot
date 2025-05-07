// backend/services/PairScanner.js

const BitgetAPI = require('./BitgetAPI');
const MarketAnalyzer = require('./MarketAnalyzer');
const PairScanResult = require('../api/models/PairScanResult');
const mongoose = require('mongoose');

class PairScanner {
  constructor() {
    this.api = new BitgetAPI();
    this.isScanning = false;
    this.lastScanTime = null;
    this.scanResults = {};
  }

  // Полное сканирование всех пар
  scanAllPairs(options = {}, callback) {
    // Проверяем, идет ли уже сканирование
    if (this.isScanning) {
      return callback(new Error('Scanning is already in progress'));
    }

    this.isScanning = true;
    console.log('Starting comprehensive pair scanning...');

    // Значения по умолчанию для опций
    const defaultOptions = {
      minVolume: 1000000, // Минимальный 24ч объем в USDT
      minLiquidity: 0.5,  // Минимальная ликвидность (0-1)
      minPriceChange: 0,  // Минимальное процентное изменение цены
      maxPairs: 100,      // Макс. количество пар для анализа
      saveToDb: true,     // Сохранять результаты в БД
      sortBy: 'score',    // Сортировка результатов
      filterByBase: [],   // Фильтр по базовой валюте
      excludeStablecoins: false, // Исключать стейблкоины
      timeframes: ['1h', '4h', '1d'], // Таймфреймы для анализа
    };

    const scanOptions = { ...defaultOptions, ...options };
    
    // Получаем все символы с биржи
    this.api.getSymbols((err, symbols) => {
      if (err) {
        this.isScanning = false;
        return callback(new Error('Failed to fetch symbols from exchange: ' + err.message));
      }
      
      if (!symbols || !symbols.data || !Array.isArray(symbols.data)) {
        this.isScanning = false;
        return callback(new Error('Invalid symbols response from exchange'));
      }
      
      console.log(`Retrieved ${symbols.data.length} total symbols from BitGet`);

      // Фильтруем USDT-фьючерсы
      let futuresSymbols = symbols.data
        .filter(item => item && item.symbol && item.symbol.endsWith('USDT'))
        .map(item => ({
          symbol: item.symbol,
          baseCoin: item.baseCoin,
          quoteCoin: item.quoteCoin
        }));
      
      console.log(`Filtered ${futuresSymbols.length} USDT futures pairs`);

      // Применяем фильтр по базовой валюте, если указан
      if (scanOptions.filterByBase.length > 0) {
        futuresSymbols = futuresSymbols.filter(item => 
          scanOptions.filterByBase.includes(item.baseCoin)
        );
        console.log(`Applied base coin filter, remaining pairs: ${futuresSymbols.length}`);
      }

      // Процесс получения тикеров и анализа пар
      this._processPairsBatches(futuresSymbols, scanOptions, (processingErr, results) => {
        this.isScanning = false;
        
        if (processingErr) {
          return callback(processingErr);
        }
        
        // Сортируем результаты
        results.sort((a, b) => b.score - a.score);
        
        this.lastScanTime = new Date();
        this.scanResults = results.reduce((acc, result) => {
          acc[result.symbol] = result;
          return acc;
        }, {});
        
        console.log(`Scan completed at ${this.lastScanTime}, analyzed ${results.length} pairs`);
        
        callback(null, {
          results,
          scanTime: this.lastScanTime,
          totalScanned: results.length
        });
      });
    });
  }

  // Обработка пар пакетами
  _processPairsBatches(symbols, options, callback) {
    const batchSize = 20; // Размер пакета для запросов к API
    let allTickerData = [];
    let processedCount = 0;
    
    // Получаем тикеры для партии пар
    const processBatch = (startIdx) => {
      if (startIdx >= symbols.length) {
        // Все партии обработаны, переходим к фильтрации и анализу
        this._filterAndAnalyzePairs(allTickerData, options, callback);
        return;
      }
      
      const batch = symbols.slice(startIdx, startIdx + batchSize);
      const batchPromises = batch.map(item => {
        return new Promise((resolve) => {
          this.api.getTicker(item.symbol, (tickerErr, ticker) => {
            if (tickerErr || !ticker || !ticker.data || !ticker.data[0]) {
              console.warn(`Error or no data for ${item.symbol}:`, tickerErr ? tickerErr.message : 'No data');
              resolve(null);
            } else {
              resolve({
                ...item,
                ticker: ticker.data[0]
              });
            }
          });
        });
      });
      
      Promise.all(batchPromises)
        .then(batchResults => {
          const validResults = batchResults.filter(item => item !== null);
          allTickerData = allTickerData.concat(validResults);
          
          processedCount += batch.length;
          console.log(`Processed ${processedCount}/${symbols.length} pairs`);
          
          // Небольшая задержка перед следующей партией
          setTimeout(() => processBatch(startIdx + batchSize), 500);
        })
        .catch(error => {
          console.error('Error processing batch:', error);
          callback(error);
        });
    };
    
    // Запускаем обработку первой партии
    processBatch(0);
  }

  // Фильтрация и анализ пар
  _filterAndAnalyzePairs(tickerData, options, callback) {
    // Предварительная фильтрация по объему
    const filteredByVolume = tickerData.filter(item => {
      const volume = parseFloat(item.ticker.baseVolume || 0) * parseFloat(item.ticker.last || 0);
      return volume >= options.minVolume;
    });
    
    console.log(`Filtered to ${filteredByVolume.length} pairs with minimum volume of ${options.minVolume} USDT`);

    // Ограничиваем количество пар для детального анализа
    const pairsToAnalyze = options.maxPairs > 0 
      ? filteredByVolume.slice(0, options.maxPairs) 
      : filteredByVolume;
    
    // Создаем конфигурацию для анализатора рынка
    const analyzerConfig = {
      autoSwitching: {
        volatilityThreshold: 1.5,
        volumeThreshold: 2.0,
        trendStrengthThreshold: 0.6
      }
    };

    // Результаты для всех пар
    const results = [];
    let analyzedCount = 0;
    
    // Функция для анализа одной пары
    const analyzePair = (index) => {
      if (index >= pairsToAnalyze.length) {
        // Все пары проанализированы, возвращаем результаты
        callback(null, results);
        return;
      }
      
      const pair = pairsToAnalyze[index];
      console.log(`Analyzing ${pair.symbol}... (${index + 1}/${pairsToAnalyze.length})`);
      
      const analyzer = new MarketAnalyzer(pair.symbol, analyzerConfig, this.api);
      
      // Анализ на различных таймфреймах
      this._analyzeMultipleTimeframes(analyzer, options.timeframes, (tfErr, timeframeResults) => {
        if (tfErr) {
          console.error(`Error analyzing timeframes for ${pair.symbol}:`, tfErr.message);
          // Продолжаем со следующей парой даже при ошибке
          setTimeout(() => analyzePair(index + 1), 100);
          return;
        }
        
        try {
          // Рассчитываем средние показатели по всем таймфреймам
          let cumulativeScore = 0;
          let avgVolatility = 0;
          let avgTrendStrength = 0;
          
          for (const tf of options.timeframes) {
            const tfResult = timeframeResults[tf];
            if (!tfResult) continue;
            
            // Вычисляем суммарный скор на основе разных таймфреймов
            const timeframeWeight = 
              tf === '1d' ? 0.5 : 
              tf === '4h' ? 0.3 : 
              0.2; // для 1h
            
            cumulativeScore += tfResult.confidence * timeframeWeight;
            avgVolatility += tfResult.volatility || 0;
            avgTrendStrength += tfResult.trendStrength || 0;
          }
          
          // Расчет средних значений
          avgVolatility /= options.timeframes.length;
          avgTrendStrength /= options.timeframes.length;
          
          // Определяем рекомендуемую стратегию по наибольшему таймфрейму
          const recommendedStrategy = timeframeResults['1d']?.recommendedStrategy || 'DCA';
          
          // Дополнительные метрики
          const priceChange24h = parseFloat(pair.ticker.change24h || 0) * 100;
          const volume24h = parseFloat(pair.ticker.baseVolume || 0) * parseFloat(pair.ticker.last || 0);
          
          // Оценка ликвидности на основе спреда
          const high = parseFloat(pair.ticker.high24h || 0);
          const low = parseFloat(pair.ticker.low24h || 0);
          const last = parseFloat(pair.ticker.last || 0);
          const spread = high > 0 ? (high - low) / high * 100 : 0;
          
          // Рейтинг пары (оценка от 0 до 100)
          const pairScore = Math.min(100, Math.max(0, 
            cumulativeScore * 30 + // Оценка из анализа рынка (0-30)
            Math.min(50, volume24h / 10000000 * 30) + // Объем (0-30)
            Math.min(20, Math.abs(priceChange24h) / 5 * 20) + // Изменение цены (0-20)
            Math.max(0, 20 - spread) // Ликвидность (0-20)
          ));
          
          // Добавляем результат
          const result = {
            symbol: pair.symbol,
            baseCoin: pair.baseCoin,
            quoteCoin: pair.quoteCoin,
            price: last,
            priceChange24h,
            volume24h,
            spread,
            volatility: avgVolatility,
            trendStrength: avgTrendStrength,
            marketType: timeframeResults['1d']?.marketType || 'UNKNOWN',
            recommendedStrategy,
            score: pairScore,
            timeframes: timeframeResults,
            lastPrice: last,
            highPrice24h: high,
            lowPrice24h: low,
            scanTime: new Date()
          };
          
          results.push(result);
          this.scanResults[pair.symbol] = result;
          
          console.log(`Completed analysis of ${pair.symbol}, score: ${pairScore.toFixed(2)}`);
          
          // Сохраняем в базу данных, если опция включена
          if (options.saveToDb) {
            this._saveScanResult(result);
          }
          
          // Переходим к следующей паре
          setTimeout(() => analyzePair(index + 1), 100);
        } catch (analysisError) {
          console.error(`Error processing analysis for ${pair.symbol}:`, analysisError);
          // Продолжаем со следующей парой
          setTimeout(() => analyzePair(index + 1), 100);
        }
      });
    };
    
    // Начинаем анализ с первой пары
    analyzePair(0);
  }

  // Анализ пары на нескольких таймфреймах
  _analyzeMultipleTimeframes(analyzer, timeframes, callback) {
    const results = {};
    let completedCount = 0;
    
    for (const tf of timeframes) {
      analyzer.analyzeMarketConditions(tf, (err, result) => {
        if (!err && result) {
          results[tf] = result;
        }
        
        completedCount++;
        if (completedCount === timeframes.length) {
          callback(null, results);
        }
      });
    }
    
    // Если нет таймфреймов, вернуть пустой результат
    if (timeframes.length === 0) {
      callback(null, {});
    }
  }

  // Сохранение результата сканирования в базу данных
  _saveScanResult(result) {
    // Оборачиваем в try-catch, чтобы ошибки БД не влияли на основной процесс
    try {
      PairScanResult.findOne({ symbol: result.symbol }, (findErr, scanRecord) => {
        if (findErr) {
          console.error(`Error finding scan record for ${result.symbol}:`, findErr);
          return;
        }
        
        if (scanRecord) {
          // Обновляем существующую запись
          scanRecord.price = result.price;
          scanRecord.priceChange24h = result.priceChange24h;
          scanRecord.volume24h = result.volume24h;
          scanRecord.spread = result.spread;
          scanRecord.volatility = result.volatility;
          scanRecord.trendStrength = result.trendStrength;
          scanRecord.marketType = result.marketType;
          scanRecord.recommendedStrategy = result.recommendedStrategy;
          scanRecord.score = result.score;
          scanRecord.lastScanTime = new Date();
          
          // Добавляем исторические данные
          scanRecord.history.push({
            timestamp: new Date(),
            price: result.price,
            volume: result.volume24h,
            volatility: result.volatility,
            score: result.score,
            recommendedStrategy: result.recommendedStrategy
          });
          
          // Ограничиваем историю до 30 записей
          if (scanRecord.history.length > 30) {
            scanRecord.history = scanRecord.history.slice(-30);
          }
          
          scanRecord.save((saveErr) => {
            if (saveErr) {
              console.error(`Error saving scan record for ${result.symbol}:`, saveErr);
            }
          });
        } else {
          // Создаем новую запись
          const newRecord = new PairScanResult({
            symbol: result.symbol,
            baseCoin: result.baseCoin,
            quoteCoin: result.quoteCoin,
            price: result.price,
            priceChange24h: result.priceChange24h,
            volume24h: result.volume24h,
            spread: result.spread,
            volatility: result.volatility,
            trendStrength: result.trendStrength,
            marketType: result.marketType,
            recommendedStrategy: result.recommendedStrategy,
            score: result.score,
            firstScanTime: new Date(),
            lastScanTime: new Date(),
            history: [{
              timestamp: new Date(),
              price: result.price,
              volume: result.volume24h,
              volatility: result.volatility,
              score: result.score,
              recommendedStrategy: result.recommendedStrategy
            }]
          });
          
          newRecord.save((saveErr) => {
            if (saveErr) {
              console.error(`Error creating scan record for ${result.symbol}:`, saveErr);
            }
          });
        }
      });
    } catch (dbError) {
      console.error(`Database error for ${result.symbol}:`, dbError);
    }
  }

  // Получение предыдущих результатов сканирования
  getLastScanResults(filters = {}, callback) {
    // Если есть кэшированные результаты и фильтры не указаны, возвращаем их
    if (Object.keys(this.scanResults).length > 0 && Object.keys(filters).length === 0) {
      const results = Object.values(this.scanResults);
      results.sort((a, b) => b.score - a.score);
      return callback(null, {
        results,
        scanTime: this.lastScanTime,
        totalScanned: results.length,
        fromCache: true
      });
    }

    // Иначе запрашиваем из базы данных
    try {
      const query = {};
      
      // Применяем фильтры
      if (filters.minScore) {
        query.score = { $gte: filters.minScore };
      }
      
      if (filters.minVolume) {
        query.volume24h = { $gte: filters.volume24h };
      }
      
      if (filters.strategy) {
        query.recommendedStrategy = filters.strategy;
      }
      
      if (filters.marketType) {
        query.marketType = filters.marketType;
      }
      
      if (filters.baseCoin) {
        query.baseCoin = filters.baseCoin;
      }
      
      // Запрашиваем с сортировкой по скору
      PairScanResult.find(query)
        .sort({ score: -1 })
        .limit(filters.limit || 100)
        .exec((err, results) => {
          if (err) {
            return callback(err);
          }
          
          callback(null, {
            results,
            scanTime: results.length > 0 ? results[0].lastScanTime : null,
            totalScanned: results.length,
            fromCache: false
          });
        });
    } catch (error) {
      callback(error);
    }
  }
}

module.exports = PairScanner;
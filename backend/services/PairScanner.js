// backend/services/PairScanner.js - исправленная версия

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
    this.scanningTimeout = 5 * 60 * 1000; // 5 минут, после которых считаем сканирование зависшим
  }

  // Полное сканирование всех пар - только при явном вызове пользователем
  scanAllPairs(options = {}, callback) {
    // Проверяем, идет ли уже сканирование
    if (this.isScanning) {
      // Если сканирование идет слишком долго, сбрасываем флаг
      if (this.lastScanTime && Date.now() - this.lastScanTime > this.scanningTimeout) {
        console.warn('Предыдущее сканирование зависло, сбрасываем состояние сканирования');
        this.isScanning = false;
      } else {
        return callback(new Error('Сканирование уже выполняется'));
      }
    }

    // Устанавливаем флаг сканирования и время начала
    this.isScanning = true;
    this.lastScanTime = Date.now();
    console.log('Запуск полного сканирования пар...');

    try {
      // Значения по умолчанию для опций
      const defaultOptions = {
        minVolume: 10000, // Значительно снижен минимальный 24ч объем в USDT
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
      this.api.getSymbols((err, symbolsResponse) => {
        if (err) {
          this.isScanning = false; // Сбрасываем флаг при ошибке
          return callback(new Error('Не удалось получить символы с биржи: ' + err.message));
        }
        
        if (!symbolsResponse || !symbolsResponse.data || !Array.isArray(symbolsResponse.data)) {
          this.isScanning = false; // Сбрасываем флаг при ошибке
          return callback(new Error('Некорректный ответ с биржи при получении символов'));
        }
        
        console.log(`Получено ${symbolsResponse.data.length} символов с BitGet`);
        console.log('Пример данных символа:', JSON.stringify(symbolsResponse.data[0]));

        // Фильтруем USDT-фьючерсы
        let futuresSymbols = symbolsResponse.data
          .filter(item => item && item.symbol && item.symbol.includes('USDT'))
          .map(item => ({
            symbol: item.symbol,
            baseCoin: item.baseCoin || item.symbol.replace('USDT', ''),
            quoteCoin: item.quoteCoin || 'USDT'
          }));
        
        console.log(`Отфильтровано ${futuresSymbols.length} USDT фьючерсных пар`);

        // Применяем фильтр по базовой валюте, если указан
        if (scanOptions.filterByBase && scanOptions.filterByBase.length > 0) {
          futuresSymbols = futuresSymbols.filter(item => 
            scanOptions.filterByBase.includes(item.baseCoin)
          );
          console.log(`Применен фильтр по базовым валютам, осталось пар: ${futuresSymbols.length}`);
        }

        // Процесс получения тикеров и анализа пар
        this._processPairsBatches(futuresSymbols, scanOptions, (processingErr, results) => {
          this.isScanning = false; // Сбрасываем флаг независимо от результата
          
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
          
          console.log(`Сканирование завершено в ${this.lastScanTime}, проанализировано ${results.length} пар`);
          
          callback(null, {
            results,
            scanTime: this.lastScanTime,
            totalScanned: results.length
          });
        });
      });
    } catch (error) {
      // Сбрасываем флаг при любой непредвиденной ошибке
      this.isScanning = false;
      console.error('Непредвиденная ошибка в scanAllPairs:', error);
      callback(error);
    }
  }
  
  // Новый метод: сканирование только активных пар (те, для которых запущены боты)
  scanActivePairs(activeBots = {}, options = {}, callback) {
    if (!activeBots || Object.keys(activeBots).length === 0) {
      return callback(null, {
        results: [],
        scanTime: new Date(),
        totalScanned: 0,
        message: 'Нет активных ботов для сканирования'
      });
    }
    
    // Получаем список символов активных ботов
    const activeSymbols = Object.keys(activeBots);
    console.log(`Сканирование только активных пар: ${activeSymbols.join(', ')}`);
    
    // Если сканирование уже идет - просто возвращаем последние результаты для активных пар
    if (this.isScanning) {
      const activePairsResults = activeSymbols
        .filter(symbol => this.scanResults[symbol])
        .map(symbol => this.scanResults[symbol]);
      
      return callback(null, {
        results: activePairsResults,
        scanTime: this.lastScanTime || new Date(),
        totalScanned: activePairsResults.length,
        fromCache: true,
        message: 'Возвращены кэшированные результаты, так как сканирование уже выполняется'
      });
    }
    
    // Устанавливаем флаг сканирования
    this.isScanning = true;
    this.lastScanTime = Date.now();
    
    // Подготавливаем список пар в формате, подходящем для обработки
    const pairsToScan = activeSymbols.map(symbol => {
      // Извлекаем базовую валюту из символа (например, из BTCUSDT получаем BTC)
      const baseCoin = symbol.replace('USDT', '');
      return {
        symbol,
        baseCoin,
        quoteCoin: 'USDT'
      };
    });
    
    // Значения по умолчанию для опций
    const defaultOptions = {
      saveToDb: true,     // Сохранять результаты в БД
      timeframes: ['1h', '4h', '1d'], // Таймфреймы для анализа
    };

    const scanOptions = { ...defaultOptions, ...options };
    
    // Обрабатываем только выбранные пары
    this._processPairsBatches(pairsToScan, scanOptions, (processingErr, results) => {
      this.isScanning = false; // Сбрасываем флаг независимо от результата
      
      if (processingErr) {
        return callback(processingErr);
      }
      
      this.lastScanTime = new Date();
      
      // Обновляем кэш только для активных пар
      results.forEach(result => {
        this.scanResults[result.symbol] = result;
      });
      
      console.log(`Сканирование активных пар завершено в ${this.lastScanTime}, проанализировано ${results.length} пар`);
      
      callback(null, {
        results,
        scanTime: this.lastScanTime,
        totalScanned: results.length
      });
    });
  }

  // Обработка пар пакетами
  _processPairsBatches(symbols, options, callback) {
    const batchSize = 5; // Меньший размер пакета для стабильности
    let allTickerData = [];
    let processedCount = 0;
    
    // Получаем тикеры для партии пар
    const processBatch = (startIdx) => {
      if (startIdx >= symbols.length) {
        // Все партии обработаны, переходим к фильтрации и анализу
        this._filterAndAnalyzePairs(allTickerData, options, (err, results) => {
          // Убедимся, что флаг сканирования сбрасывается даже при ошибке анализа
          if (err) {
            this.isScanning = false;
            return callback(err);
          }
          callback(null, results);
        });
        return;
      }
      
      const batch = symbols.slice(startIdx, startIdx + batchSize);
      const batchPromises = batch.map(item => {
        return new Promise((resolve) => {
          this.api.getTicker(item.symbol, (tickerErr, ticker) => {
            if (tickerErr) {
              console.warn(`Ошибка получения тикера для ${item.symbol}:`, tickerErr.message);
              resolve(null);
              return;
            }
            
            if (!ticker || !ticker.data) {
              console.warn(`Нет данных тикера для ${item.symbol}`);
              resolve(null);
              return;
            }
            
            console.log(`Получен тикер для ${item.symbol}:`, JSON.stringify(ticker.data).substring(0, 200));
            
            // Проверяем структуру данных и наличие необходимых полей
            if (Array.isArray(ticker.data) && ticker.data.length > 0) {
              resolve({
                ...item,
                ticker: ticker.data[0]
              });
            } else if (typeof ticker.data === 'object' && ticker.data !== null) {
              // Альтернативный формат данных
              resolve({
                ...item,
                ticker: ticker.data
              });
            } else {
              console.warn(`Некорректный формат данных тикера для ${item.symbol}`);
              resolve(null);
            }
          });
        });
      });
      
      Promise.all(batchPromises)
        .then(batchResults => {
          const validResults = batchResults.filter(item => item !== null);
          console.log(`Обработан пакет: ${validResults.length}/${batch.length} валидных результатов`);
          allTickerData = allTickerData.concat(validResults);
          
          processedCount += batch.length;
          console.log(`Обработано ${processedCount}/${symbols.length} пар`);
          
          // Небольшая задержка перед следующей партией
          setTimeout(() => processBatch(startIdx + batchSize), 1000);
        })
        .catch(error => {
          console.error('Ошибка обработки пакета:', error);
          this.isScanning = false; // Сбрасываем флаг при ошибке обработки партии
          callback(error);
        });
    };
    
    // Запускаем обработку первой партии
    processBatch(0);
  }

  // Фильтрация и анализ пар
  _filterAndAnalyzePairs(tickerData, options, callback) {
    console.log(`Начало фильтрации и анализа ${tickerData.length} пар`);
    
    // Предварительная фильтрация по объему с гибким подходом
    const filteredByVolume = [];
    let minVolumeThreshold = options.minVolume || 10000;
    
    for (const item of tickerData) {
      try {
        // Пытаемся извлечь объем разными способами
        let volume = 0;
        
        if (item.ticker) {
          // Проверяем разные возможные поля для объема
          if (item.ticker.baseVolume && item.ticker.last) {
            // Вариант 1: baseVolume * last
            volume = parseFloat(item.ticker.baseVolume || 0) * parseFloat(item.ticker.last || 0);
          } else if (item.ticker.volume24h) {
            // Вариант 2: Прямое поле volume24h
            volume = parseFloat(item.ticker.volume24h || 0);
          } else if (item.ticker.vol || item.ticker.volume) {
            // Вариант 3: Поле vol или volume
            volume = parseFloat(item.ticker.vol || item.ticker.volume || 0);
          } else if (item.ticker.quoteVolume) {
            // Вариант 4: quoteVolume
            volume = parseFloat(item.ticker.quoteVolume || 0);
          }
        }
        
        // Проверяем объем против порога
        if (volume >= minVolumeThreshold) {
          filteredByVolume.push({
            ...item,
            calculatedVolume: volume
          });
        }
      } catch (error) {
        console.error(`Ошибка обработки объема для ${item.symbol}:`, error);
      }
    }
    
    console.log(`Предварительный фильтр объема: ${filteredByVolume.length} пар прошли с минимальным объемом ${minVolumeThreshold} USDT`);
    
    // Если ничего не прошло фильтр, пробуем снизить порог
    if (filteredByVolume.length === 0 && minVolumeThreshold > 1000) {
      console.log(`Ни одна пара не прошла предварительный фильтр объема, снижаем порог и пробуем снова...`);
      minVolumeThreshold = 1000; // Очень низкий порог
      
      for (const item of tickerData) {
        try {
          // Повторяем логику извлечения объема
          let volume = 0;
          
          if (item.ticker) {
            if (item.ticker.baseVolume && item.ticker.last) {
              volume = parseFloat(item.ticker.baseVolume || 0) * parseFloat(item.ticker.last || 0);
            } else if (item.ticker.volume24h) {
              volume = parseFloat(item.ticker.volume24h || 0);
            } else if (item.ticker.vol || item.ticker.volume) {
              volume = parseFloat(item.ticker.vol || item.ticker.volume || 0);
            } else if (item.ticker.quoteVolume) {
              volume = parseFloat(item.ticker.quoteVolume || 0);
            }
          }
          
          if (volume >= minVolumeThreshold) {
            filteredByVolume.push({
              ...item,
              calculatedVolume: volume
            });
          }
        } catch (error) {
          console.error(`Ошибка обработки объема (2-я попытка) для ${item.symbol}:`, error);
        }
      }
      
      console.log(`После снижения порога до ${minVolumeThreshold}: ${filteredByVolume.length} пар прошли фильтрацию`);
    }
    
    // Если все еще нет результатов, просто берем первые N пар без фильтрации
    if (filteredByVolume.length === 0 && tickerData.length > 0) {
      console.log(`Нет доступных пар даже с очень низким порогом объема, берем первые ${Math.min(20, tickerData.length)} пар без фильтрации объема`);
      const topPairs = tickerData.slice(0, Math.min(20, tickerData.length));
      
      for (const item of topPairs) {
        filteredByVolume.push({
          ...item,
          calculatedVolume: 1000 // Просто задаем минимальное значение
        });
      }
    }

    // Если запрошены только определенные символы (для активных ботов), 
    // не ограничиваем количество пар для анализа
    const pairsToAnalyze = options.maxPairs > 0 && filteredByVolume.length > options.maxPairs
      ? filteredByVolume.slice(0, options.maxPairs) 
      : filteredByVolume;
    
    console.log(`Выбрано ${pairsToAnalyze.length} пар для детального анализа`);
    
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
    
    // Функция для анализа одной пары
    const analyzePair = (index) => {
      if (index >= pairsToAnalyze.length) {
        // Все пары проанализированы, возвращаем результаты
        callback(null, results);
        return;
      }
      
      const pair = pairsToAnalyze[index];
      console.log(`Анализируем ${pair.symbol}... (${index + 1}/${pairsToAnalyze.length})`);
      
      try {
        const analyzer = new MarketAnalyzer(pair.symbol, analyzerConfig, this.api);
        
        // Анализ на различных таймфреймах
        this._analyzeMultipleTimeframes(analyzer, options.timeframes, (tfErr, timeframeResults) => {
          if (tfErr) {
            console.error(`Ошибка анализа таймфреймов для ${pair.symbol}:`, tfErr.message);
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
            const validTimeframes = Object.keys(timeframeResults).length;
            avgVolatility = validTimeframes > 0 ? avgVolatility / validTimeframes : 0;
            avgTrendStrength = validTimeframes > 0 ? avgTrendStrength / validTimeframes : 0;
            
            // Определяем рекомендуемую стратегию по наибольшему таймфрейму
            const recommendedStrategy = 
              timeframeResults['1d']?.recommendedStrategy || 
              timeframeResults['4h']?.recommendedStrategy || 
              timeframeResults['1h']?.recommendedStrategy || 
              'DCA';
            
            // Получаем значение цены из тикера разными способами
            let lastPrice = 0;
            let highPrice = 0;
            let lowPrice = 0;
            let priceChange24h = 0;
            let volume24h = pair.calculatedVolume || 0;
            
            if (pair.ticker) {
              // Извлекаем цену из разных возможных полей
              lastPrice = parseFloat(pair.ticker.last || pair.ticker.lastPr || pair.ticker.close || 0);
              highPrice = parseFloat(pair.ticker.high24h || pair.ticker.high || 0);
              lowPrice = parseFloat(pair.ticker.low24h || pair.ticker.low || 0);
              
              // Извлекаем изменение цены из разных возможных полей
              if (pair.ticker.change24h !== undefined) {
                priceChange24h = parseFloat(pair.ticker.change24h || 0) * 100; // Преобразуем в проценты
              } else if (pair.ticker.priceChangePercent !== undefined) {
                priceChange24h = parseFloat(pair.ticker.priceChangePercent || 0);
              } else if (pair.ticker.open24h !== undefined && lastPrice > 0) {
                const open24h = parseFloat(pair.ticker.open24h || 0);
                priceChange24h = open24h > 0 ? ((lastPrice - open24h) / open24h) * 100 : 0;
              }
            }
            
            // Оценка ликвидности на основе спреда
            let spread = 0;
            if (highPrice > 0 && lowPrice > 0) {
              spread = ((highPrice - lowPrice) / highPrice) * 100;
            }
            
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
              price: lastPrice,
              priceChange24h,
              volume24h,
              spread,
              volatility: avgVolatility,
              trendStrength: avgTrendStrength,
              marketType: timeframeResults['1d']?.marketType || 'UNKNOWN',
              recommendedStrategy,
              score: pairScore,
              timeframes: timeframeResults,
              lastPrice,
              highPrice24h: highPrice,
              lowPrice24h: lowPrice,
              scanTime: new Date()
            };
            
            results.push(result);
            this.scanResults[pair.symbol] = result;
            
            console.log(`Завершен анализ ${pair.symbol}, скор: ${pairScore.toFixed(2)}`);
            
            // Сохраняем в базу данных, если опция включена
            if (options.saveToDb) {
              this._saveScanResult(result);
            }
            
            // Добавляем небольшую задержку между обработкой пар
            setTimeout(() => analyzePair(index + 1), 300);
          } catch (analysisError) {
            console.error(`Ошибка обработки анализа для ${pair.symbol}:`, analysisError);
            // Продолжаем со следующей парой
            setTimeout(() => analyzePair(index + 1), 300);
          }
        });
      } catch (analyzerError) {
        console.error(`Ошибка создания анализатора для ${pair.symbol}:`, analyzerError);
        // Продолжаем со следующей парой
        setTimeout(() => analyzePair(index + 1), 300);
      }
    };
    
    // Начинаем анализ с первой пары
    if (pairsToAnalyze.length > 0) {
      analyzePair(0);
    } else {
      console.log('Нет пар для анализа');
      callback(null, []);
    }
  }

  // Анализ пары на нескольких таймфреймах
  _analyzeMultipleTimeframes(analyzer, timeframes, callback) {
    const results = {};
    let completedCount = 0;
    
    if (!timeframes || timeframes.length === 0) {
      callback(null, {});
      return;
    }
    
    for (const tf of timeframes) {
      try {
        analyzer.analyzeMarketConditions(tf, (err, result) => {
          if (!err && result) {
            results[tf] = result;
          } else if (err) {
            console.warn(`Ошибка анализа ${analyzer.symbol} на таймфрейме ${tf}:`, err.message);
          }
          
          completedCount++;
          if (completedCount === timeframes.length) {
            callback(null, results);
          }
        });
      } catch (analyzerError) {
        console.error(`Исключение в анализаторе для ${analyzer.symbol} на таймфрейме ${tf}:`, analyzerError);
        completedCount++;
        if (completedCount === timeframes.length) {
          callback(null, results);
        }
      }
    }
  }

  // Сохранение результата сканирования в базу данных
  _saveScanResult(result) {
    // Оборачиваем в try-catch, чтобы ошибки БД не влияли на основной процесс
    try {
      // Проверяем подключение к БД
      if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        console.warn('Соединение с базой данных недоступно, пропускаем сохранение');
        return;
      }
      
      PairScanResult.findOne({ symbol: result.symbol })
        .then(scanRecord => {
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
            
            return scanRecord.save();
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
            
            return newRecord.save();
          }
        })
        .catch(err => {
          console.error(`Ошибка сохранения/обновления записи сканирования для ${result.symbol}:`, err);
        });
    } catch (dbError) {
      console.error(`Ошибка базы данных для ${result.symbol}:`, dbError);
    }
  }

  // Получение предыдущих результатов сканирования с использованием async/await
  async getLastScanResults(filters = {}, callback) {
    try {
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
        // Проверяем подключение к БД
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
          console.warn('Соединение с базой данных недоступно, возвращаем пустые результаты');
          return callback(null, {
            results: [],
            scanTime: null,
            totalScanned: 0,
            fromCache: false
          });
        }
        
        const query = {};
        
        // Применяем фильтры
        if (filters.minScore) {
          query.score = { $gte: filters.minScore };
        }
        
        if (filters.minVolume) {
          query.volume24h = { $gte: filters.minVolume };
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
        
        // Фильтр по конкретным символам (для активных ботов)
        if (filters.symbols && Array.isArray(filters.symbols) && filters.symbols.length > 0) {
          query.symbol = { $in: filters.symbols };
        }

        // Используем async/await вместо callback
        const results = await PairScanResult.find(query)
          .sort({ score: -1 })
          .limit(filters.limit || 100);
        
        callback(null, {
          results,
          scanTime: results.length > 0 ? results[0].lastScanTime : null,
          totalScanned: results.length,
          fromCache: false
        });
      } catch (error) {
        callback(error);
      }
    } catch (error) {
      callback(error);
    }
  }
}

module.exports = PairScanner;
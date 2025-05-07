// backend/services/CorrelationAnalyzer.js

const BitgetAPI = require('./BitgetAPI');

class CorrelationAnalyzer {
  constructor() {
    this.api = new BitgetAPI();
    this.referenceSymbols = ['BTCUSDT', 'ETHUSDT'];
    this.correlationCache = new Map();
    this.lastUpdateTime = null;
    this.correlationThreshold = 0.7; // Порог для сильной корреляции
  }

  // Расчет корреляции Пирсона между двумя наборами данных
  calculateCorrelation(dataset1, dataset2) {
    if (!dataset1 || !dataset2 || dataset1.length !== dataset2.length || dataset1.length < 3) {
      return 0;
    }
    
    const n = dataset1.length;
    
    // Рассчитываем суммы и квадраты сумм
    let sum1 = 0;
    let sum2 = 0;
    let sum1Sq = 0;
    let sum2Sq = 0;
    let pSum = 0;
    
    for (let i = 0; i < n; i++) {
      sum1 += dataset1[i];
      sum2 += dataset2[i];
      sum1Sq += dataset1[i] ** 2;
      sum2Sq += dataset2[i] ** 2;
      pSum += dataset1[i] * dataset2[i];
    }
    
    // Рассчитываем коэффициент корреляции Пирсона
    const num = pSum - (sum1 * sum2 / n);
    const den = Math.sqrt((sum1Sq - sum1 ** 2 / n) * (sum2Sq - sum2 ** 2 / n));
    
    if (den === 0) return 0;
    
    return num / den;
  }

  // Получение исторических данных цен для символа
  getHistoricalPrices(symbol, timeframe = '1h', limit = 100, callback) {
    this.api.getKlines(symbol, timeframe, limit, (err, klines) => {
      if (err) {
        console.error(`Error fetching historical prices for ${symbol}:`, err);
        return callback(err, []);
      }
      
      if (!klines || !klines.data || !Array.isArray(klines.data)) {
        console.warn(`No valid data for ${symbol}`);
        return callback(null, []);
      }
      
      // Извлекаем цены закрытия
      try {
        const prices = klines.data.map(candle => parseFloat(candle[4]));
        callback(null, prices);
      } catch (parseError) {
        console.error(`Error parsing prices for ${symbol}:`, parseError);
        callback(parseError, []);
      }
    });
  }

  // Расчет относительных изменений цены
  calculatePriceChanges(prices) {
    if (!prices || prices.length < 2) return [];
    
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      const change = (prices[i] - prices[i-1]) / prices[i-1];
      changes.push(change);
    }
    
    return changes;
  }

  // Анализ корреляции между символом и эталонными валютами
  analyzeCorrelation(symbol, timeframe = '1h', limit = 100, callback) {
    // Проверяем кэш
    const cacheKey = `${symbol}-${timeframe}-${limit}`;
    const cacheTimeout = 30 * 60 * 1000; // 30 минут
    
    if (this.correlationCache.has(cacheKey) && 
        Date.now() - this.correlationCache.get(cacheKey).timestamp < cacheTimeout) {
      console.log(`Using cached correlation for ${symbol}`);
      return callback(null, this.correlationCache.get(cacheKey).data);
    }
    
    console.log(`Analyzing correlation for ${symbol}`);
    
    // Получаем исторические данные для целевого символа
    this.getHistoricalPrices(symbol, timeframe, limit, (err, targetPrices) => {
      if (err) {
        return callback(err);
      }
      
      if (targetPrices.length < limit * 0.9) {
        console.warn(`Insufficient historical data for ${symbol}`);
        return callback(null, {
          symbol,
          correlations: this.referenceSymbols.map(ref => ({ symbol: ref, correlation: 0 })),
          leadLagRelationships: [],
          averageCorrelation: 0,
          strongestCorrelation: { symbol: '', correlation: 0 }
        });
      }
      
      // Рассчитываем изменения цен
      const targetChanges = this.calculatePriceChanges(targetPrices);
      
      // Анализируем корреляцию с каждой эталонной валютой
      const correlations = [];
      let processedCount = 0;
      
      // Обработка одной эталонной валюты
      const processReferenceSymbol = (index) => {
        if (index >= this.referenceSymbols.length) {
          // Все эталонные валюты обработаны, формируем результат
          finishAnalysis();
          return;
        }
        
        const refSymbol = this.referenceSymbols[index];
        this.getHistoricalPrices(refSymbol, timeframe, limit, (refErr, refPrices) => {
          if (refErr || refPrices.length < limit * 0.9) {
            console.warn(`Insufficient historical data for reference ${refSymbol}`);
            correlations.push({ symbol: refSymbol, correlation: 0, leadLag: 0 });
            processReferenceSymbol(index + 1);
            return;
          }
          
          try {
            const refChanges = this.calculatePriceChanges(refPrices);
            
            // Обеспечиваем, что массивы изменений имеют одинаковую длину
            const minLength = Math.min(targetChanges.length, refChanges.length);
            const targetSlice = targetChanges.slice(0, minLength);
            const refSlice = refChanges.slice(0, minLength);
            
            // Рассчитываем корреляцию
            const correlation = this.calculateCorrelation(targetSlice, refSlice);
            
            // Анализируем опережающе-запаздывающие отношения
            this.analyzeLaggedCorrelation(
              targetSlice, refSlice, refSymbol, timeframe, (lagErr, leadLagRelationship) => {
                if (lagErr) {
                  console.warn(`Error analyzing lead-lag relationship for ${symbol} and ${refSymbol}:`, lagErr);
                  leadLagRelationship = { lag: 0, correlation: 0 };
                }
                
                correlations.push({
                  symbol: refSymbol,
                  correlation,
                  leadLag: leadLagRelationship.lag,
                  leadLagCorrelation: leadLagRelationship.correlation
                });
                
                // Переходим к следующей эталонной валюте
                processReferenceSymbol(index + 1);
              }
            );
          } catch (calcError) {
            console.error(`Error calculating correlation for ${symbol} and ${refSymbol}:`, calcError);
            correlations.push({ symbol: refSymbol, correlation: 0, leadLag: 0 });
            processReferenceSymbol(index + 1);
          }
        });
      };
      
      // Завершение анализа и формирование результата
      const finishAnalysis = () => {
        try {
          // Находим среднюю и максимальную корреляцию
          const validCorrelations = correlations.filter(c => Math.abs(c.correlation) > 0);
          const averageCorrelation = validCorrelations.length > 0
            ? validCorrelations.reduce((sum, c) => sum + Math.abs(c.correlation), 0) / validCorrelations.length
            : 0;
          
          // Находим самую сильную корреляцию
          const strongestCorrelation = validCorrelations.reduce(
            (strongest, current) => Math.abs(current.correlation) > Math.abs(strongest.correlation) ? current : strongest,
            { symbol: '', correlation: 0 }
          );
          
          // Анализируем корреляцию с основными индексами рынка
          const marketIndices = this.analyzeMarketIndices(targetChanges);
          
          // Формируем результат
          const result = {
            symbol,
            correlations,
            leadLagRelationships: correlations.filter(c => Math.abs(c.leadLagCorrelation) > this.correlationThreshold),
            averageCorrelation,
            strongestCorrelation,
            marketIndices
          };
          
          // Сохраняем результаты в кэш
          this.correlationCache.set(cacheKey, {
            timestamp: Date.now(),
            data: result
          });
          
          callback(null, result);
        } catch (finalError) {
          callback(finalError);
        }
      };
      
      // Начинаем обработку с первой эталонной валюты
      processReferenceSymbol(0);
    });
  }

  // Анализ опережающе-запаздывающих отношений
  analyzeLaggedCorrelation(targetChanges, refChanges, refSymbol, timeframe, callback) {
    try {
      const maxLag = 12; // Максимальное смещение (в зависимости от таймфрейма)
      const results = [];
      
      // Проверяем различные смещения
      for (let lag = -maxLag; lag <= maxLag; lag++) {
        if (lag === 0) continue; // Пропускаем нулевое смещение, оно уже учтено в основной корреляции
        
        let lagged1, lagged2;
        let offset = Math.abs(lag);
        
        if (lag < 0) {
          // Целевой актив опережает эталонный
          lagged1 = targetChanges.slice(0, -offset);
          lagged2 = refChanges.slice(offset);
        } else {
          // Целевой актив запаздывает за эталонным
          lagged1 = targetChanges.slice(offset);
          lagged2 = refChanges.slice(0, -offset);
        }
        
        const correlation = this.calculateCorrelation(lagged1, lagged2);
        results.push({ lag, correlation });
      }
      
      // Находим смещение с наибольшей корреляцией
      results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
      
      callback(null, results.length > 0 ? results[0] : { lag: 0, correlation: 0 });
    } catch (error) {
      callback(error);
    }
  }

  // Анализ корреляции с основными индексами рынка
  analyzeMarketIndices(targetChanges) {
    // Здесь можно было бы добавить анализ корреляции с индексами,
    // такими как S&P500, NASDAQ, и т.д., если бы у нас были данные
    // В данном случае, используем заглушку
    return {
      cryptoMarket: Math.random() * 2 - 1, // Случайное значение от -1 до 1
      stockMarket: Math.random() * 2 - 1,
      commodities: Math.random() * 2 - 1
    };
  }

  // Получение корреляционной матрицы для списка символов
  getCorrelationMatrix(symbols, timeframe = '1h', limit = 100, callback) {
    console.log(`Building correlation matrix for ${symbols.length} symbols`);
    
    // Сначала получаем изменения цен для всех символов
    const priceChangesMap = new Map();
    let processedCount = 0;
    
    // Функция обработки одного символа
    const processSymbol = (index) => {
      if (index >= symbols.length) {
        // Все символы обработаны, строим матрицу
        buildMatrix();
        return;
      }
      
      const symbol = symbols[index];
      this.getHistoricalPrices(symbol, timeframe, limit, (err, prices) => {
        if (!err && prices.length > 0) {
          const changes = this.calculatePriceChanges(prices);
          priceChangesMap.set(symbol, changes);
        }
        
        // Переходим к следующему символу
        processSymbol(index + 1);
      });
    };
    
    // Функция построения матрицы
    const buildMatrix = () => {
      try {
        const matrix = [];
        
        // Строим матрицу корреляций
        for (const symbol1 of symbols) {
          const row = [];
          const changes1 = priceChangesMap.get(symbol1) || [];
          
          for (const symbol2 of symbols) {
            if (symbol1 === symbol2) {
              row.push(1); // Корреляция с самим собой = 1
              continue;
            }
            
            const changes2 = priceChangesMap.get(symbol2) || [];
            
            // Обеспечиваем одинаковую длину массивов
            const minLength = Math.min(changes1.length, changes2.length);
            if (minLength < 10) {
              row.push(0); // Недостаточно данных
              continue;
            }
            
            const correlation = this.calculateCorrelation(
              changes1.slice(0, minLength),
              changes2.slice(0, minLength)
            );
            
            row.push(correlation);
          }
          
          matrix.push({
            symbol: symbol1,
            correlations: row
          });
        }
        
        callback(null, {
          symbols,
          matrix,
          timestamp: Date.now()
        });
      } catch (error) {
        callback(error);
      }
    };
    
    // Начинаем обработку с первого символа
    processSymbol(0);
  }

  // Найти активы с высокой диверсификацией (низкая корреляция)
  findDiversificationPairs(baseSymbols, candidateSymbols, timeframe = '1h', limit = 100, callback) {
    console.log(`Finding diversification pairs for ${baseSymbols.length} base symbols among ${candidateSymbols.length} candidates`);
    
    const result = [];
    let processedCount = 0;
    
    // Функция обработки одного базового символа
    const processBaseSymbol = (index) => {
      if (index >= baseSymbols.length) {
        // Все базовые символы обработаны
        callback(null, result);
        return;
      }
      
      const baseSymbol = baseSymbols[index];
      this.getHistoricalPrices(baseSymbol, timeframe, limit, (err, basePrices) => {
        if (err || basePrices.length < limit * 0.8) {
          console.warn(`Insufficient data for base symbol ${baseSymbol}`);
          processBaseSymbol(index + 1);
          return;
        }
        
        const baseChanges = this.calculatePriceChanges(basePrices);
        const pairResults = [];
        
        // Функция для обработки одного кандидата
        const processCandidate = (candIndex) => {
          if (candIndex >= candidateSymbols.length) {
            // Все кандидаты обработаны для текущего базового символа
            // Сортируем по абсолютному значению корреляции (от минимального к максимальному)
            pairResults.sort((a, b) => Math.abs(a.correlation) - Math.abs(b.correlation));
            
            result.push({
              baseSymbol,
              diversificationPairs: pairResults.slice(0, 5) // Топ-5 пар с наименьшей корреляцией
            });
            
            // Переходим к следующему базовому символу
            processBaseSymbol(index + 1);
            return;
          }
          
          const candidate = candidateSymbols[candIndex];
          if (baseSymbol === candidate) {
            // Пропускаем сравнение с самим собой
            processCandidate(candIndex + 1);
            return;
          }
          
          this.getHistoricalPrices(candidate, timeframe, limit, (candErr, candPrices) => {
            if (!candErr && candPrices.length >= limit * 0.8) {
              const candChanges = this.calculatePriceChanges(candPrices);
              
              // Обеспечиваем одинаковую длину массивов
              const minLength = Math.min(baseChanges.length, candChanges.length);
              const correlation = this.calculateCorrelation(
                baseChanges.slice(0, minLength),
                candChanges.slice(0, minLength)
              );
              
              pairResults.push({
                symbol: candidate,
                correlation
              });
            }
            
            // Переходим к следующему кандидату
            processCandidate(candIndex + 1);
          });
        };
        
        // Начинаем обработку кандидатов
        processCandidate(0);
      });
    };
    
    // Начинаем с первого базового символа
    processBaseSymbol(0);
  }
}

module.exports = CorrelationAnalyzer;
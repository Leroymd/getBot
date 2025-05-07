// backend/services/LiquidationAnalyzer.js

const BitgetAPI = require('./BitgetAPI');

class LiquidationAnalyzer {
  constructor() {
    this.api = new BitgetAPI();
    this.liquidationsCache = new Map();
    this.lastUpdateTime = new Map();
    this.updateInterval = 5 * 60 * 1000; // 5 минут
  }

  // Получение данных о ликвидациях для символа
  getLiquidations(symbol, callback) {
    // Проверяем кэш
    if (this.liquidationsCache.has(symbol) && 
        Date.now() - this.lastUpdateTime.get(symbol) < this.updateInterval) {
      return callback(null, this.liquidationsCache.get(symbol));
    }
    
    console.log(`Fetching liquidations for ${symbol}`);
    
    // Получаем данные о ликвидациях
    // (примечание: BitGet API может не предоставлять прямой доступ к данным о ликвидациях,
    // поэтому эта часть может потребовать адаптации под реальные API-вызовы)
    try {
      this.api.request(
        'GET', 
        `/api/mix/v1/market/liquidations?symbol=${symbol}&limit=100`,
        {},
        null,
        (err, response) => {
          if (err) {
            console.warn(`Error fetching liquidations for ${symbol}:`, err);
            // В случае ошибки, пробуем альтернативный подход
            return this.simulateLiquidations(symbol, callback);
          }
          
          if (!response || !response.data || !Array.isArray(response.data)) {
            console.warn(`No liquidation data available for ${symbol}`);
            return this.simulateLiquidations(symbol, callback);
          }
          
          try {
            // Структурируем данные о ликвидациях
            const liquidations = response.data.map(liq => ({
              symbol: liq.symbol,
              side: liq.side, // 'long' или 'short'
              price: parseFloat(liq.price),
              size: parseFloat(liq.size),
              timestamp: liq.timestamp
            }));
            
            // Сохраняем в кэш
            const result = {
              symbol,
              liquidations,
              timestamp: Date.now()
            };
            
            this.liquidationsCache.set(symbol, result);
            this.lastUpdateTime.set(symbol, Date.now());
            
            callback(null, result);
          } catch (parseError) {
            console.error(`Error parsing liquidation data for ${symbol}:`, parseError);
            this.simulateLiquidations(symbol, callback);
          }
        }
      );
    } catch (requestError) {
      console.error(`Error requesting liquidations for ${symbol}:`, requestError);
      this.simulateLiquidations(symbol, callback);
    }
  }

  // Симуляция данных о ликвидациях (используется, если API не предоставляет данные)
  simulateLiquidations(symbol, callback) {
    console.log(`Simulating liquidations for ${symbol}`);
    
    // Получаем исторические данные
    this.api.getKlines(symbol, '15m', 96, (err, klines) => {
      if (err) {
        console.error(`Error getting klines for ${symbol}:`, err);
        return callback(null, {
          symbol,
          liquidations: [],
          timestamp: Date.now(),
          simulated: true
        });
      }
      
      if (!klines || !klines.data || !Array.isArray(klines.data)) {
        console.warn(`No kline data available for ${symbol}`);
        return callback(null, {
          symbol,
          liquidations: [],
          timestamp: Date.now(),
          simulated: true
        });
      }
      
      try {
        // Находим точки резкого изменения цены
        const liquidations = [];
        let previousClose = null;
        
        for (let i = 0; i < klines.data.length; i++) {
          const candle = klines.data[i];
          const timestamp = parseInt(candle[0]);
          const open = parseFloat(candle[1]);
          const high = parseFloat(candle[2]);
          const low = parseFloat(candle[3]);
          const close = parseFloat(candle[4]);
          const volume = parseFloat(candle[5]);
          
          if (previousClose !== null) {
            const priceChange = (close - previousClose) / previousClose;
            
            // Если изменение цены значительное, предполагаем, что были ликвидации
            if (Math.abs(priceChange) > 0.01) { // Изменение больше 1%
              const side = priceChange < 0 ? 'long' : 'short';
              const price = priceChange < 0 ? high : low;
              const size = volume * 0.2 * Math.abs(priceChange) * 10; // Приблизительная оценка
              
              liquidations.push({
                symbol,
                side,
                price,
                size,
                timestamp
              });
            }
          }
          
          previousClose = close;
        }
        
        // Сохраняем в кэш
        const result = {
          symbol,
          liquidations,
          timestamp: Date.now(),
          simulated: true
        };
        
        this.liquidationsCache.set(symbol, result);
        this.lastUpdateTime.set(symbol, Date.now());
        
        callback(null, result);
      } catch (processError) {
        console.error(`Error processing kline data for ${symbol}:`, processError);
        callback(null, {
          symbol,
          liquidations: [],
          timestamp: Date.now(),
          simulated: true,
          error: processError.message
        });
      }
    });
  }

  // Анализ данных о ликвидациях
  analyzeLiquidations(symbol, callback) {
    this.getLiquidations(symbol, (err, data) => {
      if (err) {
        return callback(err);
      }
      
      if (!data || !data.liquidations || data.liquidations.length === 0) {
        return callback(null, {
          symbol,
          liquidationLevels: [],
          totalLiquidationsLong: 0,
          totalLiquidationsShort: 0,
          significantLevels: []
        });
      }
      
      try {
        const liquidations = data.liquidations;
        
        // Группируем ликвидации по ценовым уровням
        const liquidationMap = new Map();
        let totalLiquidationsLong = 0;
        let totalLiquidationsShort = 0;
        
        for (const liq of liquidations) {
          // Округляем цену до определенного уровня
          const priceStep = this.getPriceStep(liq.price);
          const priceLevel = Math.round(liq.price / priceStep) * priceStep;
          
          const key = priceLevel.toString();
          
          if (!liquidationMap.has(key)) {
            liquidationMap.set(key, {
              price: priceLevel,
              longSize: 0,
              shortSize: 0,
              count: 0
            });
          }
          
          const levelData = liquidationMap.get(key);
          
          if (liq.side === 'long') {
            levelData.longSize += liq.size;
            totalLiquidationsLong += liq.size;
          } else {
            levelData.shortSize += liq.size;
            totalLiquidationsShort += liq.size;
          }
          
          levelData.count++;
        }
        
        // Преобразуем Map в массив и сортируем по объему ликвидаций
        const liquidationLevels = Array.from(liquidationMap.values());
        liquidationLevels.sort((a, b) => (b.longSize + b.shortSize) - (a.longSize + a.shortSize));
        
        // Находим значимые уровни ликвидаций
        const significantLevels = this.findSignificantLiquidationLevels(liquidationLevels);
        
        // Добавляем текущую цену для сравнения
        this.api.getTicker(symbol, (tickerErr, ticker) => {
          const currentPrice = (ticker && ticker.data && ticker.data[0]) ? 
                              parseFloat(ticker.data[0].last) : null;
          
          callback(null, {
            symbol,
            liquidationLevels,
            totalLiquidationsLong,
            totalLiquidationsShort,
            significantLevels,
            currentPrice,
            timestamp: Date.now()
          });
        });
      } catch (analysisError) {
        callback(analysisError);
      }
    });
  }

  // Найти уровни с наибольшим объемом ликвидаций
  findSignificantLiquidationLevels(liquidationLevels) {
    if (!liquidationLevels || liquidationLevels.length === 0) {
      return [];
    }
    
    // Вычисляем общий объем ликвидаций
    const totalVolume = liquidationLevels.reduce(
      (sum, level) => sum + level.longSize + level.shortSize, 0
    );
    
    // Порог для значимого уровня (5% от общего объема)
    const threshold = totalVolume * 0.05;
    
    // Фильтруем уровни, объем которых превышает порог
    const significantLevels = liquidationLevels.filter(
      level => (level.longSize + level.shortSize) > threshold
    );
    
    // Добавляем процент от общего объема
    return significantLevels.map(level => ({
      ...level,
      percentOfTotal: ((level.longSize + level.shortSize) / totalVolume) * 100
    }));
  }

  // Получение шага цены для округления (зависит от диапазона цены)
  getPriceStep(price) {
    if (price < 0.1) return 0.0001;
    if (price < 1) return 0.001;
    if (price < 10) return 0.01;
    if (price < 100) return 0.1;
    if (price < 1000) return 1;
    if (price < 10000) return 10;
    return 100;
  }

  // Прогнозирование потенциальных точек разворота на основе ликвидаций
  predictReversalPoints(symbol, callback) {
    this.analyzeLiquidations(symbol, (err, analysis) => {
      if (err) {
        return callback(err);
      }
      
      if (!analysis || !analysis.significantLevels || analysis.significantLevels.length === 0) {
        return callback(null, {
          symbol,
          reversalPoints: [],
          currentPrice: analysis.currentPrice || null
        });
      }
      
      // Получаем исторические данные для анализа
      this.api.getKlines(symbol, '1h', 100, (klinesErr, klines) => {
        if (klinesErr) {
          return callback(klinesErr);
        }
        
        if (!klines || !klines.data || !Array.isArray(klines.data)) {
          return callback(null, {
            symbol,
            reversalPoints: [],
            currentPrice: analysis.currentPrice || null
          });
        }
        
        try {
          // Извлекаем цены и находим текущий тренд
          const closes = klines.data.map(candle => parseFloat(candle[4]));
          const lows = klines.data.map(candle => parseFloat(candle[3]));
          const highs = klines.data.map(candle => parseFloat(candle[2]));
          
          const currentPrice = analysis.currentPrice || closes[closes.length - 1];
          
          // Определяем текущий тренд
          let trend = 'NEUTRAL';
          const recentCloses = closes.slice(-10);
          
          if (recentCloses[recentCloses.length - 1] > recentCloses[0] * 1.03) {
            trend = 'UPTREND';
          } else if (recentCloses[recentCloses.length - 1] < recentCloses[0] * 0.97) {
            trend = 'DOWNTREND';
          }
          
          // Находим минимальную и максимальную цену за период
          const minPrice = Math.min(...lows);
          const maxPrice = Math.max(...highs);
          
          // Анализируем уровни ликвидаций для прогнозирования разворотов
          const reversalPoints = [];
          
          for (const level of analysis.significantLevels) {
            // В восходящем тренде обращаем внимание на скопления ликвидаций лонгов выше текущей цены
            if (trend === 'UPTREND' && level.price > currentPrice && level.longSize > level.shortSize) {
              reversalPoints.push({
                price: level.price,
                strength: level.percentOfTotal,
                type: 'RESISTANCE',
                description: 'Скопление лонг-ликвидаций выше текущей цены',
                distance: ((level.price - currentPrice) / currentPrice) * 100
              });
            }
            // В нисходящем тренде обращаем внимание на скопления ликвидаций шортов ниже текущей цены
            else if (trend === 'DOWNTREND' && level.price < currentPrice && level.shortSize > level.longSize) {
              reversalPoints.push({
                price: level.price,
                strength: level.percentOfTotal,
                type: 'SUPPORT',
                description: 'Скопление шорт-ликвидаций ниже текущей цены',
                distance: ((currentPrice - level.price) / currentPrice) * 100
              });
            }
            // В нейтральном тренде учитываем все значимые уровни
            else if (trend === 'NEUTRAL') {
              const type = level.price > currentPrice ? 'RESISTANCE' : 'SUPPORT';
              const direction = level.longSize > level.shortSize ? 'лонг' : 'шорт';
              
              reversalPoints.push({
                price: level.price,
                strength: level.percentOfTotal,
                type,
                description: `Скопление ${direction}-ликвидаций`,
                distance: Math.abs((level.price - currentPrice) / currentPrice) * 100
              });
            }
          }
          
          // Сортируем по силе и близости к текущей цене
          reversalPoints.sort((a, b) => {
            // Приоритизируем силу (вес 70%) и близость (вес 30%)
            return (b.strength * 0.7 - a.strength * 0.7) + 
                  (a.distance * 0.3 - b.distance * 0.3);
          });
          
          callback(null, {
            symbol,
            reversalPoints,
            currentPrice,
            trend
          });
        } catch (analysisError) {
          callback(analysisError);
        }
      });
    });
  }
}

module.exports = LiquidationAnalyzer;
// backend/services/MarketAnalyzer.js
class MarketAnalyzer {
  constructor(symbol, config, api) {
    this.symbol = symbol;
    this.config = config || {
      autoSwitching: {
        volatilityThreshold: 1.5,
        volumeThreshold: 2.0,
        trendStrengthThreshold: 0.6
      }
    };
    this.api = api;
    this.historicalData = {
      prices: [],
      volumes: [],
      timestamp: 0
    };
  }

  // Улучшенный метод updateHistoricalData в MarketAnalyzer.js
async updateHistoricalData() {
  try {
    // Получаем данные только если с последнего обновления прошло достаточно времени
    const now = Date.now();
    if (now - this.historicalData.timestamp < 5 * 60 * 1000 && 
        this.historicalData.prices.length > 0) {
      return this.historicalData; // Используем кэшированные данные
    }
    
    // Пробуем получить данные с разными таймфреймами, если один не сработает
    let klines = null;
    // Обратите внимание: используем правильный формат для Bitget API (1H, 15m, 4H)
    const timeframes = ['15m', '1H', '4H']; // Резервные таймфреймы с правильным регистром
    let successfulTimeframe = null;
    
    for (const timeframe of timeframes) {
      try {
        console.log(`Trying to get klines for ${this.symbol} with timeframe ${timeframe}`);
        klines = await this.api.getKlines(this.symbol, timeframe, 48);
        
        if (klines && klines.data && Array.isArray(klines.data) && klines.data.length > 0) {
          successfulTimeframe = timeframe;
          console.log(`Successfully got klines with timeframe ${timeframe}`);
          break; // Успешно получили данные
        } else {
          console.warn(`API returned empty or invalid data for ${timeframe}`);
        }
      } catch (tfError) {
        console.warn(`Failed to get klines with timeframe ${timeframe}: ${tfError.message}`);
      }
    }
    
    if (!klines || !klines.data || !Array.isArray(klines.data) || klines.data.length === 0) {
      // Создаем минимальные данные для продолжения работы
      console.warn(`Using mock data for ${this.symbol} as fallback`);
      const mockPrice = 50000; // Примерная цена BTC
      this.historicalData = {
        prices: Array(24).fill().map((_, i) => ({
          open: mockPrice * (1 + (Math.random() * 0.01 - 0.005)),
          high: mockPrice * (1 + (Math.random() * 0.02)),
          low: mockPrice * (1 - (Math.random() * 0.02)),
          close: mockPrice * (1 + (Math.random() * 0.01 - 0.005))
        })),
        volumes: Array(24).fill().map(() => 100 + Math.random() * 100),
        timestamp: now,
        isMock: true,
        timeframe: 'mock'
      };
      return this.historicalData;
    }
    
    // Обработка реальных данных
    this.historicalData = {
      prices: klines.data.map(candle => ({
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4])
      })),
      volumes: klines.data.map(candle => parseFloat(candle[5])),
      timestamp: now,
      isMock: false,
      timeframe: successfulTimeframe
    };
    
    return this.historicalData;
  } catch (error) {
    console.error(`Error updating historical data for ${this.symbol}:`, error);
    
    // Возвращаем кэшированные данные, если они есть
    if (this.historicalData.prices && this.historicalData.prices.length > 0) {
      return this.historicalData;
    }
    
    // Иначе создаем минимальные данные
    const mockPrice = 50000; // Примерная цена BTC
    this.historicalData = {
      prices: Array(24).fill().map((_, i) => ({
        open: mockPrice * (1 + (Math.random() * 0.01 - 0.005)),
        high: mockPrice * (1 + (Math.random() * 0.02)),
        low: mockPrice * (1 - (Math.random() * 0.02)),
        close: mockPrice * (1 + (Math.random() * 0.01 - 0.005))
      })),
      volumes: Array(24).fill().map(() => 100 + Math.random() * 100),
      timestamp: Date.now(),
      isMock: true,
      timeframe: 'mock'
    };
    
    return this.historicalData;
  }
}

  // Улучшенный анализ рыночных условий для выбора стратегии
  async analyzeMarketConditions() {
    try {
      await this.updateHistoricalData();
      
      if (this.historicalData.prices.length === 0) {
        throw new Error(`No historical data available for ${this.symbol}`);
      }
      
      // Расчет базовых метрик
      const volatility = this.calculateVolatility();
      const volumeRatio = this.calculateVolumeRatio();
      const trendStrength = this.calculateTrendStrength();
      
      // Новые метрики для улучшенного анализа
      const priceAction = this.analyzePriceAction();
      const marketPhase = this.determineMarketPhase();
      const supportResistance = this.findSupportResistanceLevels();
      
      // Определение типа рынка с учетом новых метрик
      let marketType = this.determineMarketType(volatility, trendStrength, priceAction);
      
      // Проверяем настройки автопереключения из конфигурации
      const volatilityThreshold = this.config.autoSwitching?.volatilityThreshold || 1.5;
      const trendStrengthThreshold = this.config.autoSwitching?.trendStrengthThreshold || 0.6;
      const volumeThreshold = this.config.autoSwitching?.volumeThreshold || 2.0;
      
      // Улучшенный алгоритм выбора стратегии
      let recommendedStrategy = 'DCA';
      let confidence = 0.5;
      
      if (marketType === 'TRENDING') {
        if (trendStrength > trendStrengthThreshold * 1.3) {
          // Сильный тренд - используем DCA для полного использования движения
          recommendedStrategy = 'DCA';
          confidence = 0.8;
        } else if (volatility < volatilityThreshold) {
          // Спокойный тренд - также DCA
          recommendedStrategy = 'DCA';
          confidence = 0.7;
        } else {
          // Волатильный тренд - скальпинг может быть эффективнее
          recommendedStrategy = 'SCALPING';
          confidence = 0.6;
        }
      } else if (marketType === 'VOLATILE') {
        if (volumeRatio > volumeThreshold) {
          // Высокая волатильность с большим объемом - скальпинг
          recommendedStrategy = 'SCALPING';
          confidence = 0.85;
        } else {
          // Высокая волатильность без объема - лучше DCA
          recommendedStrategy = 'DCA';
          confidence = 0.6;
        }
      } else if (marketType === 'RANGING') {
        if (priceAction.rangeWidth > 2.0) {
          // Широкий боковик - скальпинг
          recommendedStrategy = 'SCALPING';
          confidence = 0.7;
        } else {
          // Узкий боковик - DCA
          recommendedStrategy = 'DCA';
          confidence = 0.6;
        }
      }
      
      // Учитываем фазу рынка
      if (marketPhase === 'ACCUMULATION' || marketPhase === 'DISTRIBUTION') {
        // В фазах накопления и распределения скальпинг лучше работает
        if (recommendedStrategy !== 'SCALPING') {
          confidence -= 0.1;
        } else {
          confidence += 0.1;
        }
      }
      
      // Учитываем уровни поддержки/сопротивления
      if (supportResistance.nearLevel) {
        // Если цена находится близко к уровню поддержки/сопротивления
        if (supportResistance.levelType === 'SUPPORT' && priceAction.shortTermTrend === 'DOWN') {
          // Возможный отскок от поддержки - скальпинг
          recommendedStrategy = 'SCALPING';
          confidence = Math.max(confidence, 0.75);
        } else if (supportResistance.levelType === 'RESISTANCE' && priceAction.shortTermTrend === 'UP') {
          // Возможный отскок от сопротивления - скальпинг
          recommendedStrategy = 'SCALPING';
          confidence = Math.max(confidence, 0.75);
        }
      }
      
      return {
        recommendedStrategy,
        marketType,
        volatility,
        volumeRatio,
        trendStrength,
        confidence,
        marketPhase,
        priceAction: {
          shortTermTrend: priceAction.shortTermTrend,
          momentum: priceAction.momentum
        },
        supportResistance: {
          nearLevel: supportResistance.nearLevel,
          levelType: supportResistance.levelType
        }
      };
    } catch (error) {
      console.error(`Error in market analysis for ${this.symbol}:`, error);
      
      // Возвращаем безопасные данные по умолчанию
      return {
        recommendedStrategy: 'DCA', // DCA как более консервативная стратегия по умолчанию
        marketType: 'UNKNOWN',
        volatility: 1.0,
        volumeRatio: 1.0,
        trendStrength: 0.5,
        confidence: 0.5,
        error: error.message
      };
    }
  }
  
  // Определение типа рынка на основе нескольких метрик
  determineMarketType(volatility, trendStrength, priceAction) {
    const volatilityThreshold = this.config.autoSwitching?.volatilityThreshold || 1.5;
    const trendStrengthThreshold = this.config.autoSwitching?.trendStrengthThreshold || 0.6;
    
    if (trendStrength > trendStrengthThreshold) {
      if (volatility > volatilityThreshold) {
        return 'VOLATILE'; // Волатильный рынок с трендовыми характеристиками
      }
      return 'TRENDING'; // Явный тренд
    }
    
    if (volatility > volatilityThreshold) {
      return 'VOLATILE'; // Высокая волатильность без явного тренда
    }
    
    return 'RANGING'; // Боковик (низкая волатильность, слабый тренд)
  }
  
  // Анализ ценового действия
  analyzePriceAction() {
    const prices = this.historicalData.prices;
    
    // Определение краткосрочного тренда (последние 6 свечей)
    const recentPrices = prices.slice(-6);
    let upCount = 0;
    let downCount = 0;
    
    for (let i = 1; i < recentPrices.length; i++) {
      if (recentPrices[i].close > recentPrices[i-1].close) {
        upCount++;
      } else if (recentPrices[i].close < recentPrices[i-1].close) {
        downCount++;
      }
    }
    
    const shortTermTrend = upCount > downCount ? 'UP' : upCount < downCount ? 'DOWN' : 'NEUTRAL';
    
    // Расчет импульса (разница между последней и первой ценой в %)
    const lastPrice = prices[prices.length - 1].close;
    const firstPrice = prices[prices.length - 6].close;
    const momentum = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    // Ширина диапазона (разница между максимумом и минимумом за период)
    const highs = prices.map(p => p.high);
    const lows = prices.map(p => p.low);
    const maxPrice = Math.max(...highs);
    const minPrice = Math.min(...lows);
    const rangeWidth = ((maxPrice - minPrice) / minPrice) * 100;
    
    return {
      shortTermTrend,
      momentum,
      rangeWidth
    };
  }
  
  // Определение фазы рынка
  determineMarketPhase() {
    const prices = this.historicalData.prices;
    const volumes = this.historicalData.volumes;
    
    // Анализируем объемы и цены
    const recentPrices = prices.slice(-12);
    const recentVolumes = volumes.slice(-12);
    
    // Проверка на признаки аккумуляции
    // (низкая волатильность цены, повышающиеся объемы, боковое движение)
    let priceVolatility = this.calculateVolatilityForRange(recentPrices);
    let volumeTrend = this.calculateVolumeTrend(recentVolumes);
    let priceTrend = this.calculatePriceTrend(recentPrices);
    
    if (priceVolatility < 1.0 && volumeTrend > 0.5 && Math.abs(priceTrend) < 0.3) {
      return 'ACCUMULATION';
    }
    
    // Проверка на признаки распределения
    // (низкая волатильность цены, повышающиеся объемы после роста, боковое движение)
    if (priceVolatility < 1.0 && volumeTrend > 0.5 && priceTrend < -0.1) {
      return 'DISTRIBUTION';
    }
    
    // Восходящий тренд
    if (priceTrend > 0.5 && volumeTrend > 0) {
      return 'UPTREND';
    }
    
    // Нисходящий тренд
    if (priceTrend < -0.5 && (volumeTrend > 0 || volumeTrend < -0.5)) {
      return 'DOWNTREND';
    }
    
    return 'RANGING'; // Боковик по умолчанию
  }
  
  // Поиск уровней поддержки и сопротивления
  findSupportResistanceLevels() {
    const prices = this.historicalData.prices;
    if (prices.length < 10) {
      return { nearLevel: false };
    }
    
    // Находим локальные минимумы и максимумы
    const highs = [];
    const lows = [];
    
    for (let i = 2; i < prices.length - 2; i++) {
      const curr = prices[i];
      const prev1 = prices[i-1];
      const prev2 = prices[i-2];
      const next1 = prices[i+1];
      const next2 = prices[i+2];
      
      // Локальный максимум
      if (curr.high > prev1.high && curr.high > prev2.high && 
          curr.high > next1.high && curr.high > next2.high) {
        highs.push(curr.high);
      }
      
      // Локальный минимум
      if (curr.low < prev1.low && curr.low < prev2.low && 
          curr.low < next1.low && curr.low < next2.low) {
        lows.push(curr.low);
      }
    }
    
    const currentPrice = prices[prices.length - 1].close;
    
    // Ищем ближайший уровень поддержки
    let nearestSupport = -1;
    let minSupportDist = Number.MAX_VALUE;
    
    for (const low of lows) {
      if (low < currentPrice) {
        const dist = currentPrice - low;
        if (dist < minSupportDist) {
          minSupportDist = dist;
          nearestSupport = low;
        }
      }
    }
    
    // Ищем ближайший уровень сопротивления
    let nearestResistance = -1;
    let minResistanceDist = Number.MAX_VALUE;
    
    for (const high of highs) {
      if (high > currentPrice) {
        const dist = high - currentPrice;
        if (dist < minResistanceDist) {
          minResistanceDist = dist;
          nearestResistance = high;
        }
      }
    }
    
    // Проверяем, находимся ли мы близко к уровню
    const priceRange = Math.max(...prices.map(p => p.high)) - Math.min(...prices.map(p => p.low));
    const supportDistancePercent = nearestSupport > 0 ? (currentPrice - nearestSupport) / currentPrice * 100 : 100;
    const resistanceDistancePercent = nearestResistance > 0 ? (nearestResistance - currentPrice) / currentPrice * 100 : 100;
    
    const nearSupportThreshold = 1.0; // 1% от текущей цены
    const nearResistanceThreshold = 1.0;
    
    if (supportDistancePercent < nearSupportThreshold) {
      return { nearLevel: true, levelType: 'SUPPORT', level: nearestSupport };
    }
    
    if (resistanceDistancePercent < nearResistanceThreshold) {
      return { nearLevel: true, levelType: 'RESISTANCE', level: nearestResistance };
    }
    
    return { nearLevel: false };
  }
  
  // Расчет волатильности для определенного диапазона цен
  calculateVolatilityForRange(prices) {
    if (prices.length < 2) return 0;
    
    let trueRanges = [];
    for (let i = 1; i < prices.length; i++) {
      const high = prices[i].high;
      const low = prices[i].low;
      const prevClose = prices[i-1].close;
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    const atr = trueRanges.reduce((sum, val) => sum + val, 0) / trueRanges.length;
    const lastPrice = prices[prices.length - 1].close;
    
    return (atr / lastPrice) * 100; // в процентах
  }
  
  // Расчет тренда объема
  calculateVolumeTrend(volumes) {
    if (volumes.length < 5) return 0;
    
    let increasing = 0;
    let decreasing = 0;
    
    for (let i = 1; i < volumes.length; i++) {
      if (volumes[i] > volumes[i-1]) {
        increasing++;
      } else if (volumes[i] < volumes[i-1]) {
        decreasing++;
      }
    }
    
    return (increasing - decreasing) / (increasing + decreasing);
  }
  
  // Расчет тренда цены
  calculatePriceTrend(prices) {
    if (prices.length < 2) return 0;
    
    const firstPrice = prices[0].close;
    const lastPrice = prices[prices.length - 1].close;
    
    // Линейная регрессия для определения наклона
    const n = prices.length;
    const xValues = Array.from({length: n}, (_, i) => i);
    const yValues = prices.map(p => p.close);
    
    const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
    const yMean = yValues.reduce((sum, y) => sum + y, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
      denominator += Math.pow(xValues[i] - xMean, 2);
    }
    
    const slope = denominator !== 0 ? numerator / denominator : 0;
    const totalChange = (lastPrice - firstPrice) / firstPrice;
    
    // Нормализуем и объединяем метрики
    return (totalChange + slope * n / 10) / 2;
  }

  // Расчет волатильности (ATR)
  calculateVolatility() {
    const prices = this.historicalData.prices;
    if (prices.length < 2) return 0;
    
    let trueRanges = [];
    for (let i = 1; i < prices.length; i++) {
      const high = prices[i].high;
      const low = prices[i].low;
      const prevClose = prices[i-1].close;
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    // ATR, нормализованный как процент от цены
    const atr = trueRanges.reduce((sum, val) => sum + val, 0) / trueRanges.length;
    const lastPrice = prices[prices.length - 1].close;
    
    return (atr / lastPrice) * 100; // в процентах
  }

  // Расчет соотношения текущего объема к среднему
  calculateVolumeRatio() {
    const volumes = this.historicalData.volumes;
    if (volumes.length < 10) return 1;
    
    // Используем последние 24 часа как базовый период
    const recentVolumes = volumes.slice(-24);
    const avgVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    
    // Используем последние 3 часа как текущий период
    const currentVolumes = volumes.slice(-3);
    const currentAvgVolume = currentVolumes.reduce((sum, vol) => sum + vol, 0) / currentVolumes.length;
    
    return avgVolume === 0 ? 1 : currentAvgVolume / avgVolume;
  }

  // Расчет силы тренда
  calculateTrendStrength() {
    const prices = this.historicalData.prices;
    if (prices.length < 10) return 0;
    
    // Рассчитываем линейную регрессию
    const closes = prices.map(price => price.close);
    const n = closes.length;
    
    // Нормализуем индексы для регрессии
    const xValues = Array.from({length: n}, (_, i) => i / (n - 1));
    
    // Считаем средние значения
    const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
    const yMean = closes.reduce((sum, y) => sum + y, 0) / n;
    
    // Рассчитываем коэффициенты
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      const xDiff = xValues[i] - xMean;
      const yDiff = closes[i] - yMean;
      numerator += xDiff * yDiff;
      denominator += xDiff * xDiff;
    }
    
    // Направление и сила тренда
    const slope = denominator !== 0 ? numerator / denominator : 0;
    
    // Рассчитываем R-squared (коэффициент детерминации)
    let totalSS = 0;
    let residualSS = 0;
    
    for (let i = 0; i < n; i++) {
      const yPred = yMean + slope * (xValues[i] - xMean);
      totalSS += Math.pow(closes[i] - yMean, 2);
      residualSS += Math.pow(closes[i] - yPred, 2);
    }
    
    const rSquared = totalSS > 0 ? 1 - (residualSS / totalSS) : 0;
    
    // Нормализуем силу тренда от 0 до 1, учитывая как наклон, так и R-squared
    const maxPossibleSlope = Math.max(...closes) - Math.min(...closes);
    const normalizedSlope = Math.abs(slope) / (maxPossibleSlope || 1);
    
    return Math.min(Math.sqrt(normalizedSlope * rSquared), 1);
  }
}

module.exports = MarketAnalyzer;
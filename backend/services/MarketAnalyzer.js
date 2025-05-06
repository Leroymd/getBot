// backend/services/MarketAnalyzer.js
class MarketAnalyzer {
  constructor(symbol, config, api) {
    this.symbol = symbol;
    this.config = config;
    this.api = api;
    this.historicalData = {
      prices: [],
      volumes: [],
      timestamp: 0
    };
  }

  // Обновление исторических данных
  async updateHistoricalData() {
    try {
      // Получаем данные только если с последнего обновления прошло достаточно времени
      const now = Date.now();
      if (now - this.historicalData.timestamp < 5 * 60 * 1000) {
        return this.historicalData; // Используем кэшированные данные
      }
      
      const klines = await this.api.getKlines(this.symbol, '1h', 48); // 48 часов (2 дня)
      
      if (klines && klines.data && Array.isArray(klines.data) && klines.data.length > 0) {
        this.historicalData = {
          prices: klines.data.map(candle => ({
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4])
          })),
          volumes: klines.data.map(candle => parseFloat(candle[5])),
          timestamp: now
        };
      }
      
      return this.historicalData;
    } catch (error) {
      console.error(`Error updating historical data for ${this.symbol}:`, error);
      throw error;
    }
  }

  // Анализ рыночных условий для выбора стратегии
  async analyzeMarketConditions() {
    await this.updateHistoricalData();
    
    if (this.historicalData.prices.length === 0) {
      throw new Error(`No historical data available for ${this.symbol}`);
    }
    
    // Расчет метрик
    const volatility = this.calculateVolatility();
    const volumeRatio = this.calculateVolumeRatio();
    const trendStrength = this.calculateTrendStrength();
    
    // Определение типа рынка
    let marketType = 'RANGING'; // боковик
    
    // Проверяем настройки автопереключения из конфигурации
    const volatilityThreshold = this.config.autoSwitching?.volatilityThreshold || 1.5;
    const trendStrengthThreshold = this.config.autoSwitching?.trendStrengthThreshold || 0.6;
    const volumeThreshold = this.config.autoSwitching?.volumeThreshold || 2.0;
    
    if (trendStrength > trendStrengthThreshold) {
      marketType = 'TRENDING';
    }
    if (volatility > volatilityThreshold) {
      marketType = 'VOLATILE';
    }
    
    // Выбор стратегии на основе условий рынка
    let recommendedStrategy = 'DCA';
    let confidence = 0.5;
    
    if (marketType === 'TRENDING' && volatility < volatilityThreshold) {
      // В спокойном тренде лучше DCA
      recommendedStrategy = 'DCA';
      confidence = 0.7;
    } else if (marketType === 'VOLATILE' && volumeRatio > volumeThreshold) {
      // В волатильном рынке с высоким объемом лучше скальпинг
      recommendedStrategy = 'SCALPING';
      confidence = 0.8;
    } else if (marketType === 'RANGING' && volumeRatio < 1.2) {
      // В боковике с низким объемом лучше скальпинг
      recommendedStrategy = 'SCALPING';
      confidence = 0.6;
    }
    
    return {
      recommendedStrategy,
      marketType,
      volatility,
      volumeRatio,
      trendStrength,
      confidence
    };
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
    
    // Нормализуем силу тренда от 0 до 1
    const maxPossibleSlope = Math.max(...closes) - Math.min(...closes);
    const normalizedSlope = Math.abs(slope) / maxPossibleSlope;
    
    return Math.min(normalizedSlope, 1);
  }
}

module.exports = MarketAnalyzer;
// backend/services/SignalAnalyzer.js

/**
 * Класс для анализа торговых сигналов с настраиваемыми параметрами
 */
class SignalAnalyzer {
  /**
   * Конструктор класса
   * @param {string} symbol - Торговая пара
   * @param {Object} settings - Настройки анализа сигналов
   * @param {Object} api - Экземпляр API для получения данных
   */
  constructor(symbol, settings = {}, api) {
    this.symbol = symbol;
    this.settings = settings;
    this.api = api;
    
    // Кэш для индикаторов
    this.indicatorCache = {
      rsi: {},
      macd: {},
      bollinger: {},
      ma: {}
    };
    
    // Последний результат анализа
    this.lastAnalysis = null;
    
    console.log(`SignalAnalyzer initialized for ${symbol}`);
  }

  /**
   * Анализ рыночных сигналов
   * @param {number} currentPrice - Текущая цена
   * @param {Object} marketData - Данные рынка (свечи, позиция и т.д.)
   * @param {Object} customSettings - Пользовательские настройки для переопределения стандартных
   * @returns {Promise<Object>} - Результат анализа с сигналами
   */
  async analyzeSignals(currentPrice, marketData, customSettings = null) {
    // Используем пользовательские настройки, если они предоставлены
    const settings = customSettings || this.settings;
    
    // Проверяем наличие свечей в данных рынка
    const candles = marketData.recentCandles || [];
    if (candles.length < 10) {
      console.warn(`Not enough candles for signal analysis (${candles.length})`);
      return {
        shouldEnter: false,
        shouldExit: false,
        direction: null,
        confidence: 0,
        reason: 'Insufficient data'
      };
    }
    
    try {
      // Получаем значения индикаторов
      const indicatorValues = await this.calculateIndicators(candles, settings.indicators);
      
      // Оценка рыночных условий
      const marketConditions = await this.evaluateMarketConditions(candles, indicatorValues, settings.marketFilters);
      
      // Результаты анализа
      const result = {
        shouldEnter: false,
        shouldExit: false,
        direction: null,
        confidence: 0,
        indicators: indicatorValues,
        marketConditions
      };
      
      // Проверяем, есть ли активная позиция
      const hasPosition = marketData.position != null;
      
      if (hasPosition) {
        // Анализ для выхода из позиции
        result.shouldExit = await this.analyzeExitSignals(currentPrice, marketData, indicatorValues, settings);
        result.exitReason = this.getExitReason(currentPrice, marketData, indicatorValues, settings);
      } else {
        // Анализ для входа в позицию
        const entrySignal = await this.analyzeEntrySignals(currentPrice, marketData, indicatorValues, settings);
        result.shouldEnter = entrySignal.shouldEnter;
        result.direction = entrySignal.direction;
        result.confidence = entrySignal.confidence;
        result.reason = entrySignal.reason;
        
        // Расчет уровней TP/SL
        if (result.shouldEnter) {
          result.takeProfitPrice = this.calculateTakeProfitLevel(currentPrice, result.direction, settings);
          result.stopLossPrice = this.calculateStopLossLevel(currentPrice, result.direction, settings);
        }
      }
      
      // Сохраняем результат анализа для дальнейшего использования
      this.lastAnalysis = {
        price: currentPrice,
        timestamp: Date.now(),
        result
      };
      
      return result;
    } catch (error) {
      console.error(`Error in analyzeSignals for ${this.symbol}:`, error);
      return {
        shouldEnter: false,
        shouldExit: false,
        direction: null,
        confidence: 0,
        reason: `Error analyzing signals: ${error.message}`
      };
    }
  }

  /**
   * Расчет значений технических индикаторов
   * @param {Array} candles - Исторические свечи
   * @param {Object} indicatorSettings - Настройки индикаторов
   * @returns {Promise<Object>} - Значения индикаторов
   */
  async calculateIndicators(candles, indicatorSettings) {
    try {
      const result = {};
      
      // Получаем массивы цен
      const closes = candles.map(c => c.close);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const volumes = candles.map(c => c.volume);
      
      // Расчет RSI
      if (indicatorSettings && indicatorSettings.rsi && indicatorSettings.rsi.enabled) {
        const period = indicatorSettings.rsi.period || 14;
        result.rsi = this.calculateRSI(closes, period);
      }
      
      // Расчет MACD
      if (indicatorSettings && indicatorSettings.macd && indicatorSettings.macd.enabled) {
        const fastPeriod = indicatorSettings.macd.fastPeriod || 12;
        const slowPeriod = indicatorSettings.macd.slowPeriod || 26;
        const signalPeriod = indicatorSettings.macd.signalPeriod || 9;
        result.macd = this.calculateMACD(closes, fastPeriod, slowPeriod, signalPeriod);
      }
      
      // Расчет полос Боллинджера
      if (indicatorSettings && indicatorSettings.bollinger && indicatorSettings.bollinger.enabled) {
        const period = indicatorSettings.bollinger.period || 20;
        const deviation = indicatorSettings.bollinger.deviation || 2;
        result.bollinger = this.calculateBollingerBands(closes, period, deviation);
      }
      
      // Расчет скользящих средних
      if (indicatorSettings && indicatorSettings.ma && indicatorSettings.ma.enabled) {
        const fastPeriod = indicatorSettings.ma.fastPeriod || 10;
        const slowPeriod = indicatorSettings.ma.slowPeriod || 50;
        const type = indicatorSettings.ma.type || 'EMA';
        
        if (type === 'SMA') {
          result.ma = {
            fast: this.calculateSMA(closes, fastPeriod),
            slow: this.calculateSMA(closes, slowPeriod),
            crossover: false,
            direction: null
          };
        } else if (type === 'EMA') {
          result.ma = {
            fast: this.calculateEMA(closes, fastPeriod),
            slow: this.calculateEMA(closes, slowPeriod),
            crossover: false,
            direction: null
          };
        } else if (type === 'WMA') {
          result.ma = {
            fast: this.calculateWMA(closes, fastPeriod),
            slow: this.calculateWMA(closes, slowPeriod),
            crossover: false,
            direction: null
          };
        }
        
        // Проверка на пересечение
        if (result.ma.fast.length > 1 && result.ma.slow.length > 1) {
          const fastLast = result.ma.fast[result.ma.fast.length - 1];
          const fastPrev = result.ma.fast[result.ma.fast.length - 2];
          const slowLast = result.ma.slow[result.ma.slow.length - 1];
          const slowPrev = result.ma.slow[result.ma.slow.length - 2];
          
          // Определяем, было ли пересечение
          const crossUp = fastPrev < slowPrev && fastLast > slowLast;
          const crossDown = fastPrev > slowPrev && fastLast < slowLast;
          
          result.ma.crossover = crossUp || crossDown;
          result.ma.direction = crossUp ? 'UP' : (crossDown ? 'DOWN' : null);
        }
      }
      
      // Расчет трендовых индикаторов
      result.trend = this.calculateTrend(closes, highs, lows);
      
      // Расчет импульса
      result.momentum = this.calculateMomentum(closes);
      
      // Расчет волатильности
      result.volatility = this.calculateVolatility(highs, lows, closes);
      
      // Расчет объема
      result.volume = this.analyzeVolume(volumes, closes);
      
      return result;
    } catch (error) {
      console.error(`Error in calculateIndicators for ${this.symbol}:`, error);
      return {};
    }
  }

  /**
   * Расчет RSI (Relative Strength Index)
   * @param {Array} prices - Массив цен закрытия
   * @param {number} period - Период RSI
   * @returns {Object} - Результат RSI
   */
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) {
      return { value: 50, isOverbought: false, isOversold: false };
    }
    
    // Расчет изменений цены
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    
    // Разделение на положительные и отрицательные изменения
    const gains = [];
    const losses = [];
    
    for (const change of changes) {
      if (change >= 0) {
        gains.push(change);
        losses.push(0);
      } else {
        gains.push(0);
        losses.push(Math.abs(change));
      }
    }
    
    // Расчет средних значений
    let avgGain = 0;
    let avgLoss = 0;
    
    // Первый расчет среднего (простое среднее)
    for (let i = 0; i < period; i++) {
      avgGain += gains[i];
      avgLoss += losses[i];
    }
    
    avgGain /= period;
    avgLoss /= period;
    
    // Сглаженный расчет для оставшихся точек
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }
    
    // Расчет RS и RSI
    const rs = avgGain === 0 ? 0 : avgGain / (avgLoss || 1);
    const rsi = 100 - (100 / (1 + rs));
    
    // Определение состояний перекупленности и перепроданности
    const isOverbought = rsi > 70;
    const isOversold = rsi < 30;
    
    return {
      value: rsi,
      isOverbought,
      isOversold
    };
  }

  /**
   * Расчет MACD (Moving Average Convergence Divergence)
   * @param {Array} prices - Массив цен закрытия
   * @param {number} fastPeriod - Период быстрой EMA
   * @param {number} slowPeriod - Период медленной EMA
   * @param {number} signalPeriod - Период сигнальной линии
   * @returns {Object} - Результат MACD
   */
  calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (prices.length < slowPeriod + signalPeriod) {
      return { 
        macdLine: [], 
        signalLine: [], 
        histogram: [],
        value: 0,
        signal: 0,
        histogram: 0,
        crossover: false,
        direction: null
      };
    }
    
    // Расчет EMA
    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);
    
    // Расчет линии MACD
    const macdLine = [];
    for (let i = 0; i < slowEMA.length; i++) {
      if (i < fastEMA.length - slowEMA.length) continue;
      
      const fastIdx = i + (fastEMA.length - slowEMA.length);
      macdLine.push(fastEMA[fastIdx] - slowEMA[i]);
    }
    
    // Расчет сигнальной линии
    const signalLine = this.calculateEMA(macdLine, signalPeriod);
    
    // Расчет гистограммы
    const histogram = [];
    for (let i = 0; i < signalLine.length; i++) {
      histogram.push(macdLine[i + (macdLine.length - signalLine.length)] - signalLine[i]);
    }
    
    // Определение пересечения
    let crossover = false;
    let direction = null;
    
    if (histogram.length >= 2) {
      if (histogram[histogram.length - 2] < 0 && histogram[histogram.length - 1] > 0) {
        crossover = true;
        direction = 'UP';
      } else if (histogram[histogram.length - 2] > 0 && histogram[histogram.length - 1] < 0) {
        crossover = true;
        direction = 'DOWN';
      }
    }
    
    return {
      macdLine,
      signalLine,
      histogram,
      value: macdLine[macdLine.length - 1],
      signal: signalLine[signalLine.length - 1],
      histValue: histogram[histogram.length - 1],
      crossover,
      direction
    };
  }

  /**
   * Расчет полос Боллинджера
   * @param {Array} prices - Массив цен закрытия
   * @param {number} period - Период для расчета SMA
   * @param {number} deviation - Множитель стандартного отклонения
   * @returns {Object} - Результат полос Боллинджера
   */
  calculateBollingerBands(prices, period = 20, deviation = 2) {
    if (prices.length < period) {
      return { 
        upper: [], 
        middle: [], 
        lower: [],
        width: 0,
        isAboveUpper: false,
        isBelowLower: false,
        isNarrow: false
      };
    }
    
    // Расчет SMA (средняя линия)
    const middle = this.calculateSMA(prices, period);
    
    // Расчет верхней и нижней полосы
    const upper = [];
    const lower = [];
    const widths = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      // Расчет стандартного отклонения
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += Math.pow(prices[i - j] - middle[i - (period - 1)], 2);
      }
      const stdDev = Math.sqrt(sum / period);
      
      // Расчет верхней и нижней полосы
      const upperBand = middle[i - (period - 1)] + (deviation * stdDev);
      const lowerBand = middle[i - (period - 1)] - (deviation * stdDev);
      
      upper.push(upperBand);
      lower.push(lowerBand);
      
      // Расчет ширины полос (волатильность)
      widths.push((upperBand - lowerBand) / middle[i - (period - 1)]);
    }
    
    // Проверка текущей цены относительно полос
    const currentPrice = prices[prices.length - 1];
    const isAboveUpper = currentPrice > upper[upper.length - 1];
    const isBelowLower = currentPrice < lower[lower.length - 1];
    
    // Проверка сужения полос (низкая волатильность)
    // Считаем сужением, если текущая ширина меньше 70% от среднего значения за последние 10 периодов
    const recentWidths = widths.slice(-10);
    const avgWidth = recentWidths.reduce((sum, width) => sum + width, 0) / recentWidths.length;
    const isNarrow = widths[widths.length - 1] < avgWidth * 0.7;
    
    return {
      upper,
      middle,
      lower,
      width: widths[widths.length - 1],
      isAboveUpper,
      isBelowLower,
      isNarrow
    };
  }

  /**
   * Расчет SMA (Simple Moving Average)
   * @param {Array} prices - Массив цен
   * @param {number} period - Период SMA
   * @returns {Array} - Массив значений SMA
   */
  calculateSMA(prices, period) {
    const sma = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += prices[i - j];
      }
      sma.push(sum / period);
    }
    
    return sma;
  }

  /**
   * Расчет EMA (Exponential Moving Average)
   * @param {Array} prices - Массив цен
   * @param {number} period - Период EMA
   * @returns {Array} - Массив значений EMA
   */
  calculateEMA(prices, period) {
    const ema = [];
    const multiplier = 2 / (period + 1);
    
    // Первое значение EMA равно SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += prices[i];
    }
    const firstEMA = sum / period;
    ema.push(firstEMA);
    
    // Расчет остальных значений EMA
    for (let i = period; i < prices.length; i++) {
      const newEMA = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(newEMA);
    }
    
    return ema;
  }

  /**
   * Расчет WMA (Weighted Moving Average)
   * @param {Array} prices - Массив цен
   * @param {number} period - Период WMA
   * @returns {Array} - Массив значений WMA
   */
  calculateWMA(prices, period) {
    const wma = [];
    
    // Сумма весов
    const weightSum = (period * (period + 1)) / 2;
    
    for (let i = period - 1; i < prices.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        // Вес больше для более свежих данных
        const weight = period - j;
        sum += prices[i - j] * weight;
      }
      wma.push(sum / weightSum);
    }
    
    return wma;
  }

  /**
   * Расчет тренда
   * @param {Array} closes - Массив цен закрытия
   * @param {Array} highs - Массив максимумов
   * @param {Array} lows - Массив минимумов
   * @returns {Object} - Результат анализа тренда
   */
  calculateTrend(closes, highs, lows) {
    if (closes.length < 10) {
      return { direction: 'NEUTRAL', strength: 0 };
    }
    
    // Линейная регрессия для определения тренда
    const n = closes.length;
    const x = Array.from({ length: n }, (_, i) => i);
    
    // Расчет среднего значения
    const meanX = x.reduce((sum, x) => sum + x, 0) / n;
    const meanY = closes.reduce((sum, y) => sum + y, 0) / n;
    
    // Расчет коэффициентов линейной регрессии
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (x[i] - meanX) * (closes[i] - meanY);
      denominator += Math.pow(x[i] - meanX, 2);
    }
    
    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = meanY - slope * meanX;
    
    // Направление тренда
    let direction = 'NEUTRAL';
    if (slope > 0.001) direction = 'UP';
    else if (slope < -0.001) direction = 'DOWN';
    
    // Сила тренда (0-1)
    // Нормализуем наклон относительно средней цены
    const maxPossibleSlope = Math.max(...closes) - Math.min(...closes);
    const normalizedSlope = maxPossibleSlope > 0 ? Math.abs(slope) / maxPossibleSlope : 0;
    const strength = Math.min(normalizedSlope, 1);
    
    // Дополнительные проверки для подтверждения тренда
    // 1. Сравнение цен в начале и конце периода
    const startPrice = closes[0];
    const endPrice = closes[closes.length - 1];
    const priceChange = (endPrice - startPrice) / startPrice;
    
    // 2. Проверка новых максимумов и минимумов
    const recentHighs = highs.slice(-10);
    const recentLows = lows.slice(-10);
    
    const highestHigh = Math.max(...recentHighs);
    const highestHighIndex = highs.indexOf(highestHigh);
    
    const lowestLow = Math.min(...recentLows);
    const lowestLowIndex = lows.indexOf(lowestLow);
    
    // Новые максимумы в конце периода указывают на восходящий тренд
    const newHighs = highestHighIndex >= highs.length - 3;
    // Новые минимумы в конце периода указывают на нисходящий тренд
    const newLows = lowestLowIndex >= lows.length - 3;
    
    // Корректировка направления и силы на основе дополнительных проверок
    if (direction === 'UP' && (priceChange < 0 || newLows)) {
      direction = 'NEUTRAL';
    } else if (direction === 'DOWN' && (priceChange > 0 || newHighs)) {
      direction = 'NEUTRAL';
    }
    
    return {
      direction,
      strength,
      slope,
      priceChange
    };
  }

  /**
   * Расчет импульса цены
   * @param {Array} prices - Массив цен закрытия
   * @returns {Object} - Результат анализа импульса
   */
  calculateMomentum(prices) {
    if (prices.length < 10) {
      return { value: 0, isStrong: false, direction: 'NEUTRAL' };
    }
    
    // Расчет процентного изменения за последние 10 периодов
    const momentumPeriod = 10;
    const momentum = (prices[prices.length - 1] - prices[prices.length - momentumPeriod]) / 
                     prices[prices.length - momentumPeriod] * 100;
    
    // Определение направления и силы импульса
    let direction = 'NEUTRAL';
    if (momentum > 1) direction = 'UP';
    else if (momentum < -1) direction = 'DOWN';
    
    // Сила импульса (считаем сильным, если изменение более 5%)
    const isStrong = Math.abs(momentum) > 5;
    
    // Расчет ускорения импульса
    let acceleration = 0;
    if (prices.length >= momentumPeriod * 2) {
      const prevMomentum = (prices[prices.length - momentumPeriod - 1] - prices[prices.length - momentumPeriod * 2 - 1]) /
                           prices[prices.length - momentumPeriod * 2 - 1] * 100;
      acceleration = momentum - prevMomentum;
    }
    
    return {
      value: momentum,
      isStrong,
      direction,
      acceleration
    };
  }

  /**
   * Расчет волатильности
   * @param {Array} highs - Массив максимумов
   * @param {Array} lows - Массив минимумов
   * @param {Array} closes - Массив цен закрытия
   * @returns {Object} - Результат анализа волатильности
   */
  calculateVolatility(highs, lows, closes) {
    if (highs.length < 10 || lows.length < 10 || closes.length < 10) {
      return { value: 0, isHigh: false };
    }
    
    // Расчет ATR (Average True Range)
    const trueRanges = [];
    for (let i = 1; i < highs.length; i++) {
      const tr1 = highs[i] - lows[i]; // Текущий диапазон
      const tr2 = Math.abs(highs[i] - closes[i - 1]); // Вчерашнее закрытие к сегодняшнему максимуму
      const tr3 = Math.abs(lows[i] - closes[i - 1]); // Вчерашнее закрытие к сегодняшнему минимуму
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    // Расчет среднего истинного диапазона
    const atrPeriod = 14;
    let atr = 0;
    
    if (trueRanges.length < atrPeriod) {
      atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
    } else {
      // Используем EMA для расчета ATR
      atr = trueRanges.slice(0, atrPeriod).reduce((sum, tr) => sum + tr, 0) / atrPeriod;
      
      for (let i = atrPeriod; i < trueRanges.length; i++) {
        atr = (atr * (atrPeriod - 1) + trueRanges[i]) / atrPeriod;
      }
    }
    
    // Нормализуем ATR к процентам от текущей цены
    const atrPercent = (atr / closes[closes.length - 1]) * 100;
    
    // Определение высокой волатильности (больше 1.5%)
    const isHigh = atrPercent > 1.5;
    
    // Сравнение текущей волатильности с исторической
    const historicalATR = [];
    for (let i = atrPeriod; i < trueRanges.length; i++) {
      const periodTR = trueRanges.slice(i - atrPeriod, i);
      const periodATR = periodTR.reduce((sum, tr) => sum + tr, 0) / atrPeriod;
      historicalATR.push(periodATR);
    }
    
    // Расчет относительной волатильности
    let relativeVolatility = 1;
    if (historicalATR.length > 0) {
      const avgHistoricalATR = historicalATR.reduce((sum, atr) => sum + atr, 0) / historicalATR.length;
      relativeVolatility = atr / avgHistoricalATR;
    }
    
    return {
      value: atrPercent,
      isHigh,
      relativeVolatility,
      atr
    };
  }

  /**
   * Анализ объема
   * @param {Array} volumes - Массив объемов
   * @param {Array} prices - Массив цен закрытия
   * @returns {Object} - Результат анализа объема
   */
  analyzeVolume(volumes, prices) {
    if (volumes.length < 10 || prices.length < 10) {
      return { 
        ratio: 1, 
        isHigh: false, 
        isPositive: false,
        trendConfirmation: false
      };
    }
    
    // Расчет среднего объема за последние 20 периодов
    const volumePeriod = 20;
    const recentVolumes = volumes.slice(-volumePeriod);
    const avgVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    
    // Текущий объем
    const currentVolume = volumes[volumes.length - 1];
    
    // Отношение текущего объема к среднему
    const volumeRatio = currentVolume / avgVolume;
    
    // Определение высокого объема (в 1.5 раза выше среднего)
    const isHighVolume = volumeRatio > 1.5;
    
    // Определение положительного/отрицательного объема
    // (Положительный - если цена выросла, отрицательный - если упала)
    const priceChange = prices[prices.length - 1] - prices[prices.length - 2];
    const isPositive = priceChange > 0;
    
    // Подтверждение тренда объемом
    // (Объем подтверждает тренд, если высокий объем совпадает с направлением движения цены)
    const trendConfirmation = isHighVolume && (
      (isPositive && priceChange > 0) || (!isPositive && priceChange < 0)
    );
    
    // Аномальный объем (в 3 раза выше среднего)
    const isAnomalous = volumeRatio > 3;
    
    // Объемный профиль (распределение объема по ценам)
    const volumeProfile = {};
    const priceStep = (Math.max(...prices) - Math.min(...prices)) / 10;
    
    for (let i = 0; i < prices.length; i++) {
      const priceLevel = Math.floor(prices[i] / priceStep) * priceStep;
      if (!volumeProfile[priceLevel]) {
        volumeProfile[priceLevel] = 0;
      }
      volumeProfile[priceLevel] += volumes[i];
    }
    
    // Определение уровней с высоким объемом (POC - Point of Control)
    const pocLevel = Object.entries(volumeProfile)
      .sort((a, b) => b[1] - a[1])
      .map(entry => parseFloat(entry[0]))[0];
    
    return {
      ratio: volumeRatio,
      isHigh: isHighVolume,
      isPositive,
      trendConfirmation,
      isAnomalous,
      poc: pocLevel
    };
  }

  /**
   * Оценка рыночных условий
   * @param {Array} candles - Исторические свечи
   * @param {Object} indicatorValues - Значения индикаторов
   * @param {Object} filterSettings - Настройки фильтров рынка
   * @returns {Promise<Object>} - Результат оценки рыночных условий
   */
  async evaluateMarketConditions(candles, indicatorValues, filterSettings) {
    try {
      // Определение типа рынка на основе индикаторов
      let marketType = 'UNKNOWN';
      let marketScore = {
        trending: 0,
        ranging: 0,
        volatile: 0
      };
      
      // Учет тренда
      if (indicatorValues.trend) {
        if (indicatorValues.trend.strength > 0.7) {
          marketScore.trending += 2;
        } else if (indicatorValues.trend.strength > 0.4) {
          marketScore.trending += 1;
        }
        
        if (indicatorValues.trend.direction === 'NEUTRAL') {
          marketScore.ranging += 1;
        }
      }
      
      // Учет волатильности
      if (indicatorValues.volatility) {
        if (indicatorValues.volatility.isHigh) {
          marketScore.volatile += 2;
          marketScore.trending -= 1;
        } else {
          marketScore.ranging += 1;
        }
        
        if (indicatorValues.volatility.relativeVolatility > 1.5) {
          marketScore.volatile += 1;
        } else if (indicatorValues.volatility.relativeVolatility < 0.7) {
          marketScore.ranging += 1;
        }
      }
      
      // Учет Боллинджера
      if (indicatorValues.bollinger) {
        if (indicatorValues.bollinger.isNarrow) {
          marketScore.ranging += 2;
          marketScore.volatile -= 1;
        }
        
        if (indicatorValues.bollinger.isAboveUpper || indicatorValues.bollinger.isBelowLower) {
          marketScore.volatile += 1;
        }
      }
      
      // Учет импульса
      if (indicatorValues.momentum) {
        if (indicatorValues.momentum.isStrong) {
          marketScore.trending += 1;
        }
        
        if (Math.abs(indicatorValues.momentum.acceleration) > 2) {
          marketScore.volatile += 1;
        } else if (Math.abs(indicatorValues.momentum.acceleration) < 0.5) {
          marketScore.ranging += 1;
        }
      }
      
      // Определение типа рынка на основе оценок
      if (marketScore.trending > marketScore.ranging && marketScore.trending > marketScore.volatile) {
        marketType = 'TRENDING';
      } else if (marketScore.ranging > marketScore.trending && marketScore.ranging > marketScore.volatile) {
        marketType = 'RANGING';
      } else if (marketScore.volatile > marketScore.trending && marketScore.volatile > marketScore.ranging) {
        marketType = 'VOLATILE';
      }
      
      // Расчет волатильности рынка
      let volatility = indicatorValues.volatility ? indicatorValues.volatility.value : 0;
      
      // Расчет соотношения объема
      let volumeRatio = indicatorValues.volume ? indicatorValues.volume.ratio : 1;
      
      // Расчет силы тренда
      let trendStrength = indicatorValues.trend ? indicatorValues.trend.strength : 0;
      
      // Проверка фильтров рынка
      let passesFilters = true;
      
      if (filterSettings) {
        // Фильтр по высокой волатильности
        if (filterSettings.avoidHighVolatility && indicatorValues.volatility && indicatorValues.volatility.isHigh) {
          passesFilters = false;
        }
        
        // Фильтр по низкой ликвидности
        if (filterSettings.avoidLowLiquidity && indicatorValues.volume && indicatorValues.volume.ratio < 0.5) {
          passesFilters = false;
        }
        
        // Фильтр по предпочтительным типам рынка
        if (filterSettings.preferredMarketTypes && 
            filterSettings.preferredMarketTypes.length > 0 && 
            !filterSettings.preferredMarketTypes.includes(marketType)) {
          passesFilters = false;
        }
      }
      
      return {
        marketType,
        volatility,
        volumeRatio,
        trendStrength,
        passesFilters,
        score: marketScore
      };
    } catch (error) {
      console.error(`Error in evaluateMarketConditions for ${this.symbol}:`, error);
      return {
        marketType: 'UNKNOWN',
        volatility: 0,
        volumeRatio: 1,
        trendStrength: 0,
        passesFilters: true,
        score: { trending: 0, ranging: 0, volatile: 0 }
      };
    }
  }

  /**
   * Анализ сигналов на вход в позицию
   * @param {number} currentPrice - Текущая цена
   * @param {Object} marketData - Данные рынка
   * @param {Object} indicatorValues - Значения индикаторов
   * @param {Object} settings - Настройки анализа сигналов
   * @returns {Promise<Object>} - Результат анализа сигналов на вход
   */
  async analyzeEntrySignals(currentPrice, marketData, indicatorValues, settings) {
    try {
      // Результат по умолчанию - нет сигнала
      const result = {
        shouldEnter: false,
        direction: null,
        confidence: 0,
        reason: 'No signal'
      };
      
      // Проверка рыночных условий
      const marketConditions = marketData.marketConditions || 
                             await this.evaluateMarketConditions(
                               marketData.recentCandles, 
                               indicatorValues, 
                               settings.marketFilters
                             );
      
      // Если не проходит фильтры рынка, отклоняем сигнал
      if (!marketConditions.passesFilters) {
        result.reason = 'Market conditions do not pass filters';
        return result;
      }
      
      // Определение направления на основе тренда (если включено)
      let direction = null;
      if (settings.entryConditions && settings.entryConditions.useTrendDetection) {
        // Требуем минимальную силу тренда
        if (indicatorValues.trend && 
            indicatorValues.trend.strength >= settings.entryConditions.minTrendStrength) {
          if (indicatorValues.trend.direction === 'UP') {
            direction = 'LONG';
          } else if (indicatorValues.trend.direction === 'DOWN') {
            direction = 'SHORT';
          }
        }
        
        // Если разрешена торговля против тренда, меняем направление в определенных условиях
        if (direction && settings.entryConditions.allowCounterTrend) {
          // Например, при перепроданности/перекупленности в RSI
          if (indicatorValues.rsi) {
            if (direction === 'LONG' && indicatorValues.rsi.isOverbought) {
              direction = 'SHORT';
            } else if (direction === 'SHORT' && indicatorValues.rsi.isOversold) {
              direction = 'LONG';
            }
          }
        }
      }
      
      // Если направление не определено, используем другие индикаторы
      if (!direction) {
        // Используем MA-кроссовер
        if (indicatorValues.ma && indicatorValues.ma.crossover) {
          direction = indicatorValues.ma.direction === 'UP' ? 'LONG' : 'SHORT';
        }
        // Используем MACD-кроссовер
        else if (indicatorValues.macd && indicatorValues.macd.crossover) {
          direction = indicatorValues.macd.direction === 'UP' ? 'LONG' : 'SHORT';
        }
        // Используем RSI
        else if (indicatorValues.rsi) {
          if (indicatorValues.rsi.isOversold) {
            direction = 'LONG';
          } else if (indicatorValues.rsi.isOverbought) {
            direction = 'SHORT';
          }
        }
      }
      
      // Если направление все еще не определено, выходим
      if (!direction) {
        result.reason = 'Direction could not be determined';
        return result;
      }
      
      // Подсчет количества подтверждающих индикаторов
      let confirmations = 0;
      let confirmationsRequired = settings.general && settings.general.confirmationRequired ? settings.general.confirmationRequired : 2;
      let confidenceScore = 0;
      
      // RSI
      if (indicatorValues.rsi && settings.indicators && settings.indicators.rsi) {
        if ((direction === 'LONG' && indicatorValues.rsi.isOversold) ||
            (direction === 'SHORT' && indicatorValues.rsi.isOverbought)) {
          confirmations++;
          confidenceScore += settings.indicators.rsi.weight || 1;
        }
      }
      
      // MACD
      if (indicatorValues.macd && settings.indicators && settings.indicators.macd) {
        if ((direction === 'LONG' && indicatorValues.macd.direction === 'UP') ||
            (direction === 'SHORT' && indicatorValues.macd.direction === 'DOWN')) {
          confirmations++;
          confidenceScore += settings.indicators.macd.weight || 1;
        }
      }
      
      // Боллинджер
      if (indicatorValues.bollinger && settings.indicators && settings.indicators.bollinger) {
        if ((direction === 'LONG' && indicatorValues.bollinger.isBelowLower) ||
            (direction === 'SHORT' && indicatorValues.bollinger.isAboveUpper)) {
          confirmations++;
          confidenceScore += settings.indicators.bollinger.weight || 1;
        }
      }
      
      // MA
      if (indicatorValues.ma && settings.indicators && settings.indicators.ma) {
        if ((direction === 'LONG' && indicatorValues.ma.direction === 'UP') ||
            (direction === 'SHORT' && indicatorValues.ma.direction === 'DOWN')) {
          confirmations++;
          confidenceScore += settings.indicators.ma.weight || 1;
        }
      }
      
      // Подтверждение объемом
      if (settings.entryConditions && settings.entryConditions.requireVolumeConfirmation && 
          indicatorValues.volume && 
          indicatorValues.volume.trendConfirmation) {
        if ((direction === 'LONG' && indicatorValues.volume.isPositive) ||
            (direction === 'SHORT' && !indicatorValues.volume.isPositive)) {
          confirmations++;
          confidenceScore += 1;
        }
      }
      
      // Принятие решения на основе подтверждений и чувствительности
      const sensitivity = settings.general && settings.general.sensitivity ? settings.general.sensitivity / 100 : 0.5; // Преобразуем в 0-1
      
      if (confirmations >= confirmationsRequired) {
        result.shouldEnter = true;
        result.direction = direction;
        result.reason = `Signal confirmed by ${confirmations} indicators`;
        
        // Расчет уверенности (0-1)
        result.confidence = Math.min(confidenceScore / (confirmationsRequired * 2), 1) * sensitivity;
        
        // Корректировка уверенности на основе рыночных условий
        if (marketConditions.marketType === 'TRENDING' && 
            ((direction === 'LONG' && indicatorValues.trend && indicatorValues.trend.direction === 'UP') ||
             (direction === 'SHORT' && indicatorValues.trend && indicatorValues.trend.direction === 'DOWN'))) {
          result.confidence *= 1.2; // Повышаем уверенность при совпадении с трендом
        } else if (marketConditions.marketType === 'VOLATILE') {
          result.confidence *= 0.8; // Снижаем уверенность на волатильном рынке
        }
        
        // Рассчитываем размер позиции на основе уверенности
        result.entrySize = this.calculatePositionSize(currentPrice, result.confidence, settings);
      }
      
      return result;
    } catch (error) {
      console.error(`Error in analyzeEntrySignals for ${this.symbol}:`, error);
      return {
        shouldEnter: false,
        direction: null,
        confidence: 0,
        reason: `Error analyzing entry signals: ${error.message}`
      };
    }
  }

  /**
   * Анализ сигналов на выход из позиции
   * @param {number} currentPrice - Текущая цена
   * @param {Object} marketData - Данные рынка
   * @param {Object} indicatorValues - Значения индикаторов
   * @param {Object} settings - Настройки анализа сигналов
   * @returns {Promise<boolean>} - Результат анализа сигналов на выход
   */
  async analyzeExitSignals(currentPrice, marketData, indicatorValues, settings) {
    try {
      if (!marketData.position) {
        return false;
      }
      
      const position = marketData.position;
      const direction = position.direction;
      const entryPrice = position.entryPrice;
      const entryTime = new Date(position.entryTime).getTime();
      const elapsedMinutes = Math.floor((Date.now() - entryTime) / 60000);
      
      // Расчет текущего P&L
      let pnl = 0;
      if (direction === 'LONG') {
        pnl = (currentPrice - entryPrice) / entryPrice * 100;
      } else { // SHORT
        pnl = (entryPrice - currentPrice) / entryPrice * 100;
      }
      
      // Проверка стоп-лосса или тейк-профита для скальпинга
      if (position.strategy === 'SCALPING') {
        if (position.takeProfitPrice && 
           ((direction === 'LONG' && currentPrice >= position.takeProfitPrice) ||
            (direction === 'SHORT' && currentPrice <= position.takeProfitPrice))) {
          return true;
        }
        
        if (position.stopLossPrice && 
           ((direction === 'LONG' && currentPrice <= position.stopLossPrice) ||
            (direction === 'SHORT' && currentPrice >= position.stopLossPrice))) {
          return true;
        }
      }
      
      // Проверка трейлинг-стопа
      if (settings.exitConditions && settings.exitConditions.useTrailingStop && 
          position.trailingStopActive && 
          position.trailingStopPrice) {
        if ((direction === 'LONG' && currentPrice <= position.trailingStopPrice) ||
            (direction === 'SHORT' && currentPrice >= position.trailingStopPrice)) {
          return true;
        }
      }
      
      // Проверка максимальной длительности сделки
      if (settings.exitConditions && settings.exitConditions.maxTradeDuration && 
          elapsedMinutes > settings.exitConditions.maxTradeDuration) {
        return true;
      }
      
      // Проверка минимальной прибыли для закрытия
      if (settings.exitConditions && settings.exitConditions.minProfitToClose && 
          pnl >= settings.exitConditions.minProfitToClose) {
        return true;
      }
      
      // Проверка разворотного сигнала
      if (settings.exitConditions && settings.exitConditions.closeOnReversalSignal) {
        // RSI
        if (indicatorValues.rsi) {
          if ((direction === 'LONG' && indicatorValues.rsi.isOverbought) ||
              (direction === 'SHORT' && indicatorValues.rsi.isOversold)) {
            return true;
          }
        }
        
        // MACD
        if (indicatorValues.macd && indicatorValues.macd.crossover) {
          if ((direction === 'LONG' && indicatorValues.macd.direction === 'DOWN') ||
              (direction === 'SHORT' && indicatorValues.macd.direction === 'UP')) {
            return true;
          }
        }
      }
      
      // Проверка ослабления тренда
      if (settings.exitConditions && settings.exitConditions.closeOnWeakTrend && 
          indicatorValues.trend && 
          indicatorValues.trend.strength < 0.3 && 
          elapsedMinutes > 30) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error in analyzeExitSignals for ${this.symbol}:`, error);
      return false;
    }
  }

  /**
   * Получение причины выхода из позиции
   * @param {number} currentPrice - Текущая цена
   * @param {Object} marketData - Данные рынка
   * @param {Object} indicatorValues - Значения индикаторов
   * @param {Object} settings - Настройки анализа сигналов
   * @returns {string} - Причина выхода
   */
  getExitReason(currentPrice, marketData, indicatorValues, settings) {
    if (!marketData.position) {
      return 'No position';
    }
    
    const position = marketData.position;
    const direction = position.direction;
    const entryPrice = position.entryPrice;
    const entryTime = new Date(position.entryTime).getTime();
    const elapsedMinutes = Math.floor((Date.now() - entryTime) / 60000);
    
    // Расчет текущего P&L
    let pnl = 0;
    if (direction === 'LONG') {
      pnl = (currentPrice - entryPrice) / entryPrice * 100;
    } else { // SHORT
      pnl = (entryPrice - currentPrice) / entryPrice * 100;
    }
    
    // Проверка тейк-профита
    if (position.strategy === 'SCALPING' && position.takeProfitPrice && 
       ((direction === 'LONG' && currentPrice >= position.takeProfitPrice) ||
        (direction === 'SHORT' && currentPrice <= position.takeProfitPrice))) {
      return 'Take Profit';
    }
    
    // Проверка стоп-лосса
    if (position.strategy === 'SCALPING' && position.stopLossPrice && 
       ((direction === 'LONG' && currentPrice <= position.stopLossPrice) ||
        (direction === 'SHORT' && currentPrice >= position.stopLossPrice))) {
      return 'Stop Loss';
    }
    
    // Проверка трейлинг-стопа
    if (settings.exitConditions && settings.exitConditions.useTrailingStop && 
        position.trailingStopActive && 
        position.trailingStopPrice &&
       ((direction === 'LONG' && currentPrice <= position.trailingStopPrice) ||
        (direction === 'SHORT' && currentPrice >= position.trailingStopPrice))) {
      return 'Trailing Stop';
    }
    
    // Проверка максимальной длительности сделки
    if (settings.exitConditions && settings.exitConditions.maxTradeDuration &&
        elapsedMinutes > settings.exitConditions.maxTradeDuration) {
      return 'Max Duration Exceeded';
    }
    
    // Проверка минимальной прибыли для закрытия
    if (settings.exitConditions && settings.exitConditions.minProfitToClose &&
        pnl >= settings.exitConditions.minProfitToClose) {
      return 'Profit Target Reached';
    }
    
    // Проверка разворотного сигнала
    if (settings.exitConditions && settings.exitConditions.closeOnReversalSignal) {
      if (indicatorValues.rsi &&
         ((direction === 'LONG' && indicatorValues.rsi.isOverbought) ||
          (direction === 'SHORT' && indicatorValues.rsi.isOversold))) {
        return 'RSI Reversal Signal';
      }
      
      if (indicatorValues.macd && indicatorValues.macd.crossover &&
         ((direction === 'LONG' && indicatorValues.macd.direction === 'DOWN') ||
          (direction === 'SHORT' && indicatorValues.macd.direction === 'UP'))) {
        return 'MACD Reversal Signal';
      }
    }
    
    // Проверка ослабления тренда
    if (settings.exitConditions && settings.exitConditions.closeOnWeakTrend && 
        indicatorValues.trend && 
        indicatorValues.trend.strength < 0.3 && 
        elapsedMinutes > 30) {
      return 'Weak Trend';
    }
    
    return 'Unknown Reason';
  }

  /**
   * Расчет размера позиции
   * @param {number} currentPrice - Текущая цена
   * @param {number} confidence - Уверенность в сигнале (0-1)
   * @param {Object} settings - Настройки анализа сигналов
   * @returns {number} - Размер позиции
   */
  calculatePositionSize(currentPrice, confidence, settings) {
    // Базовый размер позиции (процент от баланса)
    const baseSize = 0.1; // 10% от баланса по умолчанию
    
    // Корректировка размера на основе уверенности
    let adjustedSize = baseSize * Math.max(0.5, confidence);
    
    // Корректировка размера на основе волатильности
    if (this.lastAnalysis && this.lastAnalysis.result && this.lastAnalysis.result.marketConditions) {
      const volatility = this.lastAnalysis.result.marketConditions.volatility;
      
      if (volatility > 2.0) {
        // Снижаем размер при высокой волатильности
        adjustedSize *= 0.7;
      } else if (volatility < 0.5) {
        // Увеличиваем размер при низкой волатильности
        adjustedSize *= 1.3;
      }
    }
    
    // Фиксация размера в разумных пределах
    adjustedSize = Math.max(0.02, Math.min(0.3, adjustedSize));
    
    return adjustedSize;
  }

  /**
   * Расчет уровня тейк-профита
   * @param {number} entryPrice - Цена входа
   * @param {string} direction - Направление (LONG/SHORT)
   * @param {Object} settings - Настройки анализа сигналов
   * @returns {number} - Уровень тейк-профита
   */
  calculateTakeProfitLevel(entryPrice, direction, settings) {
    // Целевая прибыль из настроек
    let profitTarget;
    
    if (settings.strategySpecific && settings.strategySpecific.scalping) {
      profitTarget = settings.strategySpecific.scalping.profitTarget / 100;
    } else {
      profitTarget = 0.005; // 0.5% по умолчанию
    }
    
    // Расчет тейк-профита
    if (direction === 'LONG') {
      return entryPrice * (1 + profitTarget);
    } else { // SHORT
      return entryPrice * (1 - profitTarget);
    }
  }

  /**
   * Расчет уровня стоп-лосса
   * @param {number} entryPrice - Цена входа
   * @param {string} direction - Направление (LONG/SHORT)
   * @param {Object} settings - Настройки анализа сигналов
   * @returns {number} - Уровень стоп-лосса
   */
  calculateStopLossLevel(entryPrice, direction, settings) {
    // Стоп-лосс из настроек
    let stopLoss;
    
    if (settings.strategySpecific && settings.strategySpecific.scalping) {
      stopLoss = settings.strategySpecific.scalping.stopLoss / 100;
    } else {
      stopLoss = 0.003; // 0.3% по умолчанию
    }
    
    // Корректировка стоп-лосса на основе волатильности
    if (this.lastAnalysis && this.lastAnalysis.result && this.lastAnalysis.result.indicators && this.lastAnalysis.result.indicators.volatility) {
      const volatility = this.lastAnalysis.result.indicators.volatility.value;
      
      if (volatility > 1.5) {
        // Увеличиваем стоп-лосс при высокой волатильности
        stopLoss *= 1.5;
      } else if (volatility < 0.5) {
        // Уменьшаем стоп-лосс при низкой волатильности
        stopLoss *= 0.8;
      }
    }
    
    // Расчет стоп-лосса
    if (direction === 'LONG') {
      return entryPrice * (1 - stopLoss);
    } else { // SHORT
      return entryPrice * (1 + stopLoss);
    }
  }

  /**
   * Получение значений индикаторов для визуализации
   * @param {Array} candles - Исторические свечи
   * @returns {Promise<Object>} - Значения индикаторов для визуализации
   */
  async getIndicatorValues(candles) {
    try {
      return await this.calculateIndicators(candles, {
        rsi: { enabled: true },
        macd: { enabled: true },
        bollinger: { enabled: true },
        ma: { enabled: true }
      });
    } catch (error) {
      console.error(`Error in getIndicatorValues for ${this.symbol}:`, error);
      return {};
    }
  }

  /**
   * Получение условий рынка
   * @returns {Promise<Object>} - Текущие условия рынка
   */
  async getMarketConditions() {
    try {
      if (this.lastAnalysis && this.lastAnalysis.result && this.lastAnalysis.result.marketConditions) {
        return this.lastAnalysis.result.marketConditions;
      }
      
      // Если нет последнего анализа, возвращаем пустой объект
      return {
        marketType: 'UNKNOWN',
        volatility: 0,
        volumeRatio: 1,
        trendStrength: 0
      };
    } catch (error) {
      console.error(`Error in getMarketConditions for ${this.symbol}:`, error);
      return {
        marketType: 'UNKNOWN',
        volatility: 0,
        volumeRatio: 1,
        trendStrength: 0
      };
    }
  }

  /**
   * Обновление настроек анализа сигналов
   * @param {Object} newSettings - Новые настройки
   */
  updateSettings(newSettings) {
    this.settings = newSettings;
    console.log(`Signal analyzer settings updated for ${this.symbol}`);
  }
}

module.exports = SignalAnalyzer;
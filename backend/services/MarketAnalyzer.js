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
    
    // Параметры анализа рынка
    this.params = {
      shortPeriod: 14,  // Короткий период для индикаторов
      longPeriod: 100,  // Длинный период для индикаторов
      volumeWindow: 24, // Окно для анализа объема (часов)
      volatilityWindow: 24 // Окно для анализа волатильности (часов)
    };
  }

  // Обновление исторических данных
  async updateHistoricalData() {
    try {
      // Получаем данные только если с последнего обновления прошло достаточно времени
      const now = Date.now();
      if (now - this.historicalData.timestamp < 5 * 60 * 1000 && this.historicalData.prices.length > 0) {
        return this.historicalData; // Используем кэшированные данные
      }
      
      // Получаем часовые и минутные свечи для разных типов анализа
      const hourlyKlines = await this.api.getKlines(this.symbol, '1h', 100); // 100 часов (4+ дня)
      
      // Для быстрых рыночных условий получаем также 5-минутные свечи
      const minuteKlines = await this.api.getKlines(this.symbol, '5m', 288); // 288 x 5m = 24 часа
      
      if (hourlyKlines && hourlyKlines.data && Array.isArray(hourlyKlines.data) && hourlyKlines.data.length > 0) {
        // Обрабатываем часовые свечи
        const hourlyPrices = hourlyKlines.data.map(candle => ({
          time: parseInt(candle[0]),
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4]),
          volume: parseFloat(candle[5])
        }));
        
        // Обрабатываем минутные свечи
        let minutePrices = [];
        if (minuteKlines && minuteKlines.data && Array.isArray(minuteKlines.data)) {
          minutePrices = minuteKlines.data.map(candle => ({
            time: parseInt(candle[0]),
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5])
          }));
        }
        
        // Сохраняем обработанные данные
        this.historicalData = {
          hourlyPrices,
          minutePrices,
          timestamp: now
        };
      }
      
      return this.historicalData;
    } catch (error) {
      console.error(`Ошибка обновления исторических данных для ${this.symbol}:`, error);
      throw error;
    }
  }

  // Анализ рыночных условий для выбора стратегии
  async analyzeMarketConditions() {
    await this.updateHistoricalData();
    
    const { hourlyPrices, minutePrices } = this.historicalData;
    
    if (!hourlyPrices || hourlyPrices.length < this.params.longPeriod) {
      throw new Error(`Недостаточно исторических данных для ${this.symbol}`);
    }
    
    // Расчет метрик на основе часовых данных
    const volatility = this.calculateVolatility(hourlyPrices);
    const volumeRatio = this.calculateVolumeRatio(hourlyPrices);
    const trendStrength = this.calculateTrendStrength(hourlyPrices);
    const macdSignal = this.calculateMACD(hourlyPrices);
    const rsiValue = this.calculateRSI(hourlyPrices);
    const bbWidth = this.calculateBollingerBands(hourlyPrices);
    
    // Расчет метрик на основе минутных данных (для оценки краткосрочной волатильности)
    let shortTermVolatility = 0;
    let shortTermRsi = 50;
    if (minutePrices && minutePrices.length > 0) {
      shortTermVolatility = this.calculateVolatility(minutePrices);
      shortTermRsi = this.calculateRSI(minutePrices);
    }
    
    // Определение типа рынка
    let marketType = 'RANGING'; // боковик по умолчанию
    
    // Проверяем настройки автопереключения из конфигурации
    const volatilityThreshold = this.config.autoSwitching?.volatilityThreshold || 1.5;
    const trendStrengthThreshold = this.config.autoSwitching?.trendStrengthThreshold || 0.6;
    const volumeThreshold = this.config.autoSwitching?.volumeThreshold || 2.0;
    
    // Проверка на трендовый рынок
    if (trendStrength > trendStrengthThreshold) {
      marketType = 'TRENDING';
    }
    
    // Проверка на волатильный рынок
    if (volatility > volatilityThreshold || bbWidth > 2.0) {
      marketType = 'VOLATILE';
    }
    
    // Выбор стратегии на основе рыночных условий
    let recommendedStrategy = 'DCA';
    let confidence = 0.5;
    
    // Логика выбора стратегии
    if (marketType === 'TRENDING') {
      // В тренде с умеренной волатильностью лучше DCA
      if (volatility < volatilityThreshold && trendStrength > trendStrengthThreshold) {
        recommendedStrategy = 'DCA';
        // Увеличиваем уверенность при сильном тренде и подтверждении от MACD
        confidence = 0.6 + (trendStrength * 0.2);
        if (macdSignal === 'BUY' || macdSignal === 'SELL') {
          confidence += 0.1;
        }
      } else {
        // В тренде, но с высокой волатильностью - можно скальпинг
        recommendedStrategy = 'SCALPING';
        confidence = 0.6;
      }
    } else if (marketType === 'VOLATILE') {
      // В волатильном рынке с высоким объемом лучше скальпинг
      if (volumeRatio > volumeThreshold) {
        recommendedStrategy = 'SCALPING';
        confidence = 0.7 + (volatility / 10); // Чем выше волатильность, тем выше уверенность (до определенного предела)
        if (confidence > 0.9) confidence = 0.9; // Ограничиваем максимальную уверенность
      } else {
        // Волатильный, но с низким объемом - риск высокий, снижаем уверенность
        recommendedStrategy = 'SCALPING';
        confidence = 0.6;
      }
    } else { // RANGING
      // В боковике решение зависит от диапазона и объема
      if (bbWidth < 1.0 && rsiValue > 40 && rsiValue < 60) {
        // Узкий боковик и RSI близко к центру
        recommendedStrategy = 'SCALPING';
        confidence = 0.7;
      } else if (volumeRatio < 1.2) {
        // Боковик с низким объемом - сложно для обеих стратегий
        recommendedStrategy = 'SCALPING';
        confidence = 0.6;
      } else {
        // Боковик с хорошим объемом, но средний по ширине
        recommendedStrategy = 'DCA';
        confidence = 0.65;
      }
    }
    
    // Дополнительный анализ на основе RSI
    if (rsiValue < 30 || rsiValue > 70) {
      // Экстремальные значения RSI могут указывать на потенциальный разворот
      confidence *= 0.9; // Снижаем уверенность
    }
    
    // Ограничиваем уверенность минимальным и максимальным значениями
    if (confidence < 0.5) confidence = 0.5;
    if (confidence > 0.95) confidence = 0.95;
    
    return {
      recommendedStrategy,
      marketType,
      volatility,
      volumeRatio,
      trendStrength,
      confidence,
      indicators: {
        rsi: rsiValue,
        macd: macdSignal,
        bollingerWidth: bbWidth,
        shortTermVolatility,
        shortTermRsi
      }
    };
  }

  // Расчет волатильности (ATR на основе истории)
  calculateVolatility(prices) {
    if (!prices || prices.length < 2) return 0;
    
    // Количество свечей для расчета волатильности
    const period = Math.min(this.params.volatilityWindow, prices.length);
    
    // Берем последние N свечей
    const recentPrices = prices.slice(-period);
    
    // Расчет среднего истинного диапазона (ATR)
    let trueRanges = [];
    for (let i = 1; i < recentPrices.length; i++) {
      const high = recentPrices[i].high;
      const low = recentPrices[i].low;
      const prevClose = recentPrices[i-1].close;
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    // ATR, нормализованный как процент от цены
    const atr = trueRanges.reduce((sum, val) => sum + val, 0) / trueRanges.length;
    const lastPrice = recentPrices[recentPrices.length - 1].close;
    
    return (atr / lastPrice) * 100; // в процентах
  }

  // Расчет соотношения текущего объема к среднему
  calculateVolumeRatio(prices) {
    if (!prices || prices.length < this.params.volumeWindow) return 1;
    
    // Берем все доступные свечи, но не более volumeWindow
    const period = Math.min(this.params.volumeWindow, prices.length - 5);
    
    // Объем за весь период (кроме последних 5 свечей)
    const baseVolumes = prices.slice(0, -5).slice(-period);
    const baseAvgVolume = baseVolumes.reduce((sum, price) => sum + price.volume, 0) / baseVolumes.length;
    
    // Объем за последние 5 свечей
    const recentVolumes = prices.slice(-5);
    const recentAvgVolume = recentVolumes.reduce((sum, price) => sum + price.volume, 0) / recentVolumes.length;
    
    return baseAvgVolume === 0 ? 1 : recentAvgVolume / baseAvgVolume;
  }

  // Расчет силы тренда
  calculateTrendStrength(prices) {
    if (!prices || prices.length < this.params.shortPeriod) return 0;
    
    // Берем последние N свечей для анализа тренда
    const period = Math.min(this.params.longPeriod, prices.length);
    const recentPrices = prices.slice(-period);
    
    // Расчет EMA за короткий и длинный периоды
    const shortEMA = this.calculateEMA(recentPrices, this.params.shortPeriod);
    const longEMA = this.calculateEMA(recentPrices, this.params.longPeriod);
    
    // Если нет достаточно данных для расчета длинной EMA
    if (!shortEMA.length || !longEMA.length) return 0;
    
    // Соотношение короткой к длинной EMA для определения силы тренда
    const emaRatio = shortEMA[shortEMA.length - 1] / longEMA[longEMA.length - 1];
    
    // Расчет линейной регрессии для определения направления
    const closes = recentPrices.map(candle => candle.close);
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
    
    // Учитываем отношение EMA при расчете силы тренда
    const emaTrendFactor = Math.abs(emaRatio - 1);
    
    // Комбинированная метрика силы тренда
    return Math.min((normalizedSlope + emaTrendFactor) / 2, 1);
  }

  // Расчет MACD
  calculateMACD(prices) {
    if (!prices || prices.length < this.params.longPeriod) return 'NEUTRAL';
    
    const closePrices = prices.map(candle => candle.close);
    
    // Параметры MACD
    const fastPeriod = 12;
    const slowPeriod = 26;
    const signalPeriod = 9;
    
    // Расчет EMA
    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);
    
    if (fastEMA.length < signalPeriod || slowEMA.length < signalPeriod) return 'NEUTRAL';
    
    // Расчет линии MACD
    const macdLine = [];
    const minLength = Math.min(fastEMA.length, slowEMA.length);
    for (let i = 0; i < minLength; i++) {
      macdLine.push(fastEMA[fastEMA.length - minLength + i] - slowEMA[slowEMA.length - minLength + i]);
    }
    
    // Расчет сигнальной линии (EMA от MACD)
    const signalLine = this.calculateSimpleEMA(macdLine, signalPeriod);
    
    if (signalLine.length < 3) return 'NEUTRAL';
    
    // Получаем последние значения для определения сигнала
    const lastMACD = macdLine[macdLine.length - 1];
    const prevMACD = macdLine[macdLine.length - 2];
    const lastSignal = signalLine[signalLine.length - 1];
    const prevSignal = signalLine[signalLine.length - 2];
    
    // Определение сигнала
    if (lastMACD > lastSignal && prevMACD <= prevSignal) {
      return 'BUY'; // Бычье пересечение
    } else if (lastMACD < lastSignal && prevMACD >= prevSignal) {
      return 'SELL'; // Медвежье пересечение
    } else if (lastMACD > 0 && lastSignal > 0) {
      return 'BULLISH'; // Позитивная зона
    } else if (lastMACD < 0 && lastSignal < 0) {
      return 'BEARISH'; // Негативная зона
    }
    
    return 'NEUTRAL';
  }

  // Расчет RSI
  calculateRSI(prices) {
    if (!prices || prices.length < this.params.shortPeriod + 1) return 50;
    
    const period = this.params.shortPeriod;
    const closePrices = prices.map(candle => candle.close);
    
    // Берем последние N+1 цен для расчета RSI
    const recentPrices = closePrices.slice(-(period + 1));
    
    let gains = 0;
    let losses = 0;
    
    // Рассчитываем средние приросты и убытки
    for (let i = 1; i < recentPrices.length; i++) {
      const change = recentPrices[i] - recentPrices[i - 1];
      if (change >= 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }
    
    // Средние значения
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    // Расчет RS и RSI
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
  }

  // Расчет ширины полос Боллинджера
  calculateBollingerBands(prices) {
    if (!prices || prices.length < this.params.shortPeriod) return 1.0;
    
    const period = this.params.shortPeriod;
    const multiplier = 2.0; // Стандартное отклонение (2 - 95% доверительный интервал)
    
    // Берем последние N цен
    const recentPrices = prices.slice(-period);
    const closePrices = recentPrices.map(candle => candle.close);
    
    // Средняя цена (SMA)
    const sma = closePrices.reduce((sum, price) => sum + price, 0) / period;
    
    // Расчет стандартного отклонения
    const squaredDifferences = closePrices.map(price => Math.pow(price - sma, 2));
    const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    // Верхняя и нижняя полосы
    const upperBand = sma + (multiplier * standardDeviation);
    const lowerBand = sma - (multiplier * standardDeviation);
    
    // Ширина полос (% от средней цены)
    const bandWidth = ((upperBand - lowerBand) / sma) * 100;
    
    return bandWidth;
  }

  // Вспомогательная функция для расчета EMA
  calculateEMA(prices, period) {
    if (prices.length < period) {
      return [];
    }
    
    const closePrices = prices.map(candle => candle.close);
    const k = 2 / (period + 1);
    const emaData = [];
    
    // Инициализация EMA на основе SMA для первых n элементов
    let sma = 0;
    for (let i = 0; i < period; i++) {
      sma += closePrices[i];
    }
    sma /= period;
    emaData.push(sma);
    
    // Расчет EMA для остальных элементов
    for (let i = period; i < closePrices.length; i++) {
      const ema = closePrices[i] * k + emaData[emaData.length - 1] * (1 - k);
      emaData.push(ema);
    }
    
    return emaData;
  }

  // Вспомогательная функция для расчета EMA от любого массива
  calculateSimpleEMA(data, period) {
    if (data.length < period) {
      return [];
    }
    
    const k = 2 / (period + 1);
    const emaData = [];
    
    // Инициализация EMA на основе SMA для первых n элементов
    let sma = 0;
    for (let i = 0; i < period; i++) {
      sma += data[i];
    }
    sma /= period;
    emaData.push(sma);
    
    // Расчет EMA для остальных элементов
    for (let i = period; i < data.length; i++) {
      const ema = data[i] * k + emaData[emaData.length - 1] * (1 - k);
      emaData.push(ema);
    }
    
    return emaData;
  }
}

module.exports = MarketAnalyzer;
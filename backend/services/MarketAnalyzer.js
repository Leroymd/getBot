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

  // Обновление исторических данных с поддержкой callback
  updateHistoricalData(timeframe = '1h', callback) {
    // Получаем данные только если с последнего обновления прошло достаточно времени
    const now = Date.now();
    if (now - this.historicalData.timestamp < 5 * 60 * 1000 && 
        this.historicalData.hourlyPrices && 
        this.historicalData.hourlyPrices.length > 0) {
      return callback(null, this.historicalData); // Используем кэшированные данные
    }
    
    // Получаем часовые и минутные свечи для разных типов анализа
    this.api.getKlines(this.symbol, timeframe || '1h', 100, (err, hourlyKlines) => {
      if (err) {
        return callback(err);
      }
      
      // Для быстрых рыночных условий получаем также 5-минутные свечи
      this.api.getKlines(this.symbol, '5m', 288, (minErr, minuteKlines) => {
        try {
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
            if (!minErr && minuteKlines && minuteKlines.data && Array.isArray(minuteKlines.data)) {
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
            
            callback(null, this.historicalData);
          } else {
            callback(new Error(`No valid data for ${this.symbol}`));
          }
        } catch (parseError) {
          callback(parseError);
        }
      });
    });
  }

  // Анализ рыночных условий для выбора стратегии с поддержкой callback
  analyzeMarketConditions(timeframe = '1h', callback) {
    this.updateHistoricalData(timeframe, (err, data) => {
      if (err) {
        return callback(err);
      }
      
      const { hourlyPrices, minutePrices } = data;
      
      if (!hourlyPrices || hourlyPrices.length < this.params.longPeriod) {
        return callback(new Error(`Insufficient historical data for ${this.symbol}`));
      }
      
      try {
        // Расчет метрик на основе часовых данных
        const volatility = this.calculateVolatility(hourlyPrices);
        const volumeRatio = this.calculateVolumeRatio(hourlyPrices);
        const trendStrength = this.calculateTrendStrength(hourlyPrices);
        const macdSignal = this.calculateMACD(hourlyPrices);
        const rsiValue = this.calculateRSI(hourlyPrices);
        const bbWidth = this.calculateBollingerBands(hourlyPrices);
        
        // Новые метрики для улучшенного рейтинга
        const priceAction = this.analyzePriceAction(hourlyPrices);
        const support = this.findSupportLevel(hourlyPrices);
        const resistance = this.findResistanceLevel(hourlyPrices);
        const volumeProfile = this.analyzeVolumeProfile(hourlyPrices);
        const marketCycle = this.determineMarketCycle(hourlyPrices);
        
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
        
        // Коррекция confidence на основе анализа объема
        if (volumeProfile.consistent) {
          confidence *= 1.1; // Повышаем, если объемы стабильны
        }
        
        // Коррекция на основе близости к уровням поддержки/сопротивления
        const lastPrice = hourlyPrices[hourlyPrices.length - 1].close;
        const supportDist = Math.abs((lastPrice - support) / lastPrice * 100);
        const resistanceDist = Math.abs((resistance - lastPrice) / lastPrice * 100);
        
        if (supportDist < 1.0 || resistanceDist < 1.0) {
          // Цена близко к уровню поддержки/сопротивления - повышенная вероятность отскока
          confidence *= 1.05;
        }
        
        // Ограничиваем уверенность минимальным и максимальным значениями
        if (confidence < 0.5) confidence = 0.5;
        if (confidence > 0.95) confidence = 0.95;
        
        // Формируем результат
        const result = {
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
          },
          priceAction,
          supportLevel: support,
          resistanceLevel: resistance,
          volumeProfile,
          marketCycle,
          timeframe
        };
        
        callback(null, result);
      } catch (analysisErr) {
        callback(analysisErr);
      }
    });
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

  // Анализ структуры ценовых движений
  analyzePriceAction(prices) {
    if (!prices || prices.length < 20) return { pattern: 'UNKNOWN', strength: 0 };
    
    const recentPrices = prices.slice(-20);
    const closes = recentPrices.map(p => p.close);
    const highs = recentPrices.map(p => p.high);
    const lows = recentPrices.map(p => p.low);
    
    // Проверка на различные паттерны свечей
    
    // Проверка на двойное дно
    const doubleButtom = this._checkDoubleButtom(lows);
    
    // Проверка на двойная вершина
    const doubleTop = this._checkDoubleTop(highs);
    
    // Тренд последних N свечей
    const recentTrend = this._calculateRecentTrend(closes);
    
    // Размер тела свечей
    const bodySizes = recentPrices.map(p => Math.abs(p.close - p.open) / ((p.high - p.low) || 1));
    const avgBodySize = bodySizes.reduce((sum, size) => sum + size, 0) / bodySizes.length;
    
    // Определяем доминирующий паттерн
    let pattern = 'MIXED';
    let strength = 0.5;
    
    if (doubleButtom.detected) {
      pattern = 'DOUBLE_BOTTOM';
      strength = doubleButtom.strength;
    } else if (doubleTop.detected) {
      pattern = 'DOUBLE_TOP';
      strength = doubleTop.strength;
    } else if (recentTrend.strength > 0.7) {
      pattern = recentTrend.direction === 'UP' ? 'STRONG_UPTREND' : 'STRONG_DOWNTREND';
      strength = recentTrend.strength;
    } else if (avgBodySize < 0.3) {
      pattern = 'INDECISION';
      strength = 1 - avgBodySize;
    }
    
    return {
      pattern,
      strength,
      details: {
        recentTrend,
        avgBodySize
      }
    };
  }

  // Поиск уровня поддержки
  findSupportLevel(prices) {
    if (!prices || prices.length < 20) return 0;
    
    const lows = prices.map(p => p.low);
    
    // Находим локальные минимумы
    const localMins = [];
    for (let i = 2; i < lows.length - 2; i++) {
      if (lows[i] < lows[i-1] && lows[i] < lows[i-2] &&
          lows[i] < lows[i+1] && lows[i] < lows[i+2]) {
        localMins.push({
          index: i,
          value: lows[i]
        });
      }
    }
    
    // Если не найдены локальные минимумы, возвращаем минимальное значение
    if (localMins.length === 0) {
      return Math.min(...lows);
    }
    
    // Группируем близкие минимумы для выявления уровней поддержки
    const levels = [];
    const tolerance = 0.005; // 0.5% допуск
    
    for (const min of localMins) {
      let foundLevel = false;
      for (const level of levels) {
        // Проверяем, находится ли минимум близко к существующему уровню
        if (Math.abs(min.value - level.value) / level.value < tolerance) {
          level.count++;
          level.sum += min.value;
          level.value = level.sum / level.count; // Обновляем среднее значение
          foundLevel = true;
          break;
        }
      }
      
      if (!foundLevel) {
        levels.push({
          value: min.value,
          count: 1,
          sum: min.value
        });
      }
    }
    
    // Сортируем уровни по количеству точек соприкосновения
    levels.sort((a, b) => b.count - a.count);
    
    // Возвращаем самый сильный уровень поддержки
    return levels.length > 0 ? levels[0].value : Math.min(...lows);
  }

  // Поиск уровня сопротивления
  findResistanceLevel(prices) {
    if (!prices || prices.length < 20) return 0;
    
    const highs = prices.map(p => p.high);
    
    // Находим локальные максимумы
    const localMaxs = [];
    for (let i = 2; i < highs.length - 2; i++) {
      if (highs[i] > highs[i-1] && highs[i] > highs[i-2] &&
          highs[i] > highs[i+1] && highs[i] > highs[i+2]) {
        localMaxs.push({
          index: i,
          value: highs[i]
        });
      }
    }
    
    // Если не найдены локальные максимумы, возвращаем максимальное значение
    if (localMaxs.length === 0) {
      return Math.max(...highs);
    }
    
    // Группируем близкие максимумы для выявления уровней сопротивления
    const levels = [];
    const tolerance = 0.005; // 0.5% допуск
    
    for (const max of localMaxs) {
      let foundLevel = false;
      for (const level of levels) {
        // Проверяем, находится ли максимум близко к существующему уровню
        if (Math.abs(max.value - level.value) / level.value < tolerance) {
          level.count++;
          level.sum += max.value;
          level.value = level.sum / level.count; // Обновляем среднее значение
          foundLevel = true;
          break;
        }
      }
      
      if (!foundLevel) {
        levels.push({
          value: max.value,
          count: 1,
          sum: max.value
        });
      }
    }
    
    // Сортируем уровни по количеству точек соприкосновения
    levels.sort((a, b) => b.count - a.count);
    
    // Возвращаем самый сильный уровень сопротивления
    return levels.length > 0 ? levels[0].value : Math.max(...highs);
  }

  // Анализ объемного профиля
  analyzeVolumeProfile(prices) {
    if (!prices || prices.length < 10) {
      return {
        consistent: false,
        risingSellVolume: false,
        risingBuyVolume: false,
        volumeTrend: 'NEUTRAL'
      };
    }
    
    // Анализируем последние 20 периодов
    const recentPrices = prices.slice(-20);
    
    // Разделяем свечи на растущие и падающие
    const upCandles = recentPrices.filter(p => p.close > p.open);
    const downCandles = recentPrices.filter(p => p.close <= p.open);
    
    // Средний объем на растущих и падающих свечах
    const avgUpVolume = upCandles.reduce((sum, p) => sum + p.volume, 0) / (upCandles.length || 1);
    const avgDownVolume = downCandles.reduce((sum, p) => sum + p.volume, 0) / (downCandles.length || 1);
    
    // Сравниваем средние объемы за первую и вторую половины периода
    const firstHalf = recentPrices.slice(0, 10);
    const secondHalf = recentPrices.slice(10);
    
    const avgVolumeFirstHalf = firstHalf.reduce((sum, p) => sum + p.volume, 0) / firstHalf.length;
    const avgVolumeSecondHalf = secondHalf.reduce((sum, p) => sum + p.volume, 0) / secondHalf.length;
    
    // Определяем тренд объемов
    let volumeTrend = 'NEUTRAL';
    if (avgVolumeSecondHalf > avgVolumeFirstHalf * 1.2) {
      volumeTrend = 'RISING';
    } else if (avgVolumeSecondHalf < avgVolumeFirstHalf * 0.8) {
      volumeTrend = 'FALLING';
    }
    
    // Проверяем консистентность объемов
    // (отклонение от среднего не более 50%)
    const volumes = recentPrices.map(p => p.volume);
    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    const volumeConsistency = volumes.every(v => Math.abs(v - avgVolume) / avgVolume < 0.5);
    
    return {
      consistent: volumeConsistency,
      avgUpVolume,
      avgDownVolume,
      volumeDistribution: avgUpVolume > avgDownVolume * 1.2 ? 'BULLISH' : 
                          avgDownVolume > avgUpVolume * 1.2 ? 'BEARISH' : 'NEUTRAL',
      volumeTrend,
      risingSellVolume: downCandles.length > 0 && 
                         avgDownVolume > avgVolumeFirstHalf * 1.2,
      risingBuyVolume: upCandles.length > 0 && 
                       avgUpVolume > avgVolumeFirstHalf * 1.2,
    };
  }

  // Определение текущей фазы рыночного цикла
  determineMarketCycle(prices) {
    if (!prices || prices.length < 50) {
      return {
        phase: 'UNKNOWN',
        confidence: 0
      };
    }
    
    // Получаем RSI и другие индикаторы для анализа
    const rsi = this.calculateRSI(prices);
    const bbWidth = this.calculateBollingerBands(prices);
    const trendStrength = this.calculateTrendStrength(prices);
    
    // Определение фазы цикла
    let phase = 'UNKNOWN';
    let confidence = 0.5;
    
    const lastPrice = prices[prices.length - 1].close;
    const startPrice = prices[0].close;
    const overallTrend = lastPrice > startPrice ? 'UP' : 'DOWN';
    
    if (overallTrend === 'UP') {
      if (rsi < 30) {
        phase = 'ACCUMULATION';
        confidence = 0.7 + (30 - rsi) / 100;
      } else if (rsi > 70 && trendStrength > 0.7) {
        phase = 'MARKUP';
        confidence = 0.7 + (rsi - 70) / 100;
      } else if (rsi > 50 && rsi < 70 && bbWidth < 1.0) {
        phase = 'DISTRIBUTION';
        confidence = 0.6;
      }
    } else { // DOWN trend
      if (rsi > 70) {
        phase = 'DISTRIBUTION';
        confidence = 0.7 + (rsi - 70) / 100;
      } else if (rsi < 30 && trendStrength > 0.7) {
        phase = 'MARKDOWN';
        confidence = 0.7 + (30 - rsi) / 100;
      } else if (rsi > 30 && rsi < 50 && bbWidth < 1.0) {
        phase = 'ACCUMULATION';
        confidence = 0.6;
      }
    }
    
    // Если фаза не определена, используем нейтральную
    if (phase === 'UNKNOWN') {
      if (bbWidth < 0.8 && rsi > 40 && rsi < 60) {
        phase = 'CONSOLIDATION';
        confidence = 0.6 + (1 - bbWidth) / 2;
      } else {
        phase = 'TRANSITION';
        confidence = 0.5;
      }
    }
    
    // Ограничение confidence
    if (confidence > 0.95) confidence = 0.95;
    
    return {
      phase,
      confidence,
      details: {
        rsi,
        bbWidth,
        trendStrength,
        overallTrend
      }
    };
  }

  // Вспомогательные методы для анализа паттернов
  _checkDoubleButtom(lows) {
    if (lows.length < 10) return { detected: false, strength: 0 };
    
    const recentLows = lows.slice(-10);
    
    // Находим два локальных минимума
    let minIndices = [];
    for (let i = 1; i < recentLows.length - 1; i++) {
      if (recentLows[i] < recentLows[i-1] && recentLows[i] < recentLows[i+1]) {
        minIndices.push(i);
      }
    }
    
    // Для двойного дна нужно минимум два локальных минимума
    if (minIndices.length < 2) {
      return { detected: false, strength: 0 };
    }
    
    // Проверяем разницу между минимумами (не должна превышать 5%)
    const min1 = recentLows[minIndices[0]];
    const min2 = recentLows[minIndices[1]];
    
    const difference = Math.abs(min1 - min2) / ((min1 + min2) / 2);
    
    if (difference < 0.05 && minIndices[1] - minIndices[0] >= 3) {
      // Находим максимум между минимумами
      const inBetween = recentLows.slice(minIndices[0], minIndices[1]);
      const maxInBetween = Math.max(...inBetween);
      
      // Расстояние между максимумом и минимумами
      const height = (maxInBetween - Math.min(min1, min2)) / Math.min(min1, min2);
      
      // Чем больше расстояние между минимумами и максимумом, тем сильнее паттерн
      const strength = Math.min(0.95, 0.5 + height * 2);
      
      return {
        detected: true,
        strength,
        min1,
        min2,
        distance: minIndices[1] - minIndices[0]
      };
    }
    
    return { detected: false, strength: 0 };
  }

  _checkDoubleTop(highs) {
    if (highs.length < 10) return { detected: false, strength: 0 };
    
    const recentHighs = highs.slice(-10);
    
    // Находим два локальных максимума
    let maxIndices = [];
    for (let i = 1; i < recentHighs.length - 1; i++) {
      if (recentHighs[i] > recentHighs[i-1] && recentHighs[i] > recentHighs[i+1]) {
        maxIndices.push(i);
      }
    }
    
    // Для двойной вершины нужно минимум два локальных максимума
    if (maxIndices.length < 2) {
      return { detected: false, strength: 0 };
    }
    
    // Проверяем разницу между максимумами (не должна превышать 5%)
    const max1 = recentHighs[maxIndices[0]];
    const max2 = recentHighs[maxIndices[1]];
    
    const difference = Math.abs(max1 - max2) / ((max1 + max2) / 2);
    
    if (difference < 0.05 && maxIndices[1] - maxIndices[0] >= 3) {
      // Находим минимум между максимумами
      const inBetween = recentHighs.slice(maxIndices[0], maxIndices[1]);
      const minInBetween = Math.min(...inBetween);
      
      // Расстояние между минимумом и максимумами
      const height = (Math.max(max1, max2) - minInBetween) / minInBetween;
      
      // Чем больше расстояние между максимумами и минимумом, тем сильнее паттерн
      const strength = Math.min(0.95, 0.5 + height * 2);
      
      return {
        detected: true,
        strength,
        max1,
        max2,
        distance: maxIndices[1] - maxIndices[0]
      };
    }
    
    return { detected: false, strength: 0 };
  }

  _calculateRecentTrend(prices) {
    if (prices.length < 5) return { direction: 'NEUTRAL', strength: 0 };
    
    // Используем последние 5 ценовых точек
    const recent = prices.slice(-5);
    
    // Линейная регрессия для определения тренда
    const xValues = [0, 1, 2, 3, 4];
    const n = 5;
    
    const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
    const yMean = recent.reduce((sum, y) => sum + y, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      const xDiff = xValues[i] - xMean;
      const yDiff = recent[i] - yMean;
      numerator += xDiff * yDiff;
      denominator += xDiff * xDiff;
    }
    
    // Наклон линии тренда
    const slope = denominator !== 0 ? numerator / denominator : 0;
    
    // Направление тренда
    const direction = slope > 0 ? 'UP' : slope < 0 ? 'DOWN' : 'NEUTRAL';
    
    // Сила тренда (нормализованная)
    const maxSlope = Math.max(...recent) - Math.min(...recent);
    const strength = Math.min(0.95, Math.abs(slope) / (maxSlope || 1));
    
    return {
      direction,
      strength,
      slope
    };
  }
}

module.exports = MarketAnalyzer;
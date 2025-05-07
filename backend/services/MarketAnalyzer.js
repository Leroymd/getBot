// backend/services/MarketAnalyzer.js - Полностью исправленная версия

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
    
    // Параметры анализа рынка
    this.params = {
      shortPeriod: 14,  // Короткий период для индикаторов
      longPeriod: 50,   // Длинный период для индикаторов (уменьшен с 100)
      volumeWindow: 24, // Окно для анализа объема (часов)
      volatilityWindow: 24 // Окно для анализа волатильности (часов)
    };
    
    console.log(`MarketAnalyzer created for ${symbol}`);
  }

  // Обновление исторических данных с поддержкой callback и устойчивостью к ошибкам
  updateHistoricalData(timeframe = '1h', callback) {
    // Проверяем, что callback - это функция
    if (typeof callback !== 'function') {
      console.error(`Invalid callback provided to updateHistoricalData for ${this.symbol}`);
      return;
    }
    
    // Получаем данные только если с последнего обновления прошло достаточно времени
    const now = Date.now();
    if (now - this.historicalData.timestamp < 5 * 60 * 1000 && 
        this.historicalData.hourlyPrices && 
        this.historicalData.hourlyPrices.length > 0) {
      return callback(null, this.historicalData); // Используем кэшированные данные
    }
    
    console.log(`Updating historical data for ${this.symbol} using timeframe ${timeframe}`);
    
    // Функция для создания синтетических данных в случае ошибки
    const createSyntheticData = () => {
      console.log(`Creating synthetic data for ${this.symbol}`);
      const hourlyPrices = [];
      const minutePrices = [];
      
      // Базовая цена и объем для синтетических данных
      const basePrice = 1000;
      const baseVolume = 100;
      
      // Генерируем 100 часовых свечей
      for (let i = 0; i < 100; i++) {
        const time = now - (100 - i) * 60 * 60 * 1000;
        const randomFactor = 0.9 + Math.random() * 0.2; // 0.9 - 1.1
        
        hourlyPrices.push({
          time,
          open: basePrice * randomFactor,
          high: basePrice * randomFactor * 1.02,
          low: basePrice * randomFactor * 0.98,
          close: basePrice * randomFactor * (0.99 + Math.random() * 0.02),
          volume: baseVolume * (0.8 + Math.random() * 0.4)
        });
      }
      
      // Генерируем 288 минутных свечей (24 часа по 12 5-минутных свечей)
      for (let i = 0; i < 288; i++) {
        const time = now - (288 - i) * 5 * 60 * 1000;
        const randomFactor = 0.95 + Math.random() * 0.1; // 0.95 - 1.05
        
        minutePrices.push({
          time,
          open: basePrice * randomFactor,
          high: basePrice * randomFactor * 1.01,
          low: basePrice * randomFactor * 0.99,
          close: basePrice * randomFactor * (0.995 + Math.random() * 0.01),
          volume: baseVolume * 0.05 * (0.8 + Math.random() * 0.4)
        });
      }
      
      return {
        hourlyPrices,
        minutePrices,
        timestamp: now,
        synthetic: true
      };
    };
    
    // Получаем часовые и минутные свечи с обработкой ошибок
    try {
      this.api.getKlines(this.symbol, timeframe || '1h', 100, (err, hourlyKlines) => {
        if (err) {
          console.warn(`Error getting hourly klines for ${this.symbol}:`, err.message);
          // Возвращаем синтетические данные
          const syntheticData = createSyntheticData();
          this.historicalData = syntheticData;
          return callback(null, syntheticData);
        }
        
        // Проверяем наличие данных
        if (!hourlyKlines || !hourlyKlines.data || !Array.isArray(hourlyKlines.data) || hourlyKlines.data.length === 0) {
          console.warn(`No hourly kline data available for ${this.symbol}`);
          // Возвращаем синтетические данные
          const syntheticData = createSyntheticData();
          this.historicalData = syntheticData;
          return callback(null, syntheticData);
        }
        
        // Обработка часовых свечей
        const hourlyPrices = [];
        try {
          for (const candle of hourlyKlines.data) {
            if (candle && candle.length >= 6) {
              hourlyPrices.push({
                time: parseInt(candle[0]),
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5])
              });
            }
          }
        } catch (parseError) {
          console.error(`Error parsing hourly klines for ${this.symbol}:`, parseError);
          // Продолжаем, даже если не все свечи удалось распарсить
        }
        
        // Если часовых свечей недостаточно, возвращаем синтетические данные
        if (hourlyPrices.length < 10) {
          console.warn(`Insufficient hourly kline data for ${this.symbol}: ${hourlyPrices.length} candles`);
          const syntheticData = createSyntheticData();
          this.historicalData = syntheticData;
          return callback(null, syntheticData);
        }
        
        // Для минутных свечей пробуем получить 5-минутные данные
        this.api.getKlines(this.symbol, '5m', 288, (minErr, minuteKlines) => {
          let minutePrices = [];
          
          if (!minErr && minuteKlines && minuteKlines.data && Array.isArray(minuteKlines.data)) {
            try {
              for (const candle of minuteKlines.data) {
                if (candle && candle.length >= 6) {
                  minutePrices.push({
                    time: parseInt(candle[0]),
                    open: parseFloat(candle[1]),
                    high: parseFloat(candle[2]),
                    low: parseFloat(candle[3]),
                    close: parseFloat(candle[4]),
                    volume: parseFloat(candle[5])
                  });
                }
              }
            } catch (parseError) {
              console.error(`Error parsing minute klines for ${this.symbol}:`, parseError);
              // Продолжаем, даже если не все свечи удалось распарсить
            }
          }
          
          // Если минутных свечей нет, генерируем их на основе часовых
          if (minutePrices.length === 0) {
            console.log(`No minute data available for ${this.symbol}, generating from hourly data`);
            
            // Генерируем 12 5-минутных свечей на каждую часовую
            for (const hourlyCandle of hourlyPrices) {
              const hourVolume = hourlyCandle.volume;
              const hourStart = hourlyCandle.time;
              
              for (let i = 0; i < 12; i++) {
                const minuteTime = hourStart + i * 5 * 60 * 1000;
                const randomFactor = 0.98 + Math.random() * 0.04; // 0.98 - 1.02
                
                minutePrices.push({
                  time: minuteTime,
                  open: hourlyCandle.open * randomFactor,
                  high: hourlyCandle.high * randomFactor,
                  low: hourlyCandle.low * randomFactor,
                  close: hourlyCandle.close * randomFactor,
                  volume: hourVolume / 12 * (0.8 + Math.random() * 0.4)
                });
              }
            }
          }
          
          // Сохраняем обработанные данные
          this.historicalData = {
            hourlyPrices,
            minutePrices,
            timestamp: now
          };
          
          callback(null, this.historicalData);
        });
      });
    } catch (requestError) {
      console.error(`Error requesting klines for ${this.symbol}:`, requestError);
      // Возвращаем синтетические данные
      const syntheticData = createSyntheticData();
      this.historicalData = syntheticData;
      return callback(null, syntheticData);
    }
  }

  // Анализ рыночных условий для выбора стратегии с поддержкой callback и устойчивостью к ошибкам
  analyzeMarketConditions(timeframe = '1h', callback) {
    // Проверяем, что callback - это функция
    if (typeof callback !== 'function') {
      console.error(`Invalid callback provided to analyzeMarketConditions for ${this.symbol}`);
      return;
    }
    
    console.log(`Analyzing market conditions for ${this.symbol} on timeframe ${timeframe}`);
    
    // Функция для создания базового результата
    const createBaseResult = () => ({
      recommendedStrategy: 'DCA',
      marketType: 'RANGING',
      volatility: 1.5,
      volumeRatio: 1.0,
      trendStrength: 0.5,
      confidence: 0.6,
      indicators: {
        rsi: 50,
        macd: 'NEUTRAL',
        bollingerWidth: 1.5,
      },
      priceAction: {
        pattern: 'MIXED',
        strength: 0.5
      },
      supportLevel: 0,
      resistanceLevel: 0,
      volumeProfile: {
        consistent: true,
        volumeDistribution: 'NEUTRAL',
        volumeTrend: 'NEUTRAL'
      },
      marketCycle: {
        phase: 'UNKNOWN',
        confidence: 0.5
      },
      timeframe
    });
    
    this.updateHistoricalData(timeframe, (err, data) => {
      if (err) {
        console.error(`Error updating historical data for ${this.symbol}:`, err);
        return callback(null, createBaseResult());
      }
      
      if (!data) {
        console.warn(`No historical data returned for ${this.symbol}`);
        return callback(null, createBaseResult());
      }
      
      const { hourlyPrices, minutePrices, synthetic } = data;
      
      // Если данные синтетические, возвращаем базовый результат
      if (synthetic) {
        console.log(`Using synthetic data for analysis of ${this.symbol}`);
        return callback(null, {
          ...createBaseResult(),
          synthetic: true
        });
      }
      
      // Проверяем наличие достаточного количества данных
      if (!hourlyPrices || hourlyPrices.length < this.params.shortPeriod) {
        console.warn(`Insufficient historical data for ${this.symbol}: ${hourlyPrices ? hourlyPrices.length : 0} candles`);
        return callback(null, createBaseResult());
      }
      
      try {
        // Расчет метрик на основе часовых данных
        let volatility = 0;
        let volumeRatio = 1.0;
        let trendStrength = 0.5;
        let macdSignal = 'NEUTRAL';
        let rsiValue = 50;
        let bbWidth = 1.5;
        
        try {
          volatility = this.calculateVolatility(hourlyPrices);
        } catch (volatilityError) {
          console.error(`Error calculating volatility for ${this.symbol}:`, volatilityError);
        }
        
        try {
          volumeRatio = this.calculateVolumeRatio(hourlyPrices);
        } catch (volumeError) {
          console.error(`Error calculating volume ratio for ${this.symbol}:`, volumeError);
        }
        
        try {
          trendStrength = this.calculateTrendStrength(hourlyPrices);
        } catch (trendError) {
          console.error(`Error calculating trend strength for ${this.symbol}:`, trendError);
        }
        
        try {
          macdSignal = this.calculateMACD(hourlyPrices);
        } catch (macdError) {
          console.error(`Error calculating MACD for ${this.symbol}:`, macdError);
        }
        
        try {
          rsiValue = this.calculateRSI(hourlyPrices);
        } catch (rsiError) {
          console.error(`Error calculating RSI for ${this.symbol}:`, rsiError);
        }
        
        try {
          bbWidth = this.calculateBollingerBands(hourlyPrices);
        } catch (bbError) {
          console.error(`Error calculating Bollinger Bands for ${this.symbol}:`, bbError);
        }
        
        // Новые метрики для улучшенного рейтинга
        let priceAction = { pattern: 'MIXED', strength: 0.5 };
        let support = 0;
        let resistance = 0;
        let volumeProfile = {
          consistent: true,
          volumeDistribution: 'NEUTRAL',
          volumeTrend: 'NEUTRAL'
        };
        let marketCycle = {
          phase: 'UNKNOWN',
          confidence: 0.5
        };
        
        try {
          priceAction = this.analyzePriceAction(hourlyPrices);
        } catch (priceActionError) {
          console.error(`Error analyzing price action for ${this.symbol}:`, priceActionError);
        }
        
        try {
          support = this.findSupportLevel(hourlyPrices);
        } catch (supportError) {
          console.error(`Error finding support level for ${this.symbol}:`, supportError);
        }
        
        try {
          resistance = this.findResistanceLevel(hourlyPrices);
        } catch (resistanceError) {
          console.error(`Error finding resistance level for ${this.symbol}:`, resistanceError);
        }
        
        try {
          volumeProfile = this.analyzeVolumeProfile(hourlyPrices);
        } catch (volumeProfileError) {
          console.error(`Error analyzing volume profile for ${this.symbol}:`, volumeProfileError);
        }
        
        try {
          marketCycle = this.determineMarketCycle(hourlyPrices);
        } catch (marketCycleError) {
          console.error(`Error determining market cycle for ${this.symbol}:`, marketCycleError);
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
        
        // Коррекция confidence на основе анализа объема
        if (volumeProfile.consistent) {
          confidence *= 1.1; // Повышаем, если объемы стабильны
        }
        
        // Коррекция на основе близости к уровням поддержки/сопротивления
        const lastPrice = hourlyPrices[hourlyPrices.length - 1].close;
        
        if (support > 0 && resistance > 0) {
          const supportDist = Math.abs((lastPrice - support) / lastPrice * 100);
          const resistanceDist = Math.abs((resistance - lastPrice) / lastPrice * 100);
          
          if (supportDist < 1.0 || resistanceDist < 1.0) {
            // Цена близко к уровню поддержки/сопротивления - повышенная вероятность отскока
            confidence *= 1.05;
          }
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
          timeframe,
          lastPrice
        };
        
        callback(null, result);
      } catch (analysisErr) {
        console.error(`Error analyzing market conditions for ${this.symbol}:`, analysisErr);
        callback(null, createBaseResult());
      }
    });
  }

  // Генерация торговых сигналов на основе анализа рынка
  generateTradingSignals(timeframe = '1h', callback) {
    // Проверяем, что callback - это функция
    if (typeof callback !== 'function') {
      console.error(`Invalid callback provided to generateTradingSignals for ${this.symbol}`);
      return;
    }
    
    console.log(`Generating trading signals for ${this.symbol} on timeframe ${timeframe}`);
    
    // Получаем анализ рыночных условий
    this.analyzeMarketConditions(timeframe, (analyzeErr, analysis) => {
      if (analyzeErr) {
        console.error(`Error analyzing market conditions for signals: ${analyzeErr.message}`);
        return callback(null, {
          action: 'HOLD',
          confidence: 0.5,
          entryPrice: 0,
          stopLoss: 0,
          takeProfit: 0,
          reason: 'Error analyzing market conditions',
          timestamp: Date.now(),
          timeframe,
          synthetic: true
        });
      }
      
      try {
        // Функция для создания синтетических сигналов
        const createBaseSignal = () => ({
          action: 'HOLD',
          confidence: 0.5,
          entryPrice: 0,
          stopLoss: 0,
          takeProfit: 0,
          reason: 'Insufficient data for signal generation',
          timestamp: Date.now(),
          timeframe,
          synthetic: true
        });
        
        // Если это синтетические данные анализа, возвращаем базовый сигнал
        if (analysis.synthetic) {
          console.log(`Using synthetic analysis data for signals on ${this.symbol}`);
          return callback(null, createBaseSignal());
        }
        
        // Получаем данные исторических цен
        const { hourlyPrices } = this.historicalData;
        
        // Проверяем наличие исторических данных
        if (!hourlyPrices || hourlyPrices.length < 10) {
          console.warn(`Insufficient historical data for signal generation on ${this.symbol}`);
          return callback(null, createBaseSignal());
        }
        
        // Получаем последнюю цену закрытия
        const lastPrice = hourlyPrices[hourlyPrices.length - 1].close;
        
        // Анализируем индикаторы
        const { 
          marketType, 
          volatility, 
          trendStrength, 
          indicators, 
          priceAction,
          supportLevel,
          resistanceLevel
        } = analysis;
        
        // Значения индикаторов
        const { rsi, macd, bollingerWidth } = indicators;
        
        // Определяем торговый сигнал на основе анализа
        let action = 'HOLD';
        let confidence = 0.5;
        let reason = 'Market conditions are neutral';
        
        // Логика определения сигнала в зависимости от индикаторов и типа рынка
        if (marketType === 'TRENDING') {
          if (trendStrength > 0.7) {
            if (macd === 'BUY' || macd === 'BULLISH') {
              action = 'BUY';
              confidence = Math.min(0.8, 0.5 + trendStrength * 0.5);
              reason = `Strong bullish trend detected (trend strength: ${trendStrength.toFixed(2)})`;
            } else if (macd === 'SELL' || macd === 'BEARISH') {
              action = 'SELL';
              confidence = Math.min(0.8, 0.5 + trendStrength * 0.5);
              reason = `Strong bearish trend detected (trend strength: ${trendStrength.toFixed(2)})`;
            }
          }
        } else if (marketType === 'RANGING') {
          // В боковике ищем перепроданность/перекупленность
          if (rsi < 30) {
            action = 'BUY';
            confidence = Math.min(0.7, 0.5 + (30 - rsi) / 30);
            reason = `Oversold conditions in ranging market (RSI: ${rsi.toFixed(2)})`;
          } else if (rsi > 70) {
            action = 'SELL';
            confidence = Math.min(0.7, 0.5 + (rsi - 70) / 30);
            reason = `Overbought conditions in ranging market (RSI: ${rsi.toFixed(2)})`;
          }
        } else if (marketType === 'VOLATILE') {
          // В волатильном рынке используем уровни поддержки и сопротивления
          if (lastPrice < supportLevel * 1.01 && rsi < 40) {
            action = 'BUY';
            confidence = 0.6;
            reason = `Price near support level in volatile market (Price: ${lastPrice.toFixed(2)}, Support: ${supportLevel.toFixed(2)})`;
          } else if (lastPrice > resistanceLevel * 0.99 && rsi > 60) {
            action = 'SELL';
            confidence = 0.6;
            reason = `Price near resistance level in volatile market (Price: ${lastPrice.toFixed(2)}, Resistance: ${resistanceLevel.toFixed(2)})`;
          }
        }
        
        // Учитываем паттерны ценового действия
        if (priceAction.pattern === 'DOUBLE_BOTTOM' && priceAction.strength > 0.7) {
          action = 'BUY';
          confidence = Math.max(confidence, priceAction.strength);
          reason = `Double bottom pattern detected with strength ${priceAction.strength.toFixed(2)}`;
        } else if (priceAction.pattern === 'DOUBLE_TOP' && priceAction.strength > 0.7) {
          action = 'SELL';
          confidence = Math.max(confidence, priceAction.strength);
          reason = `Double top pattern detected with strength ${priceAction.strength.toFixed(2)}`;
        }
        
        // Расчет уровней стоп-лосс и тейк-профит
        let stopLoss = 0;
        let takeProfit = 0;
        
        if (action === 'BUY') {
          // Для покупки: стоп-лосс ниже текущей цены, тейк-профит выше
          const stopDistance = Math.max(lastPrice * volatility / 100, (lastPrice - supportLevel) * 1.1);
          stopLoss = Math.max(lastPrice - stopDistance, lastPrice * 0.95);
          
          // Тейк-профит: расстояние в зависимости от волатильности и с учетом уровня сопротивления
          const tpDistance = stopDistance * 1.5; // Соотношение риск/доходность 1:1.5
          takeProfit = resistanceLevel > lastPrice ? 
            Math.min(lastPrice + tpDistance, resistanceLevel * 0.99) : 
            lastPrice + tpDistance;
        } else if (action === 'SELL') {
          // Для продажи: стоп-лосс выше текущей цены, тейк-профит ниже
          const stopDistance = Math.max(lastPrice * volatility / 100, (resistanceLevel - lastPrice) * 1.1);
          stopLoss = Math.min(lastPrice + stopDistance, lastPrice * 1.05);
          
          // Тейк-профит: расстояние в зависимости от волатильности и с учетом уровня поддержки
          const tpDistance = stopDistance * 1.5; // Соотношение риск/доходность 1:1.5
          takeProfit = supportLevel < lastPrice ? 
            Math.max(lastPrice - tpDistance, supportLevel * 1.01) : 
            lastPrice - tpDistance;
        }
        
        // Ограничиваем уверенность
        if (confidence < 0.5) confidence = 0.5;
        if (confidence > 0.9) confidence = 0.9;
        
        // Формируем результат
        const signal = {
          action,
          confidence,
          entryPrice: lastPrice,
          stopLoss,
          takeProfit,
          reason,
          timestamp: Date.now(),
          timeframe,
          analysis // Включаем полный анализ для справки
        };
        
        callback(null, signal);
      } catch (signalErr) {
        console.error(`Error generating trading signals for ${this.symbol}:`, signalErr);
        callback(null, {
          action: 'HOLD',
          confidence: 0.5,
          entryPrice: 0,
          stopLoss: 0,
          takeProfit: 0,
          reason: `Error generating signals: ${signalErr.message}`,
          timestamp: Date.now(),
          timeframe,
          synthetic: true
        });
      }
    });
  }

  // Вспомогательные методы расчета индикаторов и метрик
  
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
    
    // Проверка на достаточное количество свечей
    if (period < 5) return 1;
    
    // Объем за весь период (кроме последних 5 свечей)
    const baseVolumes = prices.slice(0, -5).slice(-period);
    
    if (baseVolumes.length === 0) return 1;
    
    const baseAvgVolume = baseVolumes.reduce((sum, price) => sum + price.volume, 0) / baseVolumes.length;
    
    // Объем за последние 5 свечей
    const recentVolumes = prices.slice(-5);
    
    if (recentVolumes.length === 0) return 1;
    
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
    try {
      const shortEMA = this.calculateEMA(recentPrices, this.params.shortPeriod);
      const longEMA = this.calculateEMA(recentPrices, this.params.longPeriod);
      
      // Если нет достаточно данных для расчета длинной EMA
      if (!shortEMA.length || !longEMA.length) return 0.5;
      
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
      const normalizedSlope = maxPossibleSlope > 0 ? Math.abs(slope) / maxPossibleSlope : 0;
      
      // Учитываем отношение EMA при расчете силы тренда
      const emaTrendFactor = Math.abs(emaRatio - 1);
      
      // Комбинированная метрика силы тренда
      return Math.min((normalizedSlope + emaTrendFactor) / 2, 1);
    } catch (error) {
      console.error(`Error in calculateTrendStrength for ${this.symbol}:`, error);
      return 0.5; // Возвращаем среднее значение в случае ошибки
    }
  }

  // Расчет MACD
  calculateMACD(prices) {
    if (!prices || prices.length < this.params.longPeriod) return 'NEUTRAL';
    
    try {
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
    } catch (error) {
      console.error(`Error in calculateMACD for ${this.symbol}:`, error);
      return 'NEUTRAL';
    }
  }

  // Расчет RSI
  calculateRSI(prices) {
    if (!prices || prices.length < this.params.shortPeriod + 1) return 50;
    
    try {
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
    } catch (error) {
      console.error(`Error in calculateRSI for ${this.symbol}:`, error);
      return 50; // Возвращаем нейтральное значение в случае ошибки
    }
  }

  // Расчет ширины полос Боллинджера
  calculateBollingerBands(prices) {
    if (!prices || prices.length < this.params.shortPeriod) return 1.0;
    
    try {
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
    } catch (error) {
      console.error(`Error in calculateBollingerBands for ${this.symbol}:`, error);
      return 1.5; // Возвращаем среднее значение в случае ошибки
    }
  }

  // Вспомогательная функция для расчета EMA
  calculateEMA(prices, period) {
    if (prices.length < period) {
      return [];
    }
    
    try {
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
    } catch (error) {
      console.error(`Error in calculateEMA for ${this.symbol}:`, error);
      return [];
    }
  }

  // Вспомогательная функция для расчета EMA от любого массива
  calculateSimpleEMA(data, period) {
    if (data.length < period) {
      return [];
    }
    
    try {
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
    } catch (error) {
      console.error(`Error in calculateSimpleEMA for ${this.symbol}:`, error);
      return [];
    }
  }

  // Анализ структуры ценовых движений
  analyzePriceAction(prices) {
    if (!prices || prices.length < 20) return { pattern: 'UNKNOWN', strength: 0 };
    
    try {
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
      const avgBodySize = bodySizes.length > 0 ? 
        bodySizes.reduce((sum, size) => sum + size, 0) / bodySizes.length : 0.5;
      
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
    } catch (error) {
      console.error(`Error in analyzePriceAction for ${this.symbol}:`, error);
      return { pattern: 'UNKNOWN', strength: 0.5 };
    }
  }

  // Поиск уровня поддержки
  findSupportLevel(prices) {
    if (!prices || prices.length < 20) return 0;
    
    try {
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
    } catch (error) {
      console.error(`Error in findSupportLevel for ${this.symbol}:`, error);
      return 0;
    }
  }

  // Поиск уровня сопротивления
  findResistanceLevel(prices) {
    if (!prices || prices.length < 20) return 0;
    
    try {
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
    } catch (error) {
      console.error(`Error in findResistanceLevel for ${this.symbol}:`, error);
      return 0;
    }
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
    
    try {
      // Анализируем последние 20 периодов
      const recentPrices = prices.slice(-20);
      
      // Определяем директивность каждой свечи (вверх/вниз)
      const candles = recentPrices.map(p => ({
        isUp: p.close > p.open,
        volume: p.volume,
        range: p.high - p.low,
        bodySize: Math.abs(p.close - p.open),
        time: p.time
      }));
      
      // Группируем объемы по направлению
      const upVolumes = candles.filter(c => c.isUp).map(c => c.volume);
      const downVolumes = candles.filter(c => !c.isUp).map(c => c.volume);
      
      // Рассчитываем средние объемы
      const avgUpVolume = upVolumes.length > 0 ? 
        upVolumes.reduce((sum, vol) => sum + vol, 0) / upVolumes.length : 0;
      const avgDownVolume = downVolumes.length > 0 ? 
        downVolumes.reduce((sum, vol) => sum + vol, 0) / downVolumes.length : 0;
      
      // Проверяем тренд объема
      const volumeTrend = avgUpVolume > avgDownVolume * 1.2 ? 'BULLISH' : 
                          avgDownVolume > avgUpVolume * 1.2 ? 'BEARISH' : 'NEUTRAL';
      
      // Анализируем изменение объема со временем
      const volumeChanges = [];
      for (let i = 1; i < candles.length; i++) {
        volumeChanges.push((candles[i].volume - candles[i-1].volume) / candles[i-1].volume);
      }
      
      // Средний рост объема
      const avgVolumeChange = volumeChanges.length > 0 ? 
        volumeChanges.reduce((sum, change) => sum + change, 0) / volumeChanges.length : 0;
      
      // Проверка консистентности объемов
      const volumeVariance = this._calculateVariance(recentPrices.map(p => p.volume));
      const consistent = volumeVariance < 0.5; // Низкая вариация считается консистентной
      
      // Определяем тренды объема
      const risingBuyVolume = avgUpVolume > 0 && avgVolumeChange > 0 && upVolumes.length >= 2 && 
        upVolumes[upVolumes.length - 1] > upVolumes[0];
      
      const risingSellVolume = avgDownVolume > 0 && avgVolumeChange > 0 && downVolumes.length >= 2 && 
        downVolumes[downVolumes.length - 1] > downVolumes[0];
      
      return {
        consistent,
        risingSellVolume,
        risingBuyVolume,
        volumeTrend,
        volumeDistribution: avgUpVolume > avgDownVolume ? 'BULLISH' : 
                            avgDownVolume > avgUpVolume ? 'BEARISH' : 'NEUTRAL'
      };
    } catch (error) {
      console.error(`Error in analyzeVolumeProfile for ${this.symbol}:`, error);
      return {
        consistent: true,
        risingSellVolume: false,
        risingBuyVolume: false,
        volumeTrend: 'NEUTRAL',
        volumeDistribution: 'NEUTRAL'
      };
    }
  }

  // Определение фазы рыночного цикла
  determineMarketCycle(prices) {
    if (!prices || prices.length < 30) {
      return {
        phase: 'UNKNOWN',
        confidence: 0.5
      };
    }
    
    try {
      // Используем последние 50 свечей для анализа
      const recentPrices = prices.slice(-50);
      const closes = recentPrices.map(p => p.close);
      
      // Рассчитываем 20-периодную и 50-периодную EMA
      const ema20 = this.calculateSimpleEMA(closes, 20);
      const ema50 = this.calculateSimpleEMA(closes, 50);
      
      if (ema20.length === 0 || ema50.length === 0) {
        return { phase: 'UNKNOWN', confidence: 0.5 };
      }
      
      // Получаем последние значения EMA
      const lastEma20 = ema20[ema20.length - 1];
      const lastEma50 = ema50[ema50.length - 1];
      
      // Рассчитываем RSI
      const rsi = this.calculateRSI(recentPrices);
      
      // Рассчитываем стандартное отклонение цен
      const closeStdDev = this._calculateStdDev(closes);
      const normalizedStdDev = closeStdDev / closes[closes.length - 1]; // относительно текущей цены
      
      // Определяем направление рынка
      const priceChange = (closes[closes.length - 1] - closes[0]) / closes[0];
      
      // Рассчитываем волатильность и тренд
      const volatility = this.calculateVolatility(recentPrices);
      const trendStrength = this.calculateTrendStrength(recentPrices);
      
      // Определяем фазу цикла рынка
      let phase = 'UNKNOWN';
      let confidence = 0.5;
      
      if (lastEma20 > lastEma50 && rsi > 70 && priceChange > 0.1) {
        // Эйфория / перекупленность
        phase = 'EUPHORIA';
        confidence = Math.min(0.5 + rsi / 100 + Math.abs(priceChange), 0.9);
      } else if (lastEma20 < lastEma50 && rsi < 30 && priceChange < -0.1) {
        // Депрессия / перепроданность
        phase = 'DEPRESSION';
        confidence = Math.min(0.5 + (100 - rsi) / 100 + Math.abs(priceChange), 0.9);
      } else if (lastEma20 > lastEma50 && rsi > 50 && priceChange > 0) {
        // Восстановление / рост
        phase = 'RECOVERY';
        confidence = Math.min(0.5 + trendStrength + priceChange, 0.85);
      } else if (lastEma20 < lastEma50 && rsi < 50 && priceChange < 0) {
        // Спад / падение
        phase = 'DECLINE';
        confidence = Math.min(0.5 + trendStrength + Math.abs(priceChange), 0.85);
      } else if (Math.abs(lastEma20 - lastEma50) / lastEma50 < 0.01 && Math.abs(rsi - 50) < 10) {
        // Консолидация / неопределенность
        phase = 'CONSOLIDATION';
        confidence = 0.5 + (1 - normalizedStdDev) * 0.3;
      } else {
        // Переходная фаза
        phase = 'TRANSITION';
        confidence = 0.5;
      }
      
      return {
        phase,
        confidence,
        details: {
          priceChange,
          rsi,
          ema20vsEma50: (lastEma20 - lastEma50) / lastEma50
        }
      };
    } catch (error) {
      console.error(`Error in determineMarketCycle for ${this.symbol}:`, error);
      return {
        phase: 'UNKNOWN',
        confidence: 0.5
      };
    }
  }

  // Вспомогательные методы для анализа паттернов

  // Проверка на паттерн двойного дна
  _checkDoubleButtom(lows) {
    try {
      if (lows.length < 10) return { detected: false, strength: 0 };
      
      const tolerance = 0.01; // 1% допуск для сравнения минимумов
      
      for (let i = 1; i < lows.length - 5; i++) {
        // Ищем первый минимум
        if (lows[i] < lows[i-1] && lows[i] < lows[i+1]) {
          // Ищем второй минимум
          for (let j = i + 3; j < lows.length - 1; j++) {
            if (lows[j] < lows[j-1] && lows[j] < lows[j+1]) {
              // Проверяем, что минимумы примерно на одном уровне
              const diff = Math.abs(lows[i] - lows[j]) / lows[i];
              
              if (diff < tolerance) {
                // Проверяем, что между минимумами есть вершина
                const middleValues = lows.slice(i+1, j);
                const middleMax = Math.max(...middleValues);
                
                if (middleMax > lows[i] * (1 + tolerance) && 
                    middleMax > lows[j] * (1 + tolerance)) {
                  // Рассчитываем силу паттерна
                  const distanceStrength = (j - i) / lows.length; // 0-1, чем дальше минимумы, тем сильнее
                  const heightStrength = (middleMax - Math.min(lows[i], lows[j])) / 
                    Math.min(lows[i], lows[j]); // 0-1, чем выше вершина между впадинами, тем сильнее
                  
                  // Общая сила паттерна
                  const strength = Math.min(0.9, (distanceStrength + heightStrength) / 2);
                  
                  return {
                    detected: true,
                    strength,
                    firstBottomIndex: i,
                    secondBottomIndex: j
                  };
                }
              }
            }
          }
        }
      }
      
      return { detected: false, strength: 0 };
    } catch (error) {
      console.error(`Error in _checkDoubleButtom for ${this.symbol}:`, error);
      return { detected: false, strength: 0 };
    }
  }

  // Проверка на паттерн двойной вершины
  _checkDoubleTop(highs) {
    try {
      if (highs.length < 10) return { detected: false, strength: 0 };
      
      const tolerance = 0.01; // 1% допуск для сравнения максимумов
      
      for (let i = 1; i < highs.length - 5; i++) {
        // Ищем первый максимум
        if (highs[i] > highs[i-1] && highs[i] > highs[i+1]) {
          // Ищем второй максимум
          for (let j = i + 3; j < highs.length - 1; j++) {
            if (highs[j] > highs[j-1] && highs[j] > highs[j+1]) {
              // Проверяем, что максимумы примерно на одном уровне
              const diff = Math.abs(highs[i] - highs[j]) / highs[i];
              
              if (diff < tolerance) {
                // Проверяем, что между максимумами есть впадина
                const middleValues = highs.slice(i+1, j);
                const middleMin = Math.min(...middleValues);
                
                if (middleMin < highs[i] * (1 - tolerance) && 
                    middleMin < highs[j] * (1 - tolerance)) {
                  // Рассчитываем силу паттерна
                  const distanceStrength = (j - i) / highs.length; // 0-1, чем дальше максимумы, тем сильнее
                  const depthStrength = (Math.max(highs[i], highs[j]) - middleMin) / 
                    Math.max(highs[i], highs[j]); // 0-1, чем глубже впадина между пиками, тем сильнее
                  
                  // Общая сила паттерна
                  const strength = Math.min(0.9, (distanceStrength + depthStrength) / 2);
                  
                  return {
                    detected: true,
                    strength,
                    firstTopIndex: i,
                    secondTopIndex: j
                  };
                }
              }
            }
          }
        }
      }
      
      return { detected: false, strength: 0 };
    } catch (error) {
      console.error(`Error in _checkDoubleTop for ${this.symbol}:`, error);
      return { detected: false, strength: 0 };
    }
  }

  // Расчет тренда последних N свечей
  _calculateRecentTrend(prices) {
    try {
      if (prices.length < 5) return { direction: 'NEUTRAL', strength: 0 };
      
      // Используем последние 10 свечей для анализа тренда
      const recentPrices = prices.slice(-10);
      
      // Расчет линейной регрессии
      const n = recentPrices.length;
      const x = Array.from({length: n}, (_, i) => i);
      
      const xMean = x.reduce((sum, val) => sum + val, 0) / n;
      const yMean = recentPrices.reduce((sum, val) => sum + val, 0) / n;
      
      let numerator = 0;
      let denominator = 0;
      
      for (let i = 0; i < n; i++) {
        const xDiff = x[i] - xMean;
        const yDiff = recentPrices[i] - yMean;
        numerator += xDiff * yDiff;
        denominator += xDiff * xDiff;
      }
      
      // Наклон линии
      const slope = denominator !== 0 ? numerator / denominator : 0;
      
      // Определяем направление и силу тренда
      const direction = slope > 0 ? 'UP' : slope < 0 ? 'DOWN' : 'NEUTRAL';
      
      // Нормализуем силу тренда от 0 до 1
      const maxPossibleSlope = Math.max(...recentPrices) - Math.min(...recentPrices);
      const strength = maxPossibleSlope > 0 ? Math.min(1, Math.abs(slope * n / maxPossibleSlope)) : 0;
      
      return {
        direction,
        strength,
        slope
      };
    } catch (error) {
      console.error(`Error in _calculateRecentTrend for ${this.symbol}:`, error);
      return { direction: 'NEUTRAL', strength: 0, slope: 0 };
    }
  }

  // Вычисление дисперсии массива
  _calculateVariance(values) {
    try {
      if (!values || values.length === 0) return 0;
      
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
      return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    } catch (error) {
      console.error(`Error in _calculateVariance:`, error);
      return 0;
    }
  }

  // Вычисление стандартного отклонения
  _calculateStdDev(values) {
    try {
      return Math.sqrt(this._calculateVariance(values));
    } catch (error) {
      console.error(`Error in _calculateStdDev:`, error);
      return 0;
    }
  }
}

module.exports = MarketAnalyzer;
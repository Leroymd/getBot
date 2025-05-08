// backend/api/controllers/signalController.js
const SignalSettings = require('../models/SignalSettings');
const BitgetAPI = require('../../services/BitgetAPI');
const MarketAnalyzer = require('../../services/MarketAnalyzer');


// Объект для хранения активных ботов (импортируем из botController)
const { activeBots } = require('./botController');

/**
 * Получение настроек сигналов для указанного символа
 * @route GET /api/signals/settings
 */
exports.getSignalSettings = async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    // Получаем настройки из базы данных
    let settings = await SignalSettings.findOne({ symbol });
    
    // Если настроек нет, создаем дефолтные
    if (!settings) {
      settings = new SignalSettings({ symbol });
      await settings.save();
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error getting signal settings:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Обновление настроек сигналов для указанного символа
 * @route POST /api/signals/settings
 */
exports.updateSignalSettings = async (req, res) => {
  try {
    const { symbol, settings } = req.body;
    
    if (!symbol || !settings) {
      return res.status(400).json({ error: 'Symbol and settings are required' });
    }

    // Получаем настройки из базы данных
    let signalSettings = await SignalSettings.findOne({ symbol });
    
    if (signalSettings) {
      // Обновляем существующие настройки
      Object.assign(signalSettings, settings);
      await signalSettings.save();
    } else {
      // Создаем новые настройки
      signalSettings = new SignalSettings({ 
        symbol,
        ...settings
      });
      await signalSettings.save();
    }

    // Если бот активен, обновляем его настройки анализа сигналов
    if (activeBots[symbol]) {
      try {
        // Проверяем, есть ли у бота метод updateSignalSettings
        if (typeof activeBots[symbol].updateSignalSettings === 'function') {
          activeBots[symbol].updateSignalSettings(signalSettings);
          console.log(`Updated signal settings for running bot ${symbol}`);
        } else {
          console.log(`Bot for ${symbol} does not support updateSignalSettings method`);
        }
      } catch (updateError) {
        console.error(`Error updating signal settings for running bot ${symbol}:`, updateError);
      }
    }
    
    res.json({ 
      success: true, 
      message: `Signal settings updated for ${symbol}`,
      botUpdated: !!activeBots[symbol]
    });
  } catch (error) {
    console.error('Error updating signal settings:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Тестирование настроек сигналов на исторических данных
 * @route POST /api/signals/backtest
 */
exports.backtestSignals = async (req, res) => {
  try {
    const { symbol, settings, period, timeframe } = req.body;
    
    if (!symbol || !settings) {
      return res.status(400).json({ error: 'Symbol and settings are required' });
    }

    // Параметры по умолчанию
    const testPeriod = period || 30; // дней
    const testTimeframe = timeframe || '1h';
    
    console.log(`Backtesting signals for ${symbol} on ${testTimeframe} timeframe for ${testPeriod} days`);
    
    // Создаем экземпляр API для получения исторических данных
    const api = new BitgetAPI();
    
    // Расчет количества свечей в зависимости от таймфрейма и периода
    let candlesCount = 0;
    switch (testTimeframe) {
      case '1m': candlesCount = testPeriod * 24 * 60; break;
      case '5m': candlesCount = testPeriod * 24 * 12; break;
      case '15m': candlesCount = testPeriod * 24 * 4; break;
      case '30m': candlesCount = testPeriod * 24 * 2; break;
      case '1h': candlesCount = testPeriod * 24; break;
      case '4h': candlesCount = testPeriod * 6; break;
      case '1d': candlesCount = testPeriod; break;
      default: candlesCount = testPeriod * 24; // по умолчанию 1h
    }
    
    // Если количество свечей слишком большое, ограничиваем
    if (candlesCount > 1000) {
      candlesCount = 1000;
      console.log(`Limited candles count to ${candlesCount}`);
    }
    
    // Получаем исторические данные
    let historicalData;
    try {
      const klines = await api.getKlines(symbol, testTimeframe, candlesCount);
      
      if (!klines || !klines.data || !Array.isArray(klines.data)) {
        return res.status(500).json({ error: 'Failed to fetch historical data' });
      }
      
      // Преобразуем данные в формат, удобный для анализа
      historicalData = klines.data.map(candle => ({
        time: parseInt(candle[0]),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      }));
      
    } catch (dataError) {
      console.error(`Error fetching historical data for ${symbol}:`, dataError);
      return res.status(500).json({ error: `Failed to fetch historical data: ${dataError.message}` });
    }
    
    // Создаем анализатор рынка с переданными настройками
    const analyzer = new MarketAnalyzer(symbol, settings, api);
    
    // Результаты бэктеста
    const results = {
      symbol,
      timeframe: testTimeframe,
      period: testPeriod,
      totalSignals: 0,
      entrySignals: {
        long: 0,
        short: 0
      },
      exitSignals: 0,
      potentialTrades: [],
      statistics: {
        winRate: 0,
        avgProfit: 0,
        avgLoss: 0,
        profitFactor: 0,
        maxConsecutiveWins: 0,
        maxConsecutiveLosses: 0,
        largestWin: 0,
        largestLoss: 0
      }
    };
    
    // Проходим по историческим данным и анализируем сигналы
    let openPosition = null;
    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let wins = 0;
    let losses = 0;
    let largestWin = 0;
    let largestLoss = 0;
    
    // Применяем временные рамки для симуляции
    const startIdx = Math.max(50, Math.floor(historicalData.length * 0.1)); // пропускаем начало для расчета индикаторов
    
    for (let i = startIdx; i < historicalData.length; i++) {
      const currentCandle = historicalData[i];
      const currentPrice = currentCandle.close;
      
      // Создаем данные для анализа
      const marketData = {
        recentCandles: historicalData.slice(Math.max(0, i - 50), i + 1),
        position: openPosition
      };
      
      try {
        // Анализируем текущую свечу
        const analysis = await analyzer.analyzeSignals(currentPrice, marketData, settings);
        
        // Обрабатываем сигналы
        if (!openPosition && analysis.shouldEnter) {
          // Открываем новую позицию
          openPosition = {
            entryPrice: currentPrice,
            direction: analysis.direction,
            entryTime: currentCandle.time,
            takeProfitPrice: analysis.takeProfitPrice,
            stopLossPrice: analysis.stopLossPrice
          };
          
          results.entrySignals[analysis.direction.toLowerCase()]++;
          results.totalSignals++;
        } 
        else if (openPosition && analysis.shouldExit) {
          // Закрываем позицию
          const exitPrice = currentPrice;
          let pnl = 0;
          
          if (openPosition.direction === 'LONG') {
            pnl = (exitPrice - openPosition.entryPrice) / openPosition.entryPrice * 100;
          } else { // SHORT
            pnl = (openPosition.entryPrice - exitPrice) / openPosition.entryPrice * 100;
          }
          
          // Добавляем сделку в результаты
          results.potentialTrades.push({
            direction: openPosition.direction,
            entryPrice: openPosition.entryPrice,
            exitPrice,
            entryTime: openPosition.entryTime,
            exitTime: currentCandle.time,
            pnl,
            reason: analysis.exitReason
          });
          
          // Обновляем статистику
          if (pnl > 0) {
            wins++;
            totalProfit += pnl;
            largestWin = Math.max(largestWin, pnl);
            consecutiveWins++;
            consecutiveLosses = 0;
          } else {
            losses++;
            totalLoss += Math.abs(pnl);
            largestLoss = Math.max(largestLoss, Math.abs(pnl));
            consecutiveLosses++;
            consecutiveWins = 0;
          }
          
          maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
          maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
          
          // Сбрасываем позицию
          openPosition = null;
          results.exitSignals++;
          results.totalSignals++;
        }
      } catch (analysisError) {
        console.warn(`Error analyzing signal at time ${currentCandle.time}:`, analysisError);
        // Продолжаем со следующей свечой
      }
    }
    
    // Рассчитываем итоговую статистику
    const totalTrades = wins + losses;
    if (totalTrades > 0) {
      results.statistics.winRate = (wins / totalTrades) * 100;
    }
    
    if (wins > 0) {
      results.statistics.avgProfit = totalProfit / wins;
    }
    
    if (losses > 0) {
      results.statistics.avgLoss = totalLoss / losses;
    }
    
    if (totalLoss > 0) {
      results.statistics.profitFactor = totalProfit / totalLoss;
    } else if (totalProfit > 0) {
      results.statistics.profitFactor = Infinity;
    }
    
    results.statistics.maxConsecutiveWins = maxConsecutiveWins;
    results.statistics.maxConsecutiveLosses = maxConsecutiveLosses;
    results.statistics.largestWin = largestWin;
    results.statistics.largestLoss = largestLoss;
    
    // Добавляем итоговую информацию
    results.totalTrades = totalTrades;
    results.totalProfit = totalProfit;
    results.totalLoss = totalLoss;
    results.netResult = totalProfit - totalLoss;
    
    res.json(results);
  } catch (error) {
    console.error('Error backtesting signals:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Получение текущих сигналов для символа с заданными настройками
 * @route GET /api/signals/current
 */
exports.getCurrentSignals = async (req, res) => {
  try {
    const { symbol, timeframe } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const signalTimeframe = timeframe || '1h';
    
    // Получаем настройки из базы данных
    let settings = await SignalSettings.findOne({ symbol });
    
    if (!settings) {
      // Если настроек нет, используем дефолтные
      settings = new SignalSettings({ symbol });
    }
    
    // Создаем экземпляры API и анализатора
    const api = new BitgetAPI();
    const analyzer = new MarketAnalyzer(symbol, settings, api);
    
    // Получаем текущую цену
    let currentPrice = 0;
    try {
      const ticker = await api.getTicker(symbol);
      if (ticker && ticker.data && ticker.data[0]) {
        currentPrice = parseFloat(ticker.data[0].last);
      } else {
        return res.status(500).json({ error: 'Failed to get current price' });
      }
    } catch (priceError) {
      console.error(`Error getting current price for ${symbol}:`, priceError);
      return res.status(500).json({ error: `Failed to get current price: ${priceError.message}` });
    }
    
    // Получаем исторические данные для анализа
    let recentCandles = [];
    try {
      const klines = await api.getKlines(symbol, signalTimeframe, 50);
      
      if (klines && klines.data && Array.isArray(klines.data)) {
        recentCandles = klines.data.map(candle => ({
          time: parseInt(candle[0]),
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4]),
          volume: parseFloat(candle[5])
        }));
      }
    } catch (dataError) {
      console.error(`Error getting historical data for ${symbol}:`, dataError);
      // Продолжаем без исторических данных
    }
    
    // Проверяем, есть ли открытая позиция у бота
    let openPosition = null;
    if (activeBots[symbol] && activeBots[symbol].openPosition) {
      openPosition = activeBots[symbol].openPosition;
    }
    
    // Получаем текущие сигналы
    try {
      const marketData = {
        recentCandles,
        position: openPosition
      };
      
      const signals = await analyzer.analyzeSignals(currentPrice, marketData, settings);
      
      // Добавляем дополнительную информацию
      const response = {
        symbol,
        timeframe: signalTimeframe,
        currentPrice,
        timestamp: Date.now(),
        signals,
        indicators: {},
        marketConditions: {}
      };
      
      // Если у анализатора есть метод getIndicatorValues, получаем значения индикаторов
      if (typeof analyzer.getIndicatorValues === 'function') {
        response.indicators = await analyzer.getIndicatorValues(recentCandles);
      }
      
      // Если у анализатора есть метод getMarketConditions, получаем условия рынка
      if (typeof analyzer.getMarketConditions === 'function') {
        response.marketConditions = await analyzer.getMarketConditions();
      }
      
      res.json(response);
    } catch (analysisError) {
      console.error(`Error analyzing signals for ${symbol}:`, analysisError);
      res.status(500).json({ error: `Failed to analyze signals: ${analysisError.message}` });
    }
  } catch (error) {
    console.error('Error getting current signals:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Получение рекомендуемых настроек на основе анализа рынка
 * @route GET /api/signals/recommended-settings
 */
exports.getRecommendedSettings = async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    // Создаем экземпляры API и анализатора
    const api = new BitgetAPI();
    const analyzer = new MarketAnalyzer(symbol, {}, api);
    
    // Анализируем рынок
    let marketConditions;
    try {
      marketConditions = await analyzer.analyzeMarketConditions();
    } catch (analysisError) {
      console.error(`Error analyzing market conditions for ${symbol}:`, analysisError);
      return res.status(500).json({ error: `Failed to analyze market: ${analysisError.message}` });
    }
    
    // Создаем базовые настройки
    const baseSettings = new SignalSettings({ symbol });
    
    // Адаптируем настройки под текущие рыночные условия
    const adaptedSettings = { ...baseSettings.toObject() };
    
    // Настраиваем в зависимости от типа рынка
    switch (marketConditions.marketType) {
      case 'TRENDING':
        // Для трендового рынка улучшаем DCA-стратегию
        adaptedSettings.general.sensitivity = 60;
        adaptedSettings.entryConditions.minTrendStrength = 0.4;
        adaptedSettings.entryConditions.allowCounterTrend = false;
        adaptedSettings.strategySpecific.dca.priceStep = 2.0;
        adaptedSettings.strategySpecific.dca.maxOrders = 4;
        break;
        
      case 'VOLATILE':
        // Для волатильного рынка улучшаем скальпинг-стратегию
        adaptedSettings.general.sensitivity = 40;
        adaptedSettings.general.minVolatility = 0.5;
        adaptedSettings.indicators.rsi.period = 10;
        adaptedSettings.strategySpecific.scalping.profitTarget = 0.8;
        adaptedSettings.strategySpecific.scalping.stopLoss = 0.5;
        adaptedSettings.exitConditions.trailingStopActivation = 0.3;
        break;
        
      case 'RANGING':
        // Для бокового рынка настраиваем под OSC-стратегии
        adaptedSettings.general.sensitivity = 70;
        adaptedSettings.indicators.rsi.overbought = 75;
        adaptedSettings.indicators.rsi.oversold = 25;
        adaptedSettings.strategySpecific.scalping.profitTarget = 0.4;
        adaptedSettings.strategySpecific.scalping.stopLoss = 0.3;
        adaptedSettings.marketFilters.preferredMarketTypes = ['RANGING'];
        break;
        
      default:
        // Для неизвестного типа рынка используем сбалансированные настройки
        adaptedSettings.general.sensitivity = 50;
        break;
    }
    
    // Настройка в зависимости от волатильности
    if (marketConditions.volatility > 3.0) {
      // Высокая волатильность - увеличиваем стоп-лоссы и тейк-профиты
      adaptedSettings.strategySpecific.scalping.profitTarget *= 1.5;
      adaptedSettings.strategySpecific.scalping.stopLoss *= 1.5;
      adaptedSettings.strategySpecific.dca.priceStep *= 1.3;
    } else if (marketConditions.volatility < 0.5) {
      // Низкая волатильность - уменьшаем стоп-лоссы и тейк-профиты
      adaptedSettings.strategySpecific.scalping.profitTarget *= 0.7;
      adaptedSettings.strategySpecific.scalping.stopLoss *= 0.7;
      adaptedSettings.strategySpecific.dca.priceStep *= 0.8;
    }
    
    // Настройка в зависимости от объема
    if (marketConditions.volumeRatio > 2.0) {
      // Высокий объем - повышаем чувствительность
      adaptedSettings.general.sensitivity *= 1.2;
      adaptedSettings.general.sensitivity = Math.min(100, adaptedSettings.general.sensitivity);
    } else if (marketConditions.volumeRatio < 0.8) {
      // Низкий объем - снижаем чувствительность
      adaptedSettings.general.sensitivity *= 0.8;
    }
    
    res.json({
      symbol,
      marketConditions,
      recommendedSettings: adaptedSettings,
      explanation: `Settings optimized for ${marketConditions.marketType} market with volatility ${marketConditions.volatility.toFixed(2)}% and volume ratio ${marketConditions.volumeRatio.toFixed(2)}.`
    });
  } catch (error) {
    console.error('Error getting recommended settings:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = exports;
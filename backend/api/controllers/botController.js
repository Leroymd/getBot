// backend/api/controllers/botController.js
const Bot = require('../../services/Bot');
const BotConfig = require('../models/BotConfig');
// backend/api/controllers/botController.js
// Добавляем импорты в начало файла
const BitgetAPI = require('../../services/BitgetAPI');
const MarketAnalyzer = require('../../services/MarketAnalyzer');

let activeBots = {};

// backend/api/controllers/botController.js - установим значения по умолчанию

exports.startBot = async (req, res) => {
  try {
    const { symbol, config } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    if (activeBots[symbol]) {
      return res.status(400).json({ error: 'Bot already running for this symbol' });
    }

    // Значения по умолчанию для конфигурации
    const defaultConfig = {
      activeStrategy: 'AUTO',
      common: {
        enabled: true,
        leverage: 10,
        initialBalance: 100,
        reinvestment: 100
      },
      dca: {
        maxDCAOrders: 5,
        dcaPriceStep: 1.5,
        dcaMultiplier: 1.5,
        maxTradeDuration: 240,
        trailingStop: 0.5
      },
      scalping: {
        timeframe: '1m',
        profitTarget: 0.5,
        stopLoss: 0.3,
        maxTradeDuration: 30,
        minVolatility: 0.2,
        maxSpread: 0.1,
        useTrailingStop: true,
        trailingStopActivation: 0.2,
        trailingStopDistance: 0.1
      },
      autoSwitching: {
        enabled: true,
        volatilityThreshold: 1.5,
        volumeThreshold: 2.0,
        trendStrengthThreshold: 0.6
      }
    };

    // Получаем конфигурацию из базы данных или используем предоставленную
    let botConfig = config;
    if (!config) {
      const savedConfig = await BotConfig.findOne({ symbol });
      if (savedConfig) {
        botConfig = savedConfig.config;
      } else {
        botConfig = defaultConfig;
      }
    }

    // Создаем новый экземпляр бота с полной конфигурацией
    const bot = new Bot(symbol, botConfig);
    await bot.initialize();
    
    // Запускаем бота
    bot.start();
    
    // Сохраняем бота в активных ботах
    activeBots[symbol] = bot;
    
    res.json({ 
      success: true, 
      message: `Bot started for ${symbol}`, 
      activeStrategy: bot.currentStrategy.name 
    });
  } catch (error) {
    console.error('Error starting bot:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.stopBot = async (req, res) => {
  try {
    const { symbol } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    if (!activeBots[symbol]) {
      return res.status(400).json({ error: 'No active bot found for this symbol' });
    }

    // Останавливаем бота
    await activeBots[symbol].stop();
    
    // Удаляем из активных ботов
    delete activeBots[symbol];
    
    res.json({ success: true, message: `Bot stopped for ${symbol}` });
  } catch (error) {
    console.error('Error stopping bot:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getBotStatus = async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      // Возвращаем статус всех ботов
      const statuses = {};
      for (const [sym, bot] of Object.entries(activeBots)) {
        statuses[sym] = {
          running: bot.isRunning(),
          uptime: bot.getUptime(),
          stats: bot.getStats()
        };
      }
      return res.json(statuses);
    }

    if (!activeBots[symbol]) {
      return res.json({ 
        running: false,
        stats: {
          totalTrades: 0,
          winTrades: 0,
          lossTrades: 0,
          totalPnl: 0,
          maxDrawdown: 0,
          currentBalance: 100,
          initialBalance: 100,
          tradesToday: 0,
          hourlyTrades: Array(24).fill(0),
          hourlyPnl: Array(24).fill(0),
          strategyPerformance: {
            DCA: { trades: 0, winRate: 0, avgProfit: 0, avgLoss: 0 },
            SCALPING: { trades: 0, winRate: 0, avgProfit: 0, avgLoss: 0 }
          },
          lastMarketAnalysis: {
            timestamp: Date.now(),
            recommendedStrategy: 'DCA',
            marketType: 'UNKNOWN',
            volatility: 0,
            volumeRatio: 0,
            trendStrength: 0,
            confidence: 0.5
          },
          activeStrategy: 'DCA'
        }
      });
    }

    res.json({
      running: activeBots[symbol].isRunning(),
      uptime: activeBots[symbol].getUptime(),
      stats: activeBots[symbol].getStats()
    });
  } catch (error) {
    console.error('Error getting bot status:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    const { symbol, config } = req.body;
    
    if (!symbol || !config) {
      return res.status(400).json({ error: 'Symbol and config are required' });
    }

    // Обновляем конфигурацию в базе данных
    let botConfig = await BotConfig.findOne({ symbol });
    if (botConfig) {
      // Обновляем существующую конфигурацию
      Object.assign(botConfig, config);
      await botConfig.save();
    } else {
      // Создаем новую конфигурацию
      botConfig = new BotConfig({ symbol, ...config });
      await botConfig.save();
    }

    // Если бот активен, обновляем его конфигурацию
    if (activeBots[symbol]) {
      activeBots[symbol].updateConfig(botConfig);
    }
    
    res.json({ success: true, message: `Configuration updated for ${symbol}` });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getConfig = async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    let botConfig = await BotConfig.findOne({ symbol });
    if (!botConfig) {
      // Создаем дефолтную конфигурацию
      botConfig = new BotConfig({ symbol });
      await botConfig.save();
    }
    
    res.json(botConfig);
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    if (!activeBots[symbol]) {
      return res.json({
        totalTrades: 0,
        winTrades: 0,
        lossTrades: 0,
        totalPnl: 0,
        maxDrawdown: 0,
        currentBalance: 100,
        initialBalance: 100,
        tradesToday: 0,
        hourlyTrades: Array(24).fill(0),
        hourlyPnl: Array(24).fill(0),
        strategyPerformance: {
          DCA: { trades: 0, winRate: 0, avgProfit: 0, avgLoss: 0 },
          SCALPING: { trades: 0, winRate: 0, avgProfit: 0, avgLoss: 0 }
        },
        lastMarketAnalysis: {
          timestamp: Date.now(),
          recommendedStrategy: 'DCA',
          marketType: 'UNKNOWN',
          volatility: 0,
          volumeRatio: 0,
          trendStrength: 0,
          confidence: 0.5
        },
        activeStrategy: 'DCA'
      });
    }
    
    const stats = activeBots[symbol].getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.setStrategy = async (req, res) => {
  try {
    const { symbol, strategy } = req.body;
    
    if (!symbol || !strategy) {
      return res.status(400).json({ error: 'Symbol and strategy are required' });
    }

    if (!activeBots[symbol]) {
      return res.status(404).json({ error: 'No active bot found for this symbol' });
    }
    
    // Обновляем конфигурацию в базе данных
    let botConfig = await BotConfig.findOne({ symbol });
    if (botConfig) {
      botConfig.activeStrategy = strategy;
      await botConfig.save();
    }
    
    // Устанавливаем стратегию
    const currentStrategy = activeBots[symbol].setStrategy(strategy);
    
    res.json({ 
      success: true, 
      message: `Strategy changed to ${strategy} for ${symbol}`,
      currentStrategy
    });
  } catch (error) {
    console.error('Error setting strategy:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.analyzeMarket = async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    if (!activeBots[symbol]) {
      // Если бот не запущен, создаем временный экземпляр для анализа
      let botConfig = await BotConfig.findOne({ symbol });
      if (!botConfig) {
        botConfig = new BotConfig({ symbol });
        await botConfig.save();
      }
      
      const api = new BitgetAPI();
      const marketAnalyzer = new MarketAnalyzer(symbol, botConfig, api);
      const analysis = await marketAnalyzer.analyzeMarketConditions();
      
      return res.json({
        ...analysis,
        symbol
      });
    }
    
    // Запрашиваем анализ рынка
    const analysis = await activeBots[symbol].marketAnalyzer.analyzeMarketConditions();
    
    res.json({
      ...analysis,
      symbol
    });
  } catch (error) {
    console.error('Error analyzing market:', error);
    res.status(500).json({ error: error.message });
  }
};
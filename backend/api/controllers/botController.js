// backend/api/controllers/botController.js
const Bot = require('../../services/Bot');
const BotConfig = require('../models/BotConfig');
const BitgetAPI = require('../../services/BitgetAPI');
const MarketAnalyzer = require('../../services/MarketAnalyzer');

let activeBots = {};

// Исправление для backend/api/controllers/botController.js - метод startBot

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
    let botConfig;
    try {
      // Проверяем, существует ли конфигурация для данного символа
      const dbConfig = await BotConfig.findOne({ symbol });
      
      if (dbConfig) {
        // Используем существующую конфигурацию из БД
        botConfig = {
          activeStrategy: dbConfig.activeStrategy,
          common: dbConfig.common,
          dca: dbConfig.dca,
          scalping: dbConfig.scalping,
          autoSwitching: dbConfig.autoSwitching
        };
      } else if (config) {
        // Используем предоставленную конфигурацию
        botConfig = config;
      } else {
        // Если ничего нет, используем значения по умолчанию
        botConfig = defaultConfig;
        
        // Создаем запись в БД для будущего использования
        const newConfig = new BotConfig({
          symbol,
          ...defaultConfig
        });
        await newConfig.save();
      }
    } catch (configError) {
      console.warn(`Could not retrieve config from database: ${configError.message}, using default config`);
      botConfig = defaultConfig;
    }

    // Создаем новый экземпляр бота с полной конфигурацией
    try {
      const bot = new Bot(symbol, botConfig);
      
      // Инициализируем и запускаем бота
      await bot.initialize();
      bot.start();
      
      // Сохраняем бота в активных ботах
      activeBots[symbol] = bot;
      
      // Определяем текущую активную стратегию
      let activeStrategyName = "DCA";
      if (bot.currentStrategy && typeof bot.currentStrategy.name === 'string') {
        activeStrategyName = bot.currentStrategy.name;
      }
      
      res.json({ 
        success: true, 
        message: `Bot started for ${symbol}`, 
        activeStrategy: activeStrategyName
      });
    } catch (botError) {
      console.error(`Error creating or initializing bot for ${symbol}:`, botError);
      return res.status(500).json({ 
        error: `Failed to start bot: ${botError.message}`,
        stack: process.env.NODE_ENV === 'development' ? botError.stack : undefined 
      });
    }
  } catch (error) {
    console.error('Error starting bot:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
      
      // Проверка на наличие активных ботов
      if (Object.keys(activeBots).length === 0) {
        return res.json({
          message: "No active bots found",
          bots: {}
        });
      }
      
      // Собираем информацию о всех активных ботах
      for (const [sym, bot] of Object.entries(activeBots)) {
        try {
          statuses[sym] = {
            running: bot.isRunning(),
            uptime: bot.getUptime(),
            stats: bot.getStats()
          };
        } catch (botError) {
          console.error(`Error getting status for bot ${sym}:`, botError);
          statuses[sym] = {
            running: true,
            error: botError.message,
            uptime: 0,
            stats: {}
          };
        }
      }
      
      return res.json({
        message: `${Object.keys(statuses).length} active bots found`,
        bots: statuses
      });
    }

    // Проверка существования бота для указанного символа
    if (!activeBots[symbol]) {
      return res.json({ 
        running: false,
        message: `No active bot found for ${symbol}`,
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

    // Возвращаем статус бота для указанного символа
    try {
      const botStatus = {
        running: activeBots[symbol].isRunning(),
        uptime: activeBots[symbol].getUptime(),
        stats: activeBots[symbol].getStats()
      };
      
      res.json(botStatus);
    } catch (error) {
      console.error(`Error getting status for bot ${symbol}:`, error);
      res.status(500).json({ 
        error: `Failed to get bot status: ${error.message}`,
        running: true, // Предполагаем, что бот работает, даже если не можем получить его статус
        uptime: 0,
        stats: {
          activeStrategy: activeBots[symbol].activeStrategy || 'UNKNOWN'
        }
      });
    }
  } catch (error) {
    console.error('Error getting bot status:', error);
    res.status(500).json({ error: error.message });
  }
};

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

// Улучшенный метод анализа рынка
exports.analyzeMarket = async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    let marketAnalyzer;
    let config = {
      autoSwitching: {
        volatilityThreshold: 1.5,
        volumeThreshold: 2.0,
        trendStrengthThreshold: 0.6
      }
    };

    // Создание API клиента с обработкой исключений
    try {
      const api = new BitgetAPI();
      marketAnalyzer = new MarketAnalyzer(symbol, config, api);
    } catch (initError) {
      console.error('Error initializing market analyzer:', initError);
      return res.status(500).json({ 
        error: 'Failed to initialize market analyzer',
        details: initError.message
      });
    }
    
    // Анализ с обработкой таймаута
    try {
      // Используем Promise.race с таймаутом для предотвращения зависания
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Analysis timed out')), 30000)
      );
      
      const analysisPromise = marketAnalyzer.analyzeMarketConditions();
      const analysis = await Promise.race([analysisPromise, timeout]);
      
      return res.json({
        ...analysis,
        symbol
      });
    } catch (analysisError) {
      console.error('Error during market analysis:', analysisError);
      return res.status(500).json({ 
        error: 'Failed to analyze market conditions',
        details: analysisError.message
      });
    }
  } catch (error) {
    console.error('Error analyzing market:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
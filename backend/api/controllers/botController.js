// backend/api/controllers/botController.js
// Добавьте в начало файла инициализацию объекта activeBots

// Импорты
const Bot = require('../../services/Bot');
const BotConfig = require('../models/BotConfig');
const BitgetAPI = require('../../services/BitgetAPI');
const MarketAnalyzer = require('../../services/MarketAnalyzer');

// Объект для хранения активных ботов
let activeBots = {};

/**
 * Запустить бота для указанного символа
 * @route POST /api/bot/start
 */
exports.startBot = async (req, res) => {
  try {
    const { symbol, config, forceRestart } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    // Проверяем, запущен ли уже бот для этого символа
    if (activeBots[symbol] && activeBots[symbol].isRunning && activeBots[symbol].isRunning() && !forceRestart) {
      return res.status(400).json({ 
        error: 'Bot already running for this symbol',
        botStatus: {
          running: true,
          stats: activeBots[symbol].getStats()
        }
      });
    }

    // Если указан принудительный перезапуск, останавливаем существующий бот
    if (activeBots[symbol] && activeBots[symbol].isRunning && activeBots[symbol].isRunning() && forceRestart) {
      console.log(`Force restarting bot for ${symbol}...`);
      await activeBots[symbol].stop();
      delete activeBots[symbol];
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

/**
 * Остановить бота для указанного символа
 * @route POST /api/bot/stop
 */
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

/**
 * Получить статус бота
 * @route GET /api/bot/status
 */
exports.getBotStatus = async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      // Возвращаем статус всех ботов
      const statuses = {};
      for (const [sym, bot] of Object.entries(activeBots)) {
        try {
          // Получаем ticker для расчета текущего PnL
          let currentPrice = null;
          try {
            const ticker = await bot.api.getTicker(sym);
            if (ticker && ticker.data && ticker.data[0]) {
              currentPrice = parseFloat(ticker.data[0].last);
            }
          } catch (tickerError) {
            console.warn(`Failed to get current price for ${sym}:`, tickerError.message);
          }
          
          // Получаем статистику бота
          const stats = bot.getStats();
          
          // Если есть открытая позиция и текущая цена, рассчитываем PnL
          if (stats.openPosition && currentPrice) {
            stats.openPosition.currentPrice = currentPrice;
            
            // Расчет PnL для открытой позиции
            if (stats.openPosition.direction === 'LONG') {
              stats.openPosition.pnl = (currentPrice - stats.openPosition.entryPrice) / stats.openPosition.entryPrice * 100;
            } else { // SHORT
              stats.openPosition.pnl = (stats.openPosition.entryPrice - currentPrice) / stats.openPosition.entryPrice * 100;
            }
          }
          
          statuses[sym] = {
            running: bot.isRunning(),
            uptime: bot.getUptime(),
            stats
          };
        } catch (botError) {
          console.error(`Error getting status for bot ${sym}:`, botError);
          statuses[sym] = {
            running: false,
            error: botError.message
          };
        }
      }
      return res.json(statuses);
    }

    // Если символ указан, возвращаем статус только этого бота
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

    try {
      // Получаем ticker для расчета текущего PnL
      let currentPrice = null;
      try {
        const ticker = await activeBots[symbol].api.getTicker(symbol);
        if (ticker && ticker.data && ticker.data[0]) {
          currentPrice = parseFloat(ticker.data[0].last);
        }
      } catch (tickerError) {
        console.warn(`Failed to get current price for ${symbol}:`, tickerError.message);
      }
      
      // Получаем статистику бота
      const stats = activeBots[symbol].getStats();
      
      // Если есть открытая позиция и текущая цена, рассчитываем PnL
      if (stats.openPosition && currentPrice) {
        stats.openPosition.currentPrice = currentPrice;
        
        // Расчет PnL для открытой позиции
        if (stats.openPosition.direction === 'LONG') {
          stats.openPosition.pnl = (currentPrice - stats.openPosition.entryPrice) / stats.openPosition.entryPrice * 100;
        } else { // SHORT
          stats.openPosition.pnl = (stats.openPosition.entryPrice - currentPrice) / stats.openPosition.entryPrice * 100;
        }
      }

      res.json({
        running: activeBots[symbol].isRunning(),
        uptime: activeBots[symbol].getUptime(),
        stats
      });
    } catch (error) {
      console.error(`Error getting status for bot ${symbol}:`, error);
      res.status(500).json({ 
        running: false,
        error: error.message
      });
    }
  } catch (error) {
    console.error('Error getting bot status:', error);
    res.status(500).json({ error: error.message });
  }
};

// Исправления для остальных методов контроллера также должны иметь доступ к переменной activeBots
// Добавьте ее в модуль exports, чтобы она была доступна для других методов
exports.activeBots = activeBots;
/**
 * Сканирование всех доступных торговых пар для поиска сигналов
 * @route GET /api/bot/scan-pairs
 */
exports.scanPairs = async (req, res) => {
  try {
    console.log('Запуск сканирования торговых пар...');
    
    // Создаем экземпляр API
    const api = new BitgetAPI();
    
    // Получаем список всех доступных символов
    const symbols = await api.getSymbols();
    
    if (!symbols || !symbols.data || !Array.isArray(symbols.data)) {
      return res.status(500).json({ 
        error: 'Не удалось получить список символов' 
      });
    }
    
    console.log(`Получено ${symbols.data.length} символов`);
    
    // Фильтруем только USDT-фьючерсы и извлекаем символы
    const futuresSymbols = symbols.data
      .filter(item => item && item.symbol && item.symbol.endsWith('USDT'))
      .map(item => item.symbol);
    
    console.log(`Отфильтровано ${futuresSymbols.length} USDT фьючерсов`);
    
    // Создаем массив для хранения результатов анализа пар
    const results = [];
    
    // Определяем максимальное количество пар для анализа
    // (ограничиваем для производительности)
    const maxPairsToAnalyze = Math.min(30, futuresSymbols.length);
    
    // Перемешиваем массив символов для случайного порядка анализа
    const shuffledSymbols = futuresSymbols
      .sort(() => 0.5 - Math.random())
      .slice(0, maxPairsToAnalyze);
    
    console.log(`Будет проанализировано ${shuffledSymbols.length} случайных пар`);
    
    // Получаем конфигурацию для анализатора
    const defaultConfig = {
      autoSwitching: {
        volatilityThreshold: 1.5,
        volumeThreshold: 2.0,
        trendStrengthThreshold: 0.6
      }
    };
    
    // Анализируем каждый символ
    for (const symbol of shuffledSymbols) {
      try {
        console.log(`Анализ пары ${symbol}...`);
        
        // Проверяем, есть ли сохраненная конфигурация для этой пары
        let botConfig = await BotConfig.findOne({ symbol });
        
        if (!botConfig) {
          botConfig = defaultConfig;
        }
        
        // Создаем экземпляр анализатора рынка
        const marketAnalyzer = new MarketAnalyzer(symbol, botConfig, api);
        
        // Проводим анализ рыночных условий
        const analysis = await marketAnalyzer.analyzeMarketConditions();
        
        // Сохраняем результаты анализа
        results.push({
          symbol,
          ...analysis
        });
        
        console.log(`Анализ пары ${symbol} завершен, рекомендуемая стратегия: ${analysis.recommendedStrategy}`);
      } catch (error) {
        console.error(`Ошибка при анализе пары ${symbol}:`, error);
        // Пропускаем эту пару и продолжаем
      }
    }
    
    // Сортируем результаты по уровню уверенности (по убыванию)
    results.sort((a, b) => b.confidence - a.confidence);
    
    console.log(`Сканирование завершено, найдено ${results.length} сигналов`);
    
    res.json(results);
  } catch (error) {
    console.error('Ошибка сканирования пар:', error);
    res.status(500).json({ error: error.message });
  }
};
/**
 * Получение статуса всех ботов
 * Это обновление для существующего метода getBotStatus
 */
exports.getBotStatus = async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      // Возвращаем статус всех ботов
      const statuses = {};
      for (const [sym, bot] of Object.entries(activeBots)) {
        try {
          // Получаем ticker для расчета текущего PnL
          let currentPrice = null;
          try {
            const ticker = await bot.api.getTicker(sym);
            if (ticker && ticker.data && ticker.data[0]) {
              currentPrice = parseFloat(ticker.data[0].last);
            }
          } catch (tickerError) {
            console.warn(`Failed to get current price for ${sym}:`, tickerError.message);
          }
          
          // Получаем статистику бота
          const stats = bot.getStats();
          
          // Если есть открытая позиция и текущая цена, рассчитываем PnL
          if (stats.openPosition && currentPrice) {
            stats.openPosition.currentPrice = currentPrice;
            
            // Расчет PnL для открытой позиции
            if (stats.openPosition.direction === 'LONG') {
              stats.openPosition.pnl = (currentPrice - stats.openPosition.entryPrice) / stats.openPosition.entryPrice * 100;
            } else { // SHORT
              stats.openPosition.pnl = (stats.openPosition.entryPrice - currentPrice) / stats.openPosition.entryPrice * 100;
            }
          }
          
          // Добавляем текущую конфигурацию бота в ответ
          statuses[sym] = {
            running: bot.isRunning(),
            uptime: bot.getUptime(),
            stats,
            // Включаем конфигурацию бота
            config: bot.config
          };
        } catch (botError) {
          console.error(`Error getting status for bot ${sym}:`, botError);
          statuses[sym] = {
            running: false,
            error: botError.message
          };
        }
      }
      return res.json(statuses);
    }

    // Если символ указан, возвращаем статус только этого бота
    if (!activeBots[symbol]) {
      // Пытаемся получить сохраненную конфигурацию из базы данных
      let savedConfig = null;
      try {
        const botConfig = await BotConfig.findOne({ symbol });
        if (botConfig) {
          savedConfig = botConfig.config;
        }
      } catch (dbError) {
        console.warn(`Error getting saved config for ${symbol}:`, dbError.message);
      }
      
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
        },
        // Включаем сохраненную конфигурацию, если есть
        config: savedConfig
      });
    }

    try {
      // Получаем ticker для расчета текущего PnL
      let currentPrice = null;
      try {
        const ticker = await activeBots[symbol].api.getTicker(symbol);
        if (ticker && ticker.data && ticker.data[0]) {
          currentPrice = parseFloat(ticker.data[0].last);
        }
      } catch (tickerError) {
        console.warn(`Failed to get current price for ${symbol}:`, tickerError.message);
      }
      
      // Получаем статистику бота
      const stats = activeBots[symbol].getStats();
      
      // Если есть открытая позиция и текущая цена, рассчитываем PnL
      if (stats.openPosition && currentPrice) {
        stats.openPosition.currentPrice = currentPrice;
        
        // Расчет PnL для открытой позиции
        if (stats.openPosition.direction === 'LONG') {
          stats.openPosition.pnl = (currentPrice - stats.openPosition.entryPrice) / stats.openPosition.entryPrice * 100;
        } else { // SHORT
          stats.openPosition.pnl = (stats.openPosition.entryPrice - currentPrice) / stats.openPosition.entryPrice * 100;
        }
      }

      res.json({
        running: activeBots[symbol].isRunning(),
        uptime: activeBots[symbol].getUptime(),
        stats,
        // Включаем конфигурацию бота
        config: activeBots[symbol].config
      });
    } catch (error) {
      console.error(`Error getting status for bot ${symbol}:`, error);
      res.status(500).json({ 
        running: false,
        error: error.message
      });
    }
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
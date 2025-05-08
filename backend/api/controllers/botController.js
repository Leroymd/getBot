// backend/api/controllers/botController.js
const Bot = require('../../services/Bot');
const BotConfig = require('../models/BotConfig');
const BitgetAPI = require('../../services/BitgetAPI');
const MarketAnalyzer = require('../../services/MarketAnalyzer');
const PairScanner = require('../../services/PairScanner');
const PairFilter = require('../../services/PairFilter');
const CorrelationAnalyzer = require('../../services/CorrelationAnalyzer');
const LiquidationAnalyzer = require('../../services/LiquidationAnalyzer');

// Инициализация сервисов
const pairScanner = new PairScanner();
const pairFilter = new PairFilter();
const correlationAnalyzer = new CorrelationAnalyzer();
const liquidationAnalyzer = new LiquidationAnalyzer();

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
      try {
        const savedConfig = await BotConfig.findOne({ symbol });
        if (savedConfig) {
          botConfig = savedConfig;
        } else {
          botConfig = defaultConfig;
        }
      } catch (error) {
        console.warn(`Error retrieving configuration from database: ${error.message}`);
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
 * Получение статуса всех ботов
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
          savedConfig = botConfig;
        }
      } catch (dbError) {
        console.warn(`Error getting saved config for ${symbol}:`, dbError.message);
      }
      
      // Получаем анализ рынка для этого символа, чтобы заполнить lastMarketAnalysis
      let marketAnalysis = null;
      try {
        // Создаем анализатор с дефолтной конфигурацией
        const api = new BitgetAPI();
        const analyzer = new MarketAnalyzer(symbol, {
          autoSwitching: {
            volatilityThreshold: 1.5,
            volumeThreshold: 2.0,
            trendStrengthThreshold: 0.6
          }
        }, api);
        
        // Используем Promise с обработкой ошибок и таймаутом
        const analysisPromise = new Promise((resolve, reject) => {
          analyzer.analyzeMarketConditions('1h', (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
        
        // Таймаут 10 секунд для анализа
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Market analysis timed out')), 10000)
        );
        
        // Ждем результат с таймаутом
        marketAnalysis = await Promise.race([analysisPromise, timeoutPromise]);
        
        console.log(`Retrieved market analysis for ${symbol} for bot status`);
      } catch (analysisError) {
        console.warn(`Failed to get market analysis for ${symbol}:`, analysisError.message);
        // Создаем дефолтный анализ при ошибке
        marketAnalysis = {
          recommendedStrategy: 'DCA',
          marketType: 'UNKNOWN',
          volatility: 0,
          volumeRatio: 0,
          trendStrength: 0,
          confidence: 0.5,
          timestamp: Date.now()
        };
      }
      
      return res.json({
        running: false,
        stats: {
          totalTrades: 0,
          winTrades: 0,
          lossTrades: 0,
          totalPnl: 0,
          maxDrawdown: 0,
          currentBalance: savedConfig?.common?.initialBalance || 100,
          initialBalance: savedConfig?.common?.initialBalance || 100,
          tradesToday: 0,
          hourlyTrades: Array(24).fill(0),
          hourlyPnl: Array(24).fill(0),
          strategyPerformance: {
            DCA: { trades: 0, winRate: 0, avgProfit: 0, avgLoss: 0 },
            SCALPING: { trades: 0, winRate: 0, avgProfit: 0, avgLoss: 0 }
          },
          lastMarketAnalysis: marketAnalysis ? {
            timestamp: marketAnalysis.timestamp || Date.now(),
            recommendedStrategy: marketAnalysis.recommendedStrategy || 'DCA',
            marketType: marketAnalysis.marketType || 'UNKNOWN',
            volatility: marketAnalysis.volatility || 0,
            volumeRatio: marketAnalysis.volumeRatio || 0,
            trendStrength: marketAnalysis.trendStrength || 0,
            confidence: marketAnalysis.confidence || 0.5
          } : {
            timestamp: Date.now(),
            recommendedStrategy: 'DCA',
            marketType: 'UNKNOWN',
            volatility: 0,
            volumeRatio: 0,
            trendStrength: 0,
            confidence: 0.5
          },
          activeStrategy: savedConfig?.activeStrategy || 'DCA'
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
      
      // Проверяем, что статистика бота не пустая и содержит все необходимые поля
      if (!stats.strategyPerformance || !stats.lastMarketAnalysis) {
        console.warn(`Bot stats for ${symbol} is missing essential fields, reinitializing...`);
        
        // Пытаемся принудительно получить свежий анализ рынка
        try {
          await activeBots[symbol].updateActiveStrategy();
        } catch (updateError) {
          console.error(`Failed to update active strategy for ${symbol}:`, updateError);
        }
        
        // Запрашиваем статистику заново
        const refreshedStats = activeBots[symbol].getStats();
        
        // Если статистика все еще неполная, создаем дефолтную структуру
        if (!refreshedStats.strategyPerformance || !refreshedStats.lastMarketAnalysis) {
          stats.strategyPerformance = stats.strategyPerformance || {
            DCA: { trades: 0, winRate: 0, avgProfit: 0, avgLoss: 0 },
            SCALPING: { trades: 0, winRate: 0, avgProfit: 0, avgLoss: 0 }
          };
          
          stats.lastMarketAnalysis = stats.lastMarketAnalysis || {
            timestamp: Date.now(),
            recommendedStrategy: 'DCA',
            marketType: 'UNKNOWN',
            volatility: 0,
            volumeRatio: 0,
            trendStrength: 0,
            confidence: 0.5
          };
        }
      }
      
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

    // Обновляем конфигурацию в базе данных независимо от того, запущен бот или нет
    try {
      let botConfig = await BotConfig.findOne({ symbol });
      
      if (botConfig) {
        // Обновляем существующую конфигурацию
        botConfig.activeStrategy = strategy;
        await botConfig.save();
        console.log(`Updated configuration in database for ${symbol}, strategy: ${strategy}`);
      } else {
        // Создаем новую конфигурацию с выбранной стратегией
        botConfig = new BotConfig({ 
          symbol, 
          activeStrategy: strategy,
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
        });
        await botConfig.save();
        console.log(`Created new configuration in database for ${symbol}, strategy: ${strategy}`);
      }
    } catch (dbError) {
      console.warn(`Database error while saving strategy for ${symbol}: ${dbError.message}`);
      // Продолжаем выполнение даже при ошибке базы данных
    }
    
    // Если бот активен, обновляем его стратегию в реальном времени
    let currentStrategy = strategy;
    if (activeBots[symbol]) {
      currentStrategy = activeBots[symbol].setStrategy(strategy);
      console.log(`Updated strategy for running bot ${symbol} to ${currentStrategy}`);
    } else {
      console.log(`Bot for ${symbol} is not running, configuration saved for future use`);
    }
    
    res.json({ 
      success: true, 
      message: activeBots[symbol] 
        ? `Strategy changed to ${strategy} for running bot ${symbol}` 
        : `Strategy ${strategy} saved for ${symbol} (bot not running)`,
      currentStrategy,
      botRunning: !!activeBots[symbol]
    });
  } catch (error) {
    console.error('Error setting strategy:', error);
    res.status(500).json({ error: error.message });
  }
};

/// Исправленная версия метода analyzeMarket в botController.js с поддержкой generateTradingSignals
exports.analyzeMarket = async (req, res) => {
  try {
    const { symbol, limit } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    // Ограничение запроса (по умолчанию 100)
    const requestLimit = limit ? parseInt(limit) : 100;

    console.log(`Market analysis requested for symbol: ${symbol}, limit: ${requestLimit}`);

    // Настройки для анализатора рынка
    let config = {
      autoSwitching: {
        volatilityThreshold: 1.5,
        volumeThreshold: 2.0,
        trendStrengthThreshold: 0.6
      }
    };

    // Создаем синтетические данные для ответа в случае ошибки
    const syntheticResponse = {
      recommendedStrategy: 'DCA',
      marketType: 'RANGING',
      volatility: 1.2,
      volumeRatio: 1.0,
      trendStrength: 0.4,
      confidence: 0.7,
      indicators: {
        rsi: 50,
        macd: 'NEUTRAL',
        bollingerWidth: 1.2,
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
      timeframe: '1h',
      symbol,
      signals: {
        action: 'HOLD',
        confidence: 0.5,
        entryPrice: 0,
        stopLoss: 0,
        takeProfit: 0,
        reason: 'Using synthetic data',
        timestamp: Date.now(),
        timeframe: '1h',
        synthetic: true
      }
    };

    try {
      // Создание API клиента с обработкой исключений
      const api = new BitgetAPI();
      let marketAnalyzer;
      
      try {
        marketAnalyzer = new MarketAnalyzer(symbol, config, api);
        console.log(`MarketAnalyzer created for ${symbol}`);
      } catch (initError) {
        console.error('Error initializing market analyzer:', initError);
        
        // В случае ошибки инициализации возвращаем синтетические данные
        return res.json({
          ...syntheticResponse,
          _source: 'synthetic-init-error',
          message: `Не удалось инициализировать анализатор: ${initError.message}`
        });
      }
      
      // Устанавливаем таймаут для анализа
      const analysisPromise = new Promise((resolve, reject) => {
        marketAnalyzer.analyzeMarketConditions('1h', (err, analysis) => {
          if (err) {
            console.error(`Error in analyzeMarketConditions for ${symbol}:`, err);
            reject(err);
          } else {
            // Проверяем, есть ли метод generateTradingSignals в анализаторе
            if (typeof marketAnalyzer.generateTradingSignals === 'function') {
              // Генерируем торговые сигналы
              marketAnalyzer.generateTradingSignals('1h', (signalErr, signals) => {
                if (signalErr) {
                  console.error(`Error generating trading signals for ${symbol}:`, signalErr);
                  // Добавляем базовый сигнал, чтобы не возвращать ошибку
                  analysis.signals = {
                    action: 'HOLD',
                    confidence: 0.5,
                    reason: `Error generating signals: ${signalErr.message}`,
                    timestamp: Date.now(),
                    timeframe: '1h',
                    synthetic: true
                  };
                } else {
                  // Добавляем сигналы к результату анализа
                  analysis.signals = signals;
                }
                resolve(analysis);
              });
            } else {
              // Если метод не найден, добавляем заглушку сигнала
              console.warn(`generateTradingSignals method not found in MarketAnalyzer for ${symbol}`);
              analysis.signals = {
                action: 'HOLD',
                confidence: 0.5,
                reason: 'Signal generation not available',
                timestamp: Date.now(),
                timeframe: '1h',
                synthetic: true
              };
              resolve(analysis);
            }
          }
        });
      });
      
      // Добавляем таймаут, чтобы не зависал запрос
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Analysis timed out')), 15000)
      );
      
      try {
        // Используем Promise.race с таймаутом для предотвращения зависания
        const analysis = await Promise.race([analysisPromise, timeoutPromise]);
        
        console.log(`Analysis completed for ${symbol}:`, JSON.stringify(analysis).substring(0, 200) + '...');
        
        return res.json({
          ...analysis,
          symbol
        });
      } catch (analysisError) {
        console.error('Error during market analysis:', analysisError);
        
        // В случае ошибки анализа возвращаем синтетические данные с сообщением об ошибке
        return res.json({
          ...syntheticResponse,
          _source: 'synthetic-analysis-error',
          error: analysisError.message,
          message: 'Не удалось проанализировать рыночные условия, используются приблизительные данные'
        });
      }
    } catch (generalError) {
      console.error('General error in analyzeMarket:', generalError);
      
      // В случае общей ошибки возвращаем синтетические данные
      return res.json({
        ...syntheticResponse,
        _source: 'synthetic-general-error',
        message: 'Произошла ошибка при анализе рынка, используются приблизительные данные'
      });
    }
  } catch (error) {
    console.error('Unhandled error in analyzeMarket route:', error);
    
    // В случае неперехваченной ошибки возвращаем сообщение об ошибке, но не 500 статус
    res.json({ 
      error: 'Failed to analyze market conditions',
      details: error.message,
      _source: 'error-handler',
      recommendedStrategy: 'DCA', // Дефолтная стратегия
      symbol: req.query.symbol || 'UNKNOWN',
      message: 'Возникла неожиданная ошибка при анализе рынка'
    });
  }
};



exports.scanPairs = async (req, res) => {
  try {
    const {
      minVolume = 10000, // Снижен порог для минимального объема
      minScore = 0,
      maxPairs = 100,
      filterByBase = '',
      timeframes = '',
      forceRefresh = 'false'
    } = req.query;
    
    console.log(`Scan pairs request received with parameters:`, {
      minVolume, minScore, maxPairs, filterByBase, timeframes, forceRefresh
    });
    
    // Настраиваем параметры сканирования
    const scanOptions = {
      minVolume: parseFloat(minVolume),
      maxPairs: parseInt(maxPairs)
    };
    
    if (filterByBase) {
      // Преобразуем строку с разделителями в массив
      scanOptions.filterByBase = filterByBase.split(',');
    }
    
    if (timeframes) {
      scanOptions.timeframes = timeframes.split(',');
    } else {
      // Значения по умолчанию, включая более быстрые таймфреймы
      scanOptions.timeframes = ['1h', '4h', '1d'];
    }
    
    // Проверяем, нужно ли принудительное обновление
    const forceRescan = forceRefresh === 'true';
    
    // Используем промисы вместо колбэков
    const performFullScan = () => {
      return new Promise((resolve, reject) => {
        console.log('Starting full pair scan with options:', scanOptions);
        
        // Запускаем полное сканирование
        pairScanner.scanAllPairs(scanOptions, (err, scanResults) => {
          if (err) {
            console.error('Error performing full scan:', err);
            reject(err);
            return;
          }
          
          resolve(scanResults);
        });
      });
    };
    
    // Если нет принудительного обновления, пробуем получить кэшированные результаты
    if (!forceRescan) {
      try {
        // Создаем объект фильтров для запроса кэша
        const filters = {};
        
        if (minScore && parseFloat(minScore) > 0) {
          filters.minScore = parseFloat(minScore);
        }
        
        if (minVolume && parseFloat(minVolume) > 0) {
          filters.minVolume = parseFloat(minVolume);
        }
        
        if (filterByBase) {
          filters.baseCoin = filterByBase;
        }
        
        console.log('Trying to get cached scan results with filters:', filters);
        
        // Используем промис вместо колбэка
        const getCachedResults = () => {
          return new Promise((resolve, reject) => {
            pairScanner.getLastScanResults(filters, (err, cachedResults) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(cachedResults);
            });
          });
        };
        
        try {
          const cachedResults = await getCachedResults();
          
          if (cachedResults && cachedResults.results && cachedResults.results.length > 0 && 
              cachedResults.scanTime && 
              (new Date() - new Date(cachedResults.scanTime)) < 60 * 60 * 1000) {
            // Если есть результаты и они свежие (не старше 1 часа), возвращаем их
            console.log(`Returning ${cachedResults.results.length} cached results from ${cachedResults.scanTime}`);
            return res.json({
              results: cachedResults.results,
              scanTime: cachedResults.scanTime,
              totalScanned: cachedResults.totalScanned,
              fromCache: true
            });
          } else {
            console.log('Cache is empty or expired, performing full scan');
            // Если кэш устарел или пуст, выполняем полное сканирование
            const scanResults = await performFullScan();
            
            // Проверяем, есть ли результаты
            if (!scanResults.results || scanResults.results.length === 0) {
              console.warn('Scan completed but no results were returned');
              return res.json({
                results: [],
                scanTime: new Date(),
                totalScanned: 0,
                fromCache: false,
                message: 'Сканирование завершено, но пары не найдены.'
              });
            }
            
            console.log(`Scan completed successfully with ${scanResults.results.length} results`);
            return res.json({
              results: scanResults.results,
              scanTime: scanResults.scanTime,
              totalScanned: scanResults.totalScanned,
              fromCache: false
            });
          }
        } catch (cacheError) {
          console.warn('Error with cache retrieval:', cacheError.message);
          // В случае ошибки с кэшем, выполняем полное сканирование
          const scanResults = await performFullScan();
          
          // Проверяем, есть ли результаты
          if (!scanResults.results || scanResults.results.length === 0) {
            console.warn('Scan completed but no results were returned');
            return res.json({
              results: [],
              scanTime: new Date(),
              totalScanned: 0,
              fromCache: false,
              message: 'Сканирование завершено, но пары не найдены.'
            });
          }
          
          console.log(`Scan completed successfully with ${scanResults.results.length} results`);
          return res.json({
            results: scanResults.results,
            scanTime: scanResults.scanTime,
            totalScanned: scanResults.totalScanned,
            fromCache: false
          });
        }
      } catch (error) {
        console.error('Error in cache handling:', error);
        // В случае ошибки, выполняем полное сканирование
        try {
          const scanResults = await performFullScan();
          
          // Проверяем, есть ли результаты
          if (!scanResults.results || scanResults.results.length === 0) {
            console.warn('Scan completed but no results were returned');
            return res.json({
              results: [],
              scanTime: new Date(),
              totalScanned: 0,
              fromCache: false,
              message: 'Сканирование завершено, но пары не найдены.'
            });
          }
          
          console.log(`Scan completed successfully with ${scanResults.results.length} results`);
          return res.json({
            results: scanResults.results,
            scanTime: scanResults.scanTime,
            totalScanned: scanResults.totalScanned,
            fromCache: false
          });
        } catch (scanError) {
          console.error('Error performing full scan:', scanError);
          return res.status(500).json({ 
            error: scanError.message,
            details: 'Произошла ошибка при сканировании пар'
          });
        }
      }
    } else {
      console.log('Force refresh requested, performing full scan');
      // Если требуется принудительное обновление, сразу запускаем полное сканирование
      try {
        const scanResults = await performFullScan();
        
        // Проверяем, есть ли результаты
        if (!scanResults.results || scanResults.results.length === 0) {
          console.warn('Scan completed but no results were returned');
          return res.json({
            results: [],
            scanTime: new Date(),
            totalScanned: 0,
            fromCache: false,
            message: 'Сканирование завершено, но пары не найдены.'
          });
        }
        
        console.log(`Scan completed successfully with ${scanResults.results.length} results`);
        return res.json({
          results: scanResults.results,
          scanTime: scanResults.scanTime,
          totalScanned: scanResults.totalScanned,
          fromCache: false
        });
      } catch (scanError) {
        console.error('Error performing full scan:', scanError);
        return res.status(500).json({ 
          error: scanError.message,
          details: 'Произошла ошибка при сканировании пар'
        });
      }
    }
  } catch (error) {
    console.error('Unexpected error in scanPairs:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      details: 'Произошла неожиданная ошибка в обработчике scanPairs'
    });
  }
};

// Создаем кэш для результатов сканирования
const scanResultsCache = new Map();

// Метод для анализа рынка конкретной пары и получения сигналов
exports.analyzeMarket = async (req, res) => {
  try {
    const { symbol, timeframe } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    // Время кэширования анализа - 5 минут
    const cacheKey = `marketAnalysis_${symbol}_${timeframe || '1h'}`;
    const cacheTimeout = 5 * 60 * 1000;
    const now = Date.now();

    // Проверяем кэш
    if (marketAnalysisCache.has(cacheKey)) {
      const cachedResult = marketAnalysisCache.get(cacheKey);
      if (cachedResult && now - cachedResult.timestamp < cacheTimeout) {
        console.log(`Using cached market analysis for ${symbol} (age: ${(now - cachedResult.timestamp) / 1000} seconds)`);
        return res.json(cachedResult.data);
      }
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
      
      // Создаем промисы для анализа рынка и генерации сигналов
      const analysisPromise = new Promise((resolve, reject) => {
        marketAnalyzer.analyzeMarketConditions(timeframe || '1h', (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      const signalsPromise = new Promise((resolve, reject) => {
        marketAnalyzer.generateTradingSignals(timeframe || '1h', (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      // Выполняем оба анализа параллельно
      const [analysis, signalsResult] = await Promise.all([
        Promise.race([analysisPromise, timeout]),
        Promise.race([signalsPromise, timeout])
      ]);
      
      // Объединяем результаты
      const result = {
        ...analysis,
        symbol,
        signals: signalsResult?.signals || []
      };
      
      // Сохраняем в кэш
      marketAnalysisCache.set(cacheKey, {
        timestamp: now,
        data: result
      });
      
      return res.json(result);
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

// Создаем кэш для результатов анализа рынка
const marketAnalysisCache = new Map();

// API для фильтрации по объему и другим параметрам
exports.filterPairs = async (req, res) => {
  try {
    const {
		maxPairs = 100,      // Достаточно для сканирования
     // minVolume = 1000000,
     // maxSpread = 0.5,
      //minPriceChange = 0,
     // maxPriceChange = 100,
     // filterByBase = '',
     // excludeBases = '',
     // excludeStablecoins = false,
     // minScore = 0,
     // sortBy = 'score',
     // sortDir = 'desc',
     // signalsOnly = 'false',
     // timeframe = '1h'
    } = req.query;
    
    // Преобразуем строки параметров в нужные типы
    const filterOptions = {
      minVolume: parseFloat(minVolume),
      maxSpread: parseFloat(maxSpread),
      minPriceChange: parseFloat(minPriceChange),
      maxPriceChange: parseFloat(maxPriceChange),
      filterByBase: filterByBase ? filterByBase.split(',') : [],
      excludeBases: excludeBases ? excludeBases.split(',') : [],
      excludeStablecoins: excludeStablecoins === 'true',
      minScore: parseFloat(minScore)
    };
    
    // Получаем результаты последнего сканирования через Promise
    const getLastScanResults = () => {
      return new Promise((resolve, reject) => {
        pairScanner.getLastScanResults({}, (err, scanResults) => {
          if (err) reject(err);
          else resolve(scanResults);
        });
      });
    };
    
    try {
      const scanResults = await getLastScanResults();
      
      if (!scanResults || !scanResults.results || scanResults.results.length === 0) {
        // Если нет результатов сканирования или произошла ошибка, запускаем быстрое сканирование
        const quickScanOptions = {
          maxPairs: 50,
          saveToDb: false,
          timeframes: [timeframe]
        };
        
        const doQuickScan = () => {
          return new Promise((resolve, reject) => {
            pairScanner.scanAllPairs(quickScanOptions, (err, newScanResults) => {
              if (err) reject(err);
              else resolve(newScanResults);
            });
          });
        };
        
        const newScanResults = await doQuickScan();
        
        // Применяем фильтры к новым результатам
        const doFilter = (pairs) => {
          return new Promise((resolve, reject) => {
            pairFilter.filterPairs(pairs, filterOptions, (err, filteredResults) => {
              if (err) reject(err);
              else resolve(filteredResults);
            });
          });
        };
        
        const filteredPairs = await doFilter(newScanResults.results);
        
        // Сортируем результаты
        const doSort = (pairs) => {
          return new Promise((resolve, reject) => {
            pairFilter.sortPairs(pairs, sortBy, sortDir, (err, sortedResults) => {
              if (err) reject(err);
              else resolve(sortedResults);
            });
          });
        };
        
        const sortedPairs = await doSort(filteredPairs);
        
        // Если требуется только сигналы, проанализируем каждую пару
        if (signalsOnly === 'true') {
          // Анализируем пары на предмет сигналов
          const pairsWithSignals = await analyzePairsForSignals(sortedPairs, timeframe);
          
          return res.json({
            results: pairsWithSignals,
            scanTime: newScanResults.scanTime,
            totalScanned: newScanResults.totalScanned,
            totalFiltered: filteredPairs.length,
            signalsCount: pairsWithSignals.length
          });
        }
        
        return res.json({
          results: sortedPairs,
          scanTime: newScanResults.scanTime,
          totalScanned: newScanResults.totalScanned,
          totalFiltered: filteredPairs.length
        });
      } else {
        // Применяем фильтры к существующим результатам
        const doFilter = (pairs) => {
          return new Promise((resolve, reject) => {
            pairFilter.filterPairs(pairs, filterOptions, (err, filteredResults) => {
              if (err) reject(err);
              else resolve(filteredResults);
            });
          });
        };
        
        const filteredPairs = await doFilter(scanResults.results);
        
        // Сортируем результаты
        const doSort = (pairs) => {
          return new Promise((resolve, reject) => {
            pairFilter.sortPairs(pairs, sortBy, sortDir, (err, sortedResults) => {
              if (err) reject(err);
              else resolve(sortedResults);
            });
          });
        };
        
        const sortedPairs = await doSort(filteredPairs);
        
        // Если требуется только сигналы, проанализируем каждую пару
        if (signalsOnly === 'true') {
          // Анализируем пары на предмет сигналов
          const pairsWithSignals = await analyzePairsForSignals(sortedPairs, timeframe);
          
          return res.json({
            results: pairsWithSignals,
            scanTime: scanResults.scanTime,
            totalScanned: scanResults.totalScanned,
            totalFiltered: filteredPairs.length,
            signalsCount: pairsWithSignals.length
          });
        }
        
        res.json({
          results: sortedPairs,
          scanTime: scanResults.scanTime,
          totalScanned: scanResults.totalScanned,
          totalFiltered: filteredPairs.length
        });
      }
    } catch (error) {
      console.error('Error filtering pairs:', error);
      res.status(500).json({ error: error.message });
    }
    
    // Вспомогательная функция для анализа пар на наличие сигналов
    async function analyzePairsForSignals(pairs, timeframe) {
      const pairsWithSignals = [];
      
      for (const pair of pairs) {
        try {
          // Создаем анализатор рынка для пары
          const analyzer = new MarketAnalyzer(pair.symbol, {
            autoSwitching: {
              volatilityThreshold: 1.5,
              volumeThreshold: 2.0,
              trendStrengthThreshold: 0.6
            }
          });
          
          // Анализируем рынок для пары
          const analysis = await new Promise((resolve, reject) => {
            analyzer.analyzeMarketConditions(timeframe, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
          
          // Если есть сигналы, добавляем пару в результат
          if (analysis.signals && analysis.signals.length > 0) {
            pairsWithSignals.push({
              ...pair,
              signals: analysis.signals,
              marketType: analysis.marketType,
              indicators: analysis.indicators
            });
          }
        } catch (error) {
          console.warn(`Error analyzing signals for ${pair.symbol}:`, error.message);
          // Продолжаем с остальными парами
          continue;
        }
      }
      
      // Сортируем пары по силе сигналов
      return pairsWithSignals.sort((a, b) => {
        // Находим максимальную силу сигнала для каждой пары
        const maxStrengthA = Math.max(...(a.signals || []).map(s => s.strength || 0));
        const maxStrengthB = Math.max(...(b.signals || []).map(s => s.strength || 0));
        
        // Сортируем по убыванию силы сигнала
        return maxStrengthB - maxStrengthA;
      });
    }
  } catch (error) {
    console.error('Error filtering pairs:', error);
    res.status(500).json({ error: error.message });
  }
};

// Новый метод для анализа сигналов для конкретной пары
exports.getPairSignals = async (req, res) => {
  try {
    const { symbol, timeframe = '1h' } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    // Создаем анализатор рынка для пары
    const analyzer = new MarketAnalyzer(symbol, {
      autoSwitching: {
        volatilityThreshold: 1.5,
        volumeThreshold: 2.0,
        trendStrengthThreshold: 0.6
      }
    });
    
    // Анализируем рынок для пары
    analyzer.analyzeMarketConditions(timeframe, (err, analysis) => {
      if (err) {
        console.error(`Error analyzing signals for ${symbol}:`, err);
        return res.status(500).json({ error: err.message });
      }
      
      // Проверяем наличие сигналов
      if (!analysis.signals) {
        analysis.signals = [];
      }
      
      // Получаем текущую цену
      let currentPrice = null;
      try {
        const api = new BitgetAPI();
        api.getTicker(symbol, (tickerErr, ticker) => {
          if (!tickerErr && ticker && ticker.data && ticker.data[0]) {
            currentPrice = parseFloat(ticker.data[0].last);
          }
          
          res.json({
            symbol,
            timeframe,
            signals: analysis.signals,
            marketType: analysis.marketType,
            indicators: analysis.indicators,
            currentPrice,
            timestamp: Date.now()
          });
        });
      } catch (priceError) {
        console.warn(`Error getting current price for ${symbol}:`, priceError);
        
        // Возвращаем результат без текущей цены
        res.json({
          symbol,
          timeframe,
          signals: analysis.signals,
          marketType: analysis.marketType,
          indicators: analysis.indicators,
          timestamp: Date.now()
        });
      }
    });
  } catch (error) {
    console.error('Error getting pair signals:', error);
    res.status(500).json({ error: error.message });
  }
};

// API для анализа корреляций
exports.analyzeCorrelations = async (req, res) => {
  try {
    const { symbol, timeframe = '1h', limit = 100 } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    correlationAnalyzer.analyzeCorrelation(
      symbol, timeframe, parseInt(limit), (err, correlation) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json(correlation);
      }
    );
  } catch (error) {
    console.error('Error analyzing correlations:', error);
    res.status(500).json({ error: error.message });
  }
};

// API для получения корреляционной матрицы
exports.getCorrelationMatrix = async (req, res) => {
  try {
    const { symbols, timeframe = '1h', limit = 100 } = req.query;
    
    if (!symbols) {
      return res.status(400).json({ error: 'Symbols list is required' });
    }
    
    const symbolsList = symbols.split(',');
    
    if (symbolsList.length < 2) {
      return res.status(400).json({ error: 'At least 2 symbols are required' });
    }
    
    if (symbolsList.length > 10) {
      return res.status(400).json({ 
        error: 'Too many symbols, maximum allowed is 10 for performance reasons'
      });
    }
    
    correlationAnalyzer.getCorrelationMatrix(
      symbolsList, timeframe, parseInt(limit), (err, matrix) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json(matrix);
      }
    );
  } catch (error) {
    console.error('Error generating correlation matrix:', error);
    res.status(500).json({ error: error.message });
  }
};

// API для поиска пар для диверсификации
exports.findDiversificationPairs = async (req, res) => {
  try {
    const { baseSymbols, candidateSymbols, timeframe = '1h', limit = 100 } = req.query;
    
    if (!baseSymbols || !candidateSymbols) {
      return res.status(400).json({ 
        error: 'Both baseSymbols and candidateSymbols are required' 
      });
    }
    
    const baseList = baseSymbols.split(',');
    let candList = candidateSymbols.split(',');
    
    // Если список кандидатов слишком большой, используем недавние результаты сканирования
    if (candList.length > 20 || candList[0] === 'ALL') {
      pairScanner.getLastScanResults({}, (err, scanResults) => {
        if (!err && scanResults && scanResults.results && scanResults.results.length > 0) {
          candList = scanResults.results.slice(0, 50).map(r => r.symbol);
        }
        
        correlationAnalyzer.findDiversificationPairs(
          baseList, candList, timeframe, parseInt(limit), (err, pairs) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            res.json(pairs);
          }
        );
      });
    } else {
      correlationAnalyzer.findDiversificationPairs(
        baseList, candList, timeframe, parseInt(limit), (err, pairs) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json(pairs);
        }
      );
    }
  } catch (error) {
    console.error('Error finding diversification pairs:', error);
    res.status(500).json({ error: error.message });
  }
};

// API для получения данных о ликвидациях
exports.getLiquidations = async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    liquidationAnalyzer.getLiquidations(symbol, (err, liquidations) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(liquidations);
    });
  } catch (error) {
    console.error('Error getting liquidations:', error);
    res.status(500).json({ error: error.message });
  }
};

// API для анализа ликвидаций
exports.analyzeLiquidations = async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    liquidationAnalyzer.analyzeLiquidations(symbol, (err, analysis) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(analysis);
    });
  } catch (error) {
    console.error('Error analyzing liquidations:', error);
    res.status(500).json({ error: error.message });
  }
};

// API для прогнозирования точек разворота
exports.predictReversalPoints = async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    liquidationAnalyzer.predictReversalPoints(symbol, (err, reversals) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(reversals);
    });
  } catch (error) {
    console.error('Error predicting reversal points:', error);
    res.status(500).json({ error: error.message });
  }
};

// Экспортируем объект activeBots для использования в других модулях
exports.activeBots = activeBots;
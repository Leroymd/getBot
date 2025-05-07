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

// Улучшенное сканирование пар
exports.scanPairs = async (req, res) => {
  try {
    const {
      minVolume,
      minScore,
      maxPairs,
      filterByBase,
      timeframes,
      forceRefresh
    } = req.query;
    
    // Настраиваем параметры сканирования
    const scanOptions = {};
    
    if (minVolume) scanOptions.minVolume = parseFloat(minVolume);
    if (maxPairs) scanOptions.maxPairs = parseInt(maxPairs);
    if (filterByBase) {
      // Преобразуем строку с разделителями в массив
      scanOptions.filterByBase = filterByBase.split(',');
    }
    if (timeframes) {
      scanOptions.timeframes = timeframes.split(',');
    }
    
    // Проверяем, нужно ли принудительное обновление
    const forceRescan = forceRefresh === 'true';
    
    // Если нет принудительного обновления, пробуем получить кэшированные результаты
    if (!forceRescan) {
      try {
        // Создаем объект фильтров для запроса кэша
        const filters = {};
        
        if (minScore) filters.minScore = parseFloat(minScore);
        if (minVolume) filters.minVolume = parseFloat(minVolume);
        if (filterByBase) filters.baseCoin = filterByBase;
        
        // Используем функцию как callback для получения результатов
        pairScanner.getLastScanResults(filters, (err, cachedResults) => {
          if (err) {
            console.warn('Error retrieving cached scan results:', err.message);
            // Продолжаем с полным сканированием
            performFullScan();
          } else if (cachedResults && cachedResults.results.length > 0 && 
              cachedResults.scanTime && 
              (new Date() - new Date(cachedResults.scanTime)) < 60 * 60 * 1000) {
            // Если есть результаты и они свежие (не старше 1 часа), возвращаем их
            return res.json({
              results: cachedResults.results,
              scanTime: cachedResults.scanTime,
              totalScanned: cachedResults.totalScanned,
              fromCache: true
            });
          } else {
            // Если кэш устарел или пуст, выполняем полное сканирование
            performFullScan();
          }
        });
      } catch (cacheError) {
        console.warn('Error with cache retrieval:', cacheError.message);
        performFullScan();
      }
    } else {
      // Если требуется принудительное обновление, сразу запускаем полное сканирование
      performFullScan();
    }

    // Функция для выполнения полного сканирования
    async function performFullScan() {
      console.log('Starting full pair scan...');
      
      // Запускаем полное сканирование
      pairScanner.scanAllPairs(scanOptions, (err, scanResults) => {
        if (err) {
          console.error('Error performing full scan:', err);
          return res.status(500).json({ error: err.message });
        }
        
        res.json({
          results: scanResults.results,
          scanTime: scanResults.scanTime,
          totalScanned: scanResults.totalScanned,
          fromCache: false
        });
      });
    }
  } catch (error) {
    console.error('Error scanning pairs:', error);
    res.status(500).json({ error: error.message });
  }
};

// API для фильтрации по объему и другим параметрам
exports.filterPairs = async (req, res) => {
  try {
    const {
      minVolume = 1000000,
      maxSpread = 0.5,
      minPriceChange = 0,
      maxPriceChange = 100,
      filterByBase = '',
      excludeBases = '',
      excludeStablecoins = false,
      minScore = 0,
      sortBy = 'score',
      sortDir = 'desc'
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
    
    // Получаем результаты последнего сканирования через callback
    pairScanner.getLastScanResults({}, (err, scanResults) => {
      if (err || !scanResults || !scanResults.results || scanResults.results.length === 0) {
        // Если нет результатов сканирования или произошла ошибка, запускаем быстрое сканирование
        const quickScanOptions = {
          maxPairs: 50,
          saveToDb: false
        };
        
        pairScanner.scanAllPairs(quickScanOptions, (scanErr, newScanResults) => {
          if (scanErr) {
            return res.status(500).json({ error: scanErr.message });
          }
          
          // Применяем фильтры к новым результатам
          const filteredPairs = pairFilter.filterPairs(newScanResults.results, filterOptions);
          
          // Сортируем результаты
          const sortedPairs = pairFilter.sortPairs(filteredPairs, sortBy, sortDir);
          
          return res.json({
            results: sortedPairs,
            scanTime: newScanResults.scanTime,
            totalScanned: newScanResults.totalScanned,
            totalFiltered: filteredPairs.length
          });
        });
      } else {
        // Применяем фильтры к существующим результатам
        const filteredPairs = pairFilter.filterPairs(scanResults.results, filterOptions);
        
        // Сортируем результаты
        const sortedPairs = pairFilter.sortPairs(filteredPairs, sortBy, sortDir);
        
        res.json({
          results: sortedPairs,
          scanTime: scanResults.scanTime,
          totalScanned: scanResults.totalScanned,
          totalFiltered: filteredPairs.length
        });
      }
    });
  } catch (error) {
    console.error('Error filtering pairs:', error);
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
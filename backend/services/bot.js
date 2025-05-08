// backend/services/Bot.js
const Trade = require('../api/models/Trade');
const ScalpingStrategy = require('./strategies/ScalpingStrategy');
const DCAStrategy = require('./strategies/DCAStrategy');
const AutoSwitchingStrategy = require('./strategies/AutoSwitchingStrategy');
const SignalAnalyzer = require('./SignalAnalyzer');
const SignalSettings = require('../models/SignalSettings');

/**
 * Класс торгового бота BitGet
 */
class Bot {
  /**
   * Конструктор бота
   * @param {string} symbol - Торговая пара
   * @param {object} config - Конфигурация бота
   * @param {object} api - Экземпляр API BitGet
   * @param {object} options - Дополнительные опции
   */
  constructor(symbol, config, api, options = {}) {
    this.symbol = symbol;
    this.config = this.normalizeConfig(config);
    this.api = api;
    this.isActive = false;
    this.interval = null;
    this.openPosition = null;
    this.botId = options.botId || `bot_${symbol}_${Date.now()}`;
    this.startTime = null;
    this.lastTick = null;
    this.logger = options.logger || console;
    this.demo = options.demo || true;
    
    // Стратегии
    this.scalping = new ScalpingStrategy(this.symbol, this.config.scalping, this.api);
    this.dcaStrategy = new DCAStrategy(this.symbol, this.config.dca, this.api);
    this.autoSwitchingStrategy = new AutoSwitchingStrategy(this.symbol, this.config.autoSwitching, this.api, {
      scalping: this.scalping,
      dca: this.dcaStrategy
    });
    
    // Текущая активная стратегия
    this.currentStrategy = this.config.activeStrategy === 'SCALPING' ? 
      this.scalping : (this.config.activeStrategy === 'AUTO' ? 
        this.autoSwitchingStrategy : this.dcaStrategy);
    
    // Анализатор сигналов
    this.signalAnalyzer = new SignalAnalyzer(this.symbol, this.config, this.api);
    
    // Инициализация статистики
    this.stats = {
      totalTrades: 0,
      winTrades: 0,
      lossTrades: 0,
      totalPnl: 0,
      maxDrawdown: 0,
      currentBalance: this.config.common.initialBalance || 100,
      initialBalance: this.config.common.initialBalance || 100,
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
      activeStrategy: this.config.activeStrategy || 'DCA'
    };
    
    // Загружаем настройки сигналов
    this.loadSignalSettings();
    
    this.logger.log(`Bot created for ${symbol} with strategy ${this.config.activeStrategy}`);
  }

  /**
   * Нормализация конфигурации бота
   * @param {object} config - Конфигурация бота
   * @returns {object} - Нормализованная конфигурация
   */
  normalizeConfig(config) {
    // Дефолтная конфигурация
    const defaultConfig = {
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
      },
      activeStrategy: 'DCA'
    };

    // Объединяем с пользовательской конфигурацией
    return {
      common: { ...defaultConfig.common, ...(config.common || {}) },
      dca: { ...defaultConfig.dca, ...(config.dca || {}) },
      scalping: { ...defaultConfig.scalping, ...(config.scalping || {}) },
      autoSwitching: { ...defaultConfig.autoSwitching, ...(config.autoSwitching || {}) },
      activeStrategy: config.activeStrategy || defaultConfig.activeStrategy
    };
  }

  /**
   * Загрузка настроек сигналов
   */
  async loadSignalSettings() {
    try {
      // Попытка загрузить настройки из базы данных
      let settings = await SignalSettings.findOne({ symbol: this.symbol });
      
      if (!settings) {
        // Если настроек нет, создаем дефолтные
        settings = new SignalSettings({ symbol: this.symbol });
        await settings.save();
        this.logger.log(`Created default signal settings for ${this.symbol}`);
      } else {
        this.logger.log(`Loaded signal settings for ${this.symbol}`);
      }
      
      // Обновляем анализатор сигналов
      this.signalAnalyzer.updateSettings(settings);
      
    } catch (error) {
      this.logger.error(`Error loading signal settings for ${this.symbol}:`, error);
      // Продолжаем работу с дефолтными настройками
    }
  }

  /**
   * Обновление настроек анализа сигналов
   * @param {object} newSettings - Новые настройки
   * @returns {boolean} - Успешность обновления
   */
  async updateSignalSettings(newSettings) {
    try {
      this.signalAnalyzer.updateSettings(newSettings);
      this.logger.log(`Signal settings updated for ${this.symbol}`);
      return true;
    } catch (error) {
      this.logger.error(`Error updating signal settings for ${this.symbol}:`, error);
      return false;
    }
  }

  /**
   * Запуск бота
   * @returns {boolean} - Успешность запуска
   */
  start() {
    if (this.isActive) {
      this.logger.log(`Bot already running for ${this.symbol}`);
      return false;
    }

    this.isActive = true;
    this.startTime = Date.now();
    this.logger.log(`Bot started for ${this.symbol}`);

    // Запуск первого тика
    setTimeout(() => this.tick(), 1000);

    return true;
  }

  /**
   * Остановка бота
   * @returns {boolean} - Успешность остановки
   */
  stop() {
    if (!this.isActive) {
      this.logger.log(`Bot already stopped for ${this.symbol}`);
      return false;
    }

    this.isActive = false;
    if (this.interval) {
      clearTimeout(this.interval);
      this.interval = null;
    }

    this.logger.log(`Bot stopped for ${this.symbol}`);
    return true;
  }

  /**
   * Проверка активности бота
   * @returns {boolean} - Активен ли бот
   */
  isRunning() {
    return this.isActive;
  }

  /**
   * Получение времени работы бота
   * @returns {number} - Время работы в миллисекундах
   */
  getUptime() {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }

  /**
   * Получение статистики бота
   * @returns {object} - Статистика бота
   */
  getStats() {
    return this.stats;
  }

  /**
   * Периодический тик бота
   */
  async tick() {
    try {
      if (!this.isActive) return;
      
      const now = Date.now();
      this.lastTick = now;
      
      this.logger.log(`[Bot ${this.symbol}] Tick executed at ${new Date().toLocaleTimeString()}`);
      
      // Получение текущей цены
      let ticker;
      try {
        ticker = await this.api.getTicker(this.symbol);
        if (!ticker || !ticker.data || !ticker.data[0]) {
          this.logger.error(`[Bot ${this.symbol}] Failed to get ticker data:`, ticker);
          return; // Выходим из тика, если не удалось получить данные
        }
      } catch (tickerError) {
        this.logger.error(`[Bot ${this.symbol}] Error getting ticker:`, tickerError);
        return; // Выходим из тика при ошибке
      }

      const currentPrice = parseFloat(ticker.data[0].last);
      if (isNaN(currentPrice) || currentPrice <= 0) {
        this.logger.error(`[Bot ${this.symbol}] Invalid current price: ${currentPrice}`);
        return; // Выходим, если цена некорректна
      }
      
      this.logger.log(`[Bot ${this.symbol}] Current price: ${currentPrice}`);

      // Периодическое обновление активной стратегии (раз в час)
      if (!this.stats.lastMarketAnalysis || !this.stats.lastMarketAnalysis.timestamp || 
          now - this.stats.lastMarketAnalysis.timestamp > 60 * 60 * 1000) {
        try {
          this.logger.log(`[Bot ${this.symbol}] Updating active strategy...`);
          await this.updateActiveStrategy();
          this.logger.log(`[Bot ${this.symbol}] Strategy updated to: ${this.currentStrategy.name}`);
        } catch (strategyError) {
          this.logger.error(`[Bot ${this.symbol}] Error updating strategy:`, strategyError);
          // Продолжаем работу с текущей стратегией
        }
      }
      
      // Получение исторических данных для анализа
      let recentCandles = [];
      try {
        const klines = await this.api.getKlines(this.symbol, '1h', 50);
        
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
        this.logger.error(`[Bot ${this.symbol}] Error getting historical data:`, dataError);
        // Продолжаем без исторических данных
      }
      
      // Подготовка данных для анализа сигналов
      const marketData = {
        recentCandles,
        position: this.openPosition
      };
      
      // Обработка открытых позиций
      if (this.openPosition) {
        this.logger.log(`[Bot ${this.symbol}] Managing open position:`, 
                        this.openPosition.direction, 
                        `Entry price: ${this.openPosition.entryPrice}`, 
                        `Current price: ${currentPrice}`);
        
        // Анализ сигналов на выход
        const exitSignal = await this.signalAnalyzer.analyzeSignals(currentPrice, marketData);
        
        if (exitSignal.shouldExit) {
          this.logger.log(`[Bot ${this.symbol}] Exit signal detected: ${exitSignal.exitReason}`);
          await this.closePosition(currentPrice, exitSignal.exitReason);
        } else {
          // Управление позицией по правилам текущей стратегии
          await this.manageOpenPosition(currentPrice);
        }
      } else {
        // Открытие новой позиции
        this.logger.log(`[Bot ${this.symbol}] Checking for new position opportunity...`);
        
        // Анализ сигналов на вход
        const entrySignal = await this.signalAnalyzer.analyzeSignals(currentPrice, marketData);
        
        if (entrySignal.shouldEnter) {
          this.logger.log(`[Bot ${this.symbol}] Entry signal detected: ${entrySignal.reason}, direction: ${entrySignal.direction}, confidence: ${entrySignal.confidence}`);
          
          // Используем данные из сигнала для открытия позиции
          await this.openNewPositionWithSignal(currentPrice, entrySignal);
        } else {
          this.logger.log(`[Bot ${this.symbol}] No entry signal`);
        }
      }
      
      // Обновление статистики
      await this.updateStats();
      
      // Запланировать следующий тик с небольшой случайной задержкой для предотвращения синхронизации
      const randomDelay = Math.floor(Math.random() * 10000); // 0-10 секунд
      if (this.interval) {
        clearTimeout(this.interval);
      }
      this.interval = setTimeout(() => this.tick(), 50000 + randomDelay);

    } catch (error) {
      this.logger.error(`[Bot ${this.symbol}] Error in bot tick:`, error);
      
      // Запланировать следующий тик даже в случае ошибки
      if (this.interval) {
        clearTimeout(this.interval);
      }
      this.interval = setTimeout(() => this.tick(), 60000);
    }
  }

  /**
   * Открытие новой позиции с использованием данных сигнала
   * @param {number} currentPrice - Текущая цена
   * @param {object} signal - Сигнал на вход
   * @returns {boolean} - Успешность открытия позиции
   */
  async openNewPositionWithSignal(currentPrice, signal) {
    try {
      if (!signal.shouldEnter || !signal.direction) {
        this.logger.log(`[Bot ${this.symbol}] No valid entry signal`);
        return false;
      }
      
      const direction = signal.direction;
      const strategy = this.currentStrategy.name;
      
      // Используем размер позиции из сигнала или рассчитываем на основе баланса
      const positionSize = signal.entrySize || (this.stats.currentBalance * 0.1);
      
      // Используем уровни TP/SL из сигнала
      const takeProfitPrice = signal.takeProfitPrice;
      const stopLossPrice = signal.stopLossPrice;
      
      this.logger.log(`[Bot ${this.symbol}] Opening ${direction} position at ${currentPrice}, size: ${positionSize}, strategy: ${strategy}`);
      
      try {
        // Размещение ордера
        const order = await this.api.placeOrder(
          this.symbol,
          direction === 'LONG' ? 'buy' : 'sell',
          'market',
          positionSize
        );
        
        this.logger.log(`[Bot ${this.symbol}] Order placed:`, order);
        
        // Создание записи о сделке
        const trade = {
          symbol: this.symbol,
          botId: this.botId,
          direction,
          entryPrice: currentPrice,
          quantity: positionSize,
          entryTime: new Date(),
          status: 'OPEN',
          dcaCount: 0,
          strategy,
          takeProfitPrice,
          stopLossPrice,
          signalConfidence: signal.confidence,
          signalReason: signal.reason
        };
        
        // Сохранение сделки в базу данных (если доступно)
        try {
          const tradeModel = new Trade(trade);
          await tradeModel.save();
          this.logger.log(`[Bot ${this.symbol}] Trade saved to database`);
        } catch (dbError) {
          this.logger.error(`[Bot ${this.symbol}] Error saving trade to database:`, dbError);
          // Продолжаем работу без сохранения в БД
        }
        
        // Обновление данных позиции
        this.openPosition = {
          trade,
          entryPrice: currentPrice,
          quantity: positionSize,
          direction,
          entryTime: new Date(),
          dcaCount: 0,
          highestPrice: direction === 'LONG' ? currentPrice : Infinity,
          lowestPrice: direction === 'SHORT' ? currentPrice : 0,
          trailingStopPrice: this.dcaStrategy.calculateTrailingStopPrice(currentPrice, direction),
          trailingStopActive: strategy === 'DCA', // Для DCA сразу активен, для скальпинга - после достижения порога
          strategy,
          takeProfitPrice,
          stopLossPrice,
          signalConfidence: signal.confidence
        };
        
        this.logger.log(`[Bot ${this.symbol}] Position opened: ${direction} at price ${currentPrice} using ${strategy} strategy`);
        return true;
      } catch (orderError) {
        this.logger.error(`[Bot ${this.symbol}] Error placing order:`, orderError);
        return false;
      }
    } catch (error) {
      this.logger.error(`[Bot ${this.symbol}] Error opening new position with signal:`, error);
      return false;
    }
  }

  /**
   * Открытие новой позиции (метод без использования анализатора сигналов)
   * @param {number} currentPrice - Текущая цена
   * @returns {boolean} - Успешность открытия позиции
   */
  async openNewPosition(currentPrice) {
    try {
      // Анализ рынка с помощью текущей стратегии
      const marketData = {};
      
      this.logger.log(`[Bot ${this.symbol}] Analyzing market for opening position, price: ${currentPrice}`);
      const analysis = await this.currentStrategy.analyze(currentPrice, marketData);
      
      // Проверка сигнала на вход
      if (!analysis.shouldEnter) {
        this.logger.log(`[Bot ${this.symbol}] No entry signal from strategy analysis`);
        return false;
      }

      const direction = analysis.direction;
      const strategy = this.currentStrategy.name;
      
      // Расчет размера позиции
      const positionSize = analysis.entrySize || (this.stats.currentBalance * 0.1);
      
      // Расчет уровней TP/SL для скальпинга
      let takeProfitPrice = null;
      let stopLossPrice = null;
      
      if (strategy === 'SCALPING') {
        takeProfitPrice = analysis.takeProfitPrice || 
                       (direction === 'LONG' ? 
                        currentPrice * (1 + this.config.scalping.profitTarget / 100) : 
                        currentPrice * (1 - this.config.scalping.profitTarget / 100));
                       
        stopLossPrice = analysis.stopLossPrice || 
                      (direction === 'LONG' ? 
                       currentPrice * (1 - this.config.scalping.stopLoss / 100) : 
                       currentPrice * (1 + this.config.scalping.stopLoss / 100));
      }
      
      this.logger.log(`[Bot ${this.symbol}] Opening ${direction} position at ${currentPrice}, size: ${positionSize}`);
      
      // Размещение ордера
      try {
        const order = await this.api.placeOrder(
          this.symbol,
          direction === 'LONG' ? 'buy' : 'sell',
          'market',
          positionSize
        );
        
        this.logger.log(`[Bot ${this.symbol}] Order placed:`, order);
        
        // Создание записи о сделке
        const trade = {
          symbol: this.symbol,
          botId: this.botId,
          direction,
          entryPrice: currentPrice,
          quantity: positionSize,
          entryTime: new Date(),
          status: 'OPEN',
          dcaCount: 0,
          strategy,
          takeProfitPrice,
          stopLossPrice
        };
        
        // Сохранение сделки в базу данных
        try {
          const tradeModel = new Trade(trade);
          await tradeModel.save();
        } catch (dbError) {
          this.logger.error(`[Bot ${this.symbol}] Error saving trade to database:`, dbError);
        }
        
        // Обновление данных позиции
        this.openPosition = {
          trade,
          entryPrice: currentPrice,
          quantity: positionSize,
          direction,
          entryTime: new Date(),
          dcaCount: 0,
          highestPrice: direction === 'LONG' ? currentPrice : Infinity,
          lowestPrice: direction === 'SHORT' ? currentPrice : 0,
          trailingStopPrice: this.dcaStrategy.calculateTrailingStopPrice(currentPrice, direction),
          trailingStopActive: strategy === 'DCA',
          strategy,
          takeProfitPrice,
          stopLossPrice
        };
        
        this.logger.log(`[Bot ${this.symbol}] Position opened: ${direction} at price ${currentPrice}`);
        return true;
      } catch (orderError) {
        this.logger.error(`[Bot ${this.symbol}] Error placing order:`, orderError);
        return false;
      }
    } catch (error) {
      this.logger.error(`[Bot ${this.symbol}] Error opening new position:`, error);
      return false;
    }
  }

  /**
   * Управление открытой позицией
   * @param {number} currentPrice - Текущая цена
   * @returns {boolean} - Успешность управления позицией
   */
  async manageOpenPosition(currentPrice) {
    try {
      if (!this.openPosition) {
        return false; // Нет открытой позиции
      }
      
      const position = this.openPosition;
      const direction = position.direction;
      const entryPrice = position.entryPrice;
      const entryTime = new Date(position.entryTime).getTime();
      const elapsedMinutes = Math.floor((Date.now() - entryTime) / 60000);
      
      // Обновляем максимальные/минимальные цены
      if (direction === 'LONG') {
        position.highestPrice = Math.max(position.highestPrice, currentPrice);
      } else { // SHORT
        position.lowestPrice = Math.min(position.lowestPrice, currentPrice);
      }
      
      // Проверка условий для закрытия позиции
      const shouldClose = await this.checkCloseConditions(currentPrice, elapsedMinutes);
      
      if (shouldClose) {
        this.logger.log(`[Bot ${this.symbol}] Close condition met: ${shouldClose}`);
        await this.closePosition(currentPrice, shouldClose);
        return true;
      }
      
      // Проверка необходимости DCA
      if (position.strategy === 'DCA' && position.dcaCount < this.config.dca.maxDCAOrders) {
        const shouldDCA = this.checkDCAConditions(currentPrice);
        
        if (shouldDCA) {
          this.logger.log(`[Bot ${this.symbol}] DCA condition met`);
          await this.doDCA(currentPrice);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      this.logger.error(`[Bot ${this.symbol}] Error managing open position:`, error);
      return false;
    }
  }

  /**
   * Проверка условий для закрытия позиции
   * @param {number} currentPrice - Текущая цена
   * @param {number} elapsedMinutes - Прошло минут с открытия позиции
   * @returns {string|boolean} - Причина закрытия или false
   */
  async checkCloseConditions(currentPrice, elapsedMinutes) {
    const position = this.openPosition;
    const direction = position.direction;
    const strategy = position.strategy;
    
    // 1. Проверка тейк-профита для Скальпинга
    if (strategy === 'SCALPING' && position.takeProfitPrice) {
      if ((direction === 'LONG' && currentPrice >= position.takeProfitPrice) ||
          (direction === 'SHORT' && currentPrice <= position.takeProfitPrice)) {
        return 'Take Profit';
      }
    }
    
    // 2. Проверка стоп-лосса для Скальпинга
    if (strategy === 'SCALPING' && position.stopLossPrice) {
      if ((direction === 'LONG' && currentPrice <= position.stopLossPrice) ||
          (direction === 'SHORT' && currentPrice >= position.stopLossPrice)) {
        return 'Stop Loss';
      }
    }
    
    // 3. Проверка трейлинг-стопа
    if (position.trailingStopActive && position.trailingStopPrice) {
      if ((direction === 'LONG' && currentPrice <= position.trailingStopPrice) ||
          (direction === 'SHORT' && currentPrice >= position.trailingStopPrice)) {
        return 'Trailing Stop';
      }
    }
    
    // 4. Проверка максимальной длительности сделки
    const maxDuration = strategy === 'SCALPING' ? 
                      this.config.scalping.maxTradeDuration : 
                      this.config.dca.maxTradeDuration;
                      
    if (elapsedMinutes > maxDuration) {
      return 'Max Duration Exceeded';
    }
    
    // 5. Проверка через активную стратегию
    const closeSignal = await this.currentStrategy.shouldClosePosition(currentPrice, position);
    if (closeSignal) {
      return closeSignal;
    }
    
    return false;
  }

  /**
   * Проверка условий для DCA
   * @param {number} currentPrice - Текущая цена
   * @returns {boolean} - Нужно ли DCA
   */
  checkDCAConditions(currentPrice) {
    const position = this.openPosition;
    const direction = position.direction;
    const entryPrice = position.entryPrice;
    const dcaCount = position.dcaCount;
    
    // Расчет шага цены
    const priceStep = this.config.dca.dcaPriceStep;
    
    // Для LONG позиций мы делаем DCA, когда цена падает
    if (direction === 'LONG') {
      const dcaLevel = entryPrice * (1 - priceStep * (dcaCount + 1) / 100);
      return currentPrice <= dcaLevel;
    } 
    // Для SHORT позиций мы делаем DCA, когда цена растет
    else {
      const dcaLevel = entryPrice * (1 + priceStep * (dcaCount + 1) / 100);
      return currentPrice >= dcaLevel;
    }
  }

  /**
   * Выполнение DCA
   * @param {number} currentPrice - Текущая цена
   * @returns {boolean} - Успешность DCA
   */
  async doDCA(currentPrice) {
    try {
      const position = this.openPosition;
      const direction = position.direction;
      const initialSize = position.quantity;
      
      // Рассчитываем множитель размера
      const sizeMultiplier = this.config.dca.dcaMultiplier;
      const dcaSize = initialSize * Math.pow(sizeMultiplier, position.dcaCount);
      
      this.logger.log(`[Bot ${this.symbol}] Executing DCA #${position.dcaCount + 1}, size: ${dcaSize}, price: ${currentPrice}`);
      
      // Размещаем ордер
      try {
        const order = await this.api.placeOrder(
          this.symbol,
          direction === 'LONG' ? 'buy' : 'sell',
          'market',
          dcaSize
        );
        
        this.logger.log(`[Bot ${this.symbol}] DCA order placed:`, order);
        
        // Обновляем позицию
        position.dcaCount++;
        
        // Рассчитываем новую среднюю цену входа
        const totalSize = initialSize * (1 - Math.pow(sizeMultiplier, position.dcaCount)) / (1 - sizeMultiplier);
        const newEntryPrice = ((position.entryPrice * position.quantity) + (currentPrice * dcaSize)) / (position.quantity + dcaSize);
        
        position.entryPrice = newEntryPrice;
        position.quantity += dcaSize;
        
        // Обновляем трейлинг-стоп
        position.trailingStopPrice = this.dcaStrategy.calculateTrailingStopPrice(currentPrice, direction);
        
        // Обновляем запись в базе данных
        try {
          const trade = await Trade.findById(position.trade._id);
          if (trade) {
            trade.entryPrice = newEntryPrice;
            trade.quantity = position.quantity;
            trade.dcaCount = position.dcaCount;
            trade.dcaHistory = trade.dcaHistory || [];
            
            trade.dcaHistory.push({
              price: currentPrice,
              quantity: dcaSize,
              timestamp: new Date()
            });
            
            await trade.save();
          }
        } catch (dbError) {
          this.logger.error(`[Bot ${this.symbol}] Error updating trade in database:`, dbError);
        }
        
        this.logger.log(`[Bot ${this.symbol}] DCA completed, new entry price: ${newEntryPrice}, total size: ${position.quantity}`);
        return true;
      } catch (orderError) {
        this.logger.error(`[Bot ${this.symbol}] Error placing DCA order:`, orderError);
        return false;
      }
    } catch (error) {
      this.logger.error(`[Bot ${this.symbol}] Error executing DCA:`, error);
      return false;
    }
  }

  /**
   * Закрытие позиции
   * @param {number} currentPrice - Текущая цена
   * @param {string} reason - Причина закрытия
   * @returns {boolean} - Успешность закрытия позиции
   */
  async closePosition(currentPrice, reason) {
    try {
      if (!this.openPosition) {
        return false; // Нет открытой позиции
      }
      
      const position = this.openPosition;
      const direction = position.direction;
      const size = position.quantity;
      
      this.logger.log(`[Bot ${this.symbol}] Closing ${direction} position at price ${currentPrice}, size: ${size}, reason: ${reason}`);
      
      // Размещаем ордер закрытия
      try {
        const order = await this.api.placeOrder(
          this.symbol,
          direction === 'LONG' ? 'sell' : 'buy',
          'market',
          size,
          null,
          true // reduceOnly = true
        );
        
        this.logger.log(`[Bot ${this.symbol}] Close order placed:`, order);
        
        // Расчет P&L
        let pnl = 0;
        if (direction === 'LONG') {
          pnl = (currentPrice - position.entryPrice) / position.entryPrice * size * 100;
        } else { // SHORT
          pnl = (position.entryPrice - currentPrice) / position.entryPrice * size * 100;
        }
        
        // Обновляем статистику
        this.updateStatsAfterTrade(pnl > 0, pnl, position.strategy);
        
        // Обновляем запись в базе данных
        try {
          const trade = await Trade.findById(position.trade._id);
          if (trade) {
            trade.exitPrice = currentPrice;
            trade.exitTime = new Date();
            trade.status = 'CLOSED';
            trade.pnl = pnl;
            trade.closeReason = reason;
            
            await trade.save();
          }
        } catch (dbError) {
          this.logger.error(`[Bot ${this.symbol}] Error updating trade in database:`, dbError);
        }
        
        this.logger.log(`[Bot ${this.symbol}] Position closed, P&L: ${pnl.toFixed(2)}%`);
        
        // Сбрасываем позицию
        this.openPosition = null;
        
        return true;
      } catch (orderError) {
        this.logger.error(`[Bot ${this.symbol}] Error placing close order:`, orderError);
        return false;
      }
    } catch (error) {
      this.logger.error(`[Bot ${this.symbol}] Error closing position:`, error);
      return false;
    }
  }

  /**
   * Обновление статистики после закрытия сделки
   * @param {boolean} isWin - Прибыльная ли сделка
   * @param {number} pnl - Profit & Loss в %
   * @param {string} strategy - Использованная стратегия
   */
  updateStatsAfterTrade(isWin, pnl, strategy) {
    // Увеличиваем счетчики сделок
    this.stats.totalTrades++;
    this.stats.tradesToday++;
    
    const hour = new Date().getHours();
    this.stats.hourlyTrades[hour]++;
    this.stats.hourlyPnl[hour] += pnl;
    
    // Обновляем статистику по прибыли/убыткам
    this.stats.totalPnl += pnl;
    
    if (isWin) {
      this.stats.winTrades++;
      
      // Обновляем статистику по стратегии
      if (strategy === 'SCALPING' || strategy === 'DCA') {
        this.stats.strategyPerformance[strategy].trades++;
        const winRate = this.stats.strategyPerformance[strategy].winRate;
        const trades = this.stats.strategyPerformance[strategy].trades;
        
        // Обновляем винрейт
        this.stats.strategyPerformance[strategy].winRate = 
          ((winRate * (trades - 1)) + 100) / trades;
        
        // Обновляем среднюю прибыль
        const avgProfit = this.stats.strategyPerformance[strategy].avgProfit;
        this.stats.strategyPerformance[strategy].avgProfit = 
          ((avgProfit * (this.stats.strategyPerformance[strategy].winRate / 100 * (trades - 1))) + pnl) / 
          (this.stats.strategyPerformance[strategy].winRate / 100 * trades);
      }
    } else {
      // Обновляем статистику по стратегии для убыточной сделки
      if (strategy === 'SCALPING' || strategy === 'DCA') {
        this.stats.strategyPerformance[strategy].trades++;
        const winRate = this.stats.strategyPerformance[strategy].winRate;
        const trades = this.stats.strategyPerformance[strategy].trades;
        
        // Обновляем винрейт
        this.stats.strategyPerformance[strategy].winRate = 
          (winRate * (trades - 1)) / trades;
        
        // Обновляем средний убыток
        const avgLoss = this.stats.strategyPerformance[strategy].avgLoss;
        this.stats.strategyPerformance[strategy].avgLoss = 
          ((avgLoss * ((100 - this.stats.strategyPerformance[strategy].winRate) / 100 * (trades - 1))) + Math.abs(pnl)) / 
          ((100 - this.stats.strategyPerformance[strategy].winRate) / 100 * trades);
      }
    }
    
    // Обновляем баланс
    const reinvestmentRate = this.config.common.reinvestment / 100;
    this.stats.currentBalance += (pnl / 100) * this.stats.currentBalance * reinvestmentRate;
    
    // Обновляем максимальную просадку
    const drawdown = (this.stats.initialBalance - this.stats.currentBalance) / this.stats.initialBalance * 100;
    if (drawdown > 0 && drawdown > this.stats.maxDrawdown) {
      this.stats.maxDrawdown = drawdown;
    }
  }

  /**
   * Обновление статистики
   */
  async updateStats() {
    try {
      // Обновляем hourlyTrades и hourlyPnl, если прошло более 24 часов
      const lastUpdate = this.stats.lastStatsUpdate || 0;
      const now = Date.now();
      
      if (now - lastUpdate > 24 * 60 * 60 * 1000) {
        // Прошло больше 24 часов, сбрасываем счетчик сделок за день
        this.stats.tradesToday = 0;
        this.stats.lastStatsUpdate = now;
      }
      
      this.logger.log(`[Bot ${this.symbol}] Statistics updated successfully`);
    } catch (error) {
      this.logger.error(`[Bot ${this.symbol}] Error updating statistics:`, error);
    }
  }

  /**
   * Установка стратегии
   * @param {string} strategyName - Название стратегии
   * @returns {string} - Текущая стратегия
   */
  setStrategy(strategyName) {
    const strategies = {
      'SCALPING': this.scalping,
      'DCA': this.dcaStrategy,
      'AUTO': this.autoSwitchingStrategy
    };
    
    if (strategies[strategyName]) {
      this.currentStrategy = strategies[strategyName];
      this.config.activeStrategy = strategyName;
      this.stats.activeStrategy = strategyName;
      
      this.logger.log(`Strategy set to ${strategyName} for ${this.symbol}`);
    } else {
      this.logger.error(`Invalid strategy: ${strategyName}`);
    }
    
    return this.stats.activeStrategy;
  }

  /**
   * Обновление активной стратегии с учетом анализа рынка
   * @returns {string} - Текущая стратегия
   */
  async updateActiveStrategy() {
    try {
      // Получаем анализ рынка и рекомендуемую стратегию
      const marketAnalysis = await this.currentStrategy.analyzeMarketConditions('1h');
      
      // Обновляем данные последнего анализа рынка
      this.stats.lastMarketAnalysis = {
        timestamp: Date.now(),
        recommendedStrategy: marketAnalysis.recommendedStrategy,
        marketType: marketAnalysis.marketType,
        volatility: marketAnalysis.volatility,
        volumeRatio: marketAnalysis.volumeRatio,
        trendStrength: marketAnalysis.trendStrength,
        confidence: marketAnalysis.confidence
      };
      
      // Если активен автоматический выбор стратегии, применяем рекомендуемую
      if (this.config.activeStrategy === 'AUTO') {
        const newStrategy = marketAnalysis.recommendedStrategy;
        
        if (newStrategy === 'SCALPING') {
          this.currentStrategy = this.scalping;
        } else {
          this.currentStrategy = this.dcaStrategy;
        }
        
        this.logger.log(`[Bot ${this.symbol}] Auto-switched strategy to ${newStrategy}`);
        this.stats.activeStrategy = newStrategy;
      }
      
      // Обновляем настройки анализатора сигналов в зависимости от рыночных условий
      this.updateSignalSettingsBasedOnMarket(marketAnalysis);
      
      return this.stats.activeStrategy;
    } catch (error) {
      this.logger.error(`[Bot ${this.symbol}] Error updating active strategy:`, error);
      return this.stats.activeStrategy;
    }
  }

  /**
   * Обновление настроек сигналов на основе рыночных условий
   * @param {object} marketAnalysis - Результаты анализа рынка
   * @returns {boolean} - Успешность обновления
   */
  async updateSignalSettingsBasedOnMarket(marketAnalysis) {
    try {
      // Получаем текущие настройки
      let settings = await SignalSettings.findOne({ symbol: this.symbol });
      
      if (!settings) {
        settings = new SignalSettings({ symbol: this.symbol });
      }
      
      // Клонируем настройки для модификации
      const updatedSettings = settings.toObject();
      
      // Настраиваем в зависимости от типа рынка
      switch (marketAnalysis.marketType) {
        case 'TRENDING':
          // Для трендового рынка улучшаем настройки
          updatedSettings.general.sensitivity = 60;
          updatedSettings.entryConditions.minTrendStrength = 0.4;
          updatedSettings.entryConditions.allowCounterTrend = false;
          
          if (marketAnalysis.trendStrength > 0.6) {
            // Сильный тренд - увеличиваем профит
            updatedSettings.strategySpecific.scalping.profitTarget = 0.8;
            updatedSettings.strategySpecific.dca.priceStep = 2.0;
          }
          break;
          
        case 'VOLATILE':
          // Для волатильного рынка
          updatedSettings.general.sensitivity = 40;
          updatedSettings.general.minVolatility = 0.5;
          updatedSettings.indicators.rsi.period = 10;
          
          // Увеличиваем профит-таргет и стоп-лосс
          updatedSettings.strategySpecific.scalping.profitTarget = 1.0;
          updatedSettings.strategySpecific.scalping.stopLoss = 0.7;
          break;
          
        case 'RANGING':
          // Для бокового рынка
          updatedSettings.general.sensitivity = 70;
          updatedSettings.indicators.rsi.overbought = 75;
          updatedSettings.indicators.rsi.oversold = 25;
          
          // Уменьшаем профит-таргет и стоп-лосс
          updatedSettings.strategySpecific.scalping.profitTarget = 0.4;
          updatedSettings.strategySpecific.scalping.stopLoss = 0.3;
          break;
      }
      
      // Настройка в зависимости от волатильности
      if (marketAnalysis.volatility > 3.0) {
        // Высокая волатильность
        updatedSettings.strategySpecific.scalping.profitTarget *= 1.5;
        updatedSettings.strategySpecific.scalping.stopLoss *= 1.5;
        updatedSettings.strategySpecific.dca.priceStep *= 1.3;
      } else if (marketAnalysis.volatility < 0.5) {
        // Низкая волатильность
        updatedSettings.strategySpecific.scalping.profitTarget *= 0.7;
        updatedSettings.strategySpecific.scalping.stopLoss *= 0.7;
        updatedSettings.strategySpecific.dca.priceStep *= 0.8;
      }
      
      // Сохраняем обновленные настройки
      if (settings.performance && settings.performance.enableAdaptiveSettings) {
        // Применяем только если включены адаптивные настройки
        Object.assign(settings, updatedSettings);
        await settings.save();
        
        // Обновляем анализатор сигналов
        this.signalAnalyzer.updateSettings(settings);
        
        this.logger.log(`[Bot ${this.symbol}] Signal settings adapted for ${marketAnalysis.marketType} market`);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`[Bot ${this.symbol}] Error updating signal settings based on market:`, error);
      return false;
    }
  }

  /**
   * Обновление конфигурации бота
   * @param {object} newConfig - Новая конфигурация
   * @returns {object} - Обновленная конфигурация
   */
  updateConfig(newConfig) {
    // Сохраняем текущую активную стратегию
    const currentStrategy = this.config.activeStrategy;
    
    // Объединяем с новой конфигурацией
    this.config = {
      ...this.config,
      ...newConfig,
      common: { ...this.config.common, ...(newConfig.common || {}) },
      dca: { ...this.config.dca, ...(newConfig.dca || {}) },
      scalping: { ...this.config.scalping, ...(newConfig.scalping || {}) },
      autoSwitching: { ...this.config.autoSwitching, ...(newConfig.autoSwitching || {}) }
    };
    
    // Обновляем стратегии
    this.scalping.updateConfig(this.config.scalping);
    this.dcaStrategy.updateConfig(this.config.dca);
    this.autoSwitchingStrategy.updateConfig(this.config.autoSwitching);
    
    // Если стратегия изменилась, обновляем активную стратегию
    if (newConfig.activeStrategy && newConfig.activeStrategy !== currentStrategy) {
      this.setStrategy(newConfig.activeStrategy);
    }
    
    this.logger.log(`[Bot ${this.symbol}] Configuration updated`);
    
    return this.config;
  }
}

module.exports = Bot;
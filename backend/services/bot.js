// backend/services/Bot.js
const BitgetAPI = require('./BitgetAPI');
const Trade = require('../api/models/Trade');
const DCAStrategy = require('./strategies/DCAStrategy');
const ScalpingStrategy = require('./strategies/ScalpingStrategy');
const MarketAnalyzer = require('./MarketAnalyzer');
const { v4: uuidv4 } = require('uuid');

class Bot {
  // Исправления для backend/services/Bot.js

// Конструктор класса Bot.js
constructor(symbol, config) {
  this.symbol = symbol;
  this.config = config || {
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
  this.api = new BitgetAPI();
  this.isActive = false;
  this.startTime = null;
  this.lastTick = null;
  this.interval = null;
  this.botId = uuidv4();
  this.openPosition = null;
  this.dcaOrders = [];
  
  // Инициализация стратегий
  try {
    this.dcaStrategy = new DCAStrategy(symbol, this.config, this.api);
    this.scalpingStrategy = new ScalpingStrategy(symbol, this.config, this.api);
    this.marketAnalyzer = new MarketAnalyzer(symbol, this.config, this.api);
  } catch (error) {
    console.error(`Error initializing strategies for ${symbol}:`, error);
    throw error;
  }
  
  // Текущая активная стратегия
  this.activeStrategy = this.config.activeStrategy || 'AUTO';
  this.currentStrategy = this.dcaStrategy; // По умолчанию DCA
  
  // Инициализируем статистику
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
      DCA: {
        trades: 0,
        winRate: 0,
        avgProfit: 0,
        avgLoss: 0
      },
      SCALPING: {
        trades: 0,
        winRate: 0,
        avgProfit: 0,
        avgLoss: 0
      }
    },
    lastMarketAnalysis: {
      timestamp: 0,
      recommendedStrategy: 'DCA',
      marketType: 'UNKNOWN',
      volatility: 0,
      volumeRatio: 0,
      trendStrength: 0,
      confidence: 0
    }
  };
}

// Инициализация бота с улучшенной обработкой ошибок
async initialize() {
  try {
    // Установка плеча (с обработкой возможных ошибок)
    try {
      await this.api.setLeverage(this.symbol, this.config.common.leverage);
      console.log(`Установлено плечо ${this.config.common.leverage}x для ${this.symbol}`);
    } catch (leverageError) {
      console.warn(`Не удалось установить плечо для ${this.symbol}: ${leverageError.message}. Продолжаем работу.`);
    }
    
    // Загрузка истории сделок из базы данных
    let trades = [];
    try {
      trades = await Trade.find({ botId: this.botId, symbol: this.symbol }).sort({ entryTime: -1 });
      console.log(`Loaded ${trades.length} trades from database for ${this.symbol}`);
    } catch (dbError) {
      console.warn(`Failed to load trades from database: ${dbError.message}`);
    }
    
    // Обновление статистики на основе истории
    this.updateStatsFromHistory(trades);
    
    // Первичный анализ рынка
    try {
      await this.updateActiveStrategy();
      console.log(`Strategy selected for ${this.symbol}: ${this.currentStrategy.name}`);
    } catch (strategyError) {
      console.warn(`Error selecting strategy: ${strategyError.message}. Using DCA as fallback.`);
      this.currentStrategy = this.dcaStrategy;
    }
    
    console.log(`Bot initialized for ${this.symbol} with leverage ${this.config.common.leverage}x, active strategy: ${this.currentStrategy.name}`);
  } catch (error) {
    console.error('Error initializing bot:', error);
    throw error;
  }
}
  

  // Обновление активной стратегии на основе рыночных условий
  async updateActiveStrategy() {
    try {
      // Если стратегия зафиксирована пользователем, просто применяем ее
      if (this.activeStrategy === 'DCA') {
        this.currentStrategy = this.dcaStrategy;
        return this.dcaStrategy.name;
      } else if (this.activeStrategy === 'SCALPING') {
        this.currentStrategy = this.scalpingStrategy;
        return this.scalpingStrategy.name;
      }
      
      // В режиме AUTO анализируем рынок и выбираем оптимальную стратегию
      const marketAnalysis = await this.marketAnalyzer.analyzeMarketConditions();
      
      // Сохраняем анализ рынка в статистике
      this.stats.lastMarketAnalysis = {
        timestamp: Date.now(),
        ...marketAnalysis
      };
      
      // Применяем рекомендуемую стратегию
      if (marketAnalysis.recommendedStrategy === 'SCALPING') {
        this.currentStrategy = this.scalpingStrategy;
      } else {
        this.currentStrategy = this.dcaStrategy;
      }
      
      console.log(`Updated active strategy for ${this.symbol} to ${this.currentStrategy.name} based on market conditions: ${marketAnalysis.marketType} (volatility: ${marketAnalysis.volatility.toFixed(2)}%, trend strength: ${marketAnalysis.trendStrength.toFixed(2)})`);
      
      return this.currentStrategy.name;
    } catch (error) {
      console.error(`Error updating active strategy for ${this.symbol}:`, error);
      // В случае ошибки используем DCA как более безопасную стратегию
      this.currentStrategy = this.dcaStrategy;
      return this.dcaStrategy.name;
    }
  }

  // Обновление статистики на основе истории сделок
  updateStatsFromHistory(trades) {
    this.stats.totalTrades = trades.length;
    this.stats.tradesToday = trades.filter(t => 
      new Date(t.entryTime) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;
    
    let wins = 0;
    let losses = 0;
    let totalPnl = 0;
    let balance = this.config.common.initialBalance;
    let maxBalance = balance;
    let maxDrawdown = 0;
    
    const dcaTrades = [];
    const scalpingTrades = [];
    
    // Обнуляем почасовую статистику
    this.stats.hourlyTrades = Array(24).fill(0);
    this.stats.hourlyPnl = Array(24).fill(0);
    
    // Анализируем закрытые сделки
    trades.filter(t => t.status === 'CLOSED').forEach(trade => {
      const pnl = trade.profitLoss || 0;
      totalPnl += pnl;
      
      if (pnl > 0) wins++;
      else if (pnl < 0) losses++;
      
      balance += pnl;
      
      if (balance > maxBalance) {
        maxBalance = balance;
      }
      
      const drawdown = (maxBalance - balance) / maxBalance * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
      
      // Обновляем почасовую статистику
      if (trade.exitTime) {
        const hour = new Date(trade.exitTime).getHours();
        this.stats.hourlyTrades[hour]++;
        this.stats.hourlyPnl[hour] += pnl;
      }
      
      // Разделяем сделки по типу стратегии
      if (trade.strategy === 'SCALPING') {
        scalpingTrades.push(trade);
      } else {
        dcaTrades.push(trade);
      }
    });
    
    this.stats.winTrades = wins;
    this.stats.lossTrades = losses;
    this.stats.totalPnl = totalPnl;
    this.stats.maxDrawdown = maxDrawdown;
    this.stats.currentBalance = balance;
    
    // Обновляем статистику по стратегиям
    this._updateStrategyStats('DCA', dcaTrades);
    this._updateStrategyStats('SCALPING', scalpingTrades);
    
    // Проверка текущих открытых позиций
    const openTrade = trades.find(t => t.status === 'OPEN');
    if (openTrade) {
      this.openPosition = {
        trade: openTrade,
        entryPrice: openTrade.entryPrice,
        quantity: openTrade.quantity,
        direction: openTrade.direction,
        entryTime: openTrade.entryTime,
        dcaCount: openTrade.dcaCount || 0,
        highestPrice: openTrade.direction === 'LONG' ? openTrade.entryPrice : Infinity,
        lowestPrice: openTrade.direction === 'SHORT' ? openTrade.entryPrice : 0,
        trailingStopPrice: this.dcaStrategy.calculateTrailingStopPrice(openTrade.entryPrice, openTrade.direction),
        trailingStopActive: openTrade.strategy === 'SCALPING' ? false : true, // Для скальпинга активируется только при достижении порога
        strategy: openTrade.strategy || 'DCA',
        stopLossPrice: openTrade.stopLossPrice,
        takeProfitPrice: openTrade.takeProfitPrice
      };
    }
  }

  // Обновление статистики по отдельной стратегии
  _updateStrategyStats(strategyName, trades) {
    if (trades.length === 0) {
      this.stats.strategyPerformance[strategyName] = {
        trades: 0,
        winRate: 0,
        avgProfit: 0,
        avgLoss: 0
      };
      return;
    }
    
    const wins = trades.filter(t => (t.profitLoss || 0) > 0);
    const losses = trades.filter(t => (t.profitLoss || 0) < 0);
    
    const avgProfit = wins.length > 0 
      ? wins.reduce((sum, t) => sum + (t.profitLoss || 0), 0) / wins.length 
      : 0;
    
    const avgLoss = losses.length > 0 
      ? losses.reduce((sum, t) => sum + (t.profitLoss || 0), 0) / losses.length 
      : 0;
    
    this.stats.strategyPerformance[strategyName] = {
      trades: trades.length,
      winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
      avgProfit,
      avgLoss: Math.abs(avgLoss) // Для удобства показываем как положительное число
    };
  }

  // Запуск бота
  start() {
    if (this.isActive) return;
    
    this.isActive = true;
    this.startTime = Date.now();
    
    // Запуск тиков бота (проверка каждую минуту)
    this.interval = setInterval(() => this.tick(), 60000);
    
    // Запускаем первый тик сразу
    this.tick();
    
    console.log(`Bot started for ${this.symbol} with strategy ${this.currentStrategy.name}`);
  }

  // Остановка бота
  async stop() {
    if (!this.isActive) return;
    
    this.isActive = false;
    clearInterval(this.interval);
    
    // Закрываем открытые позиции, если есть
    if (this.openPosition) {
      await this.closePosition('MANUAL');
    }
    
    console.log(`Bot stopped for ${this.symbol}`);
  }

  // Тик бота (выполняется каждую минуту)
  async tick() {
    try {
      if (!this.isActive) return;
      
      const now = Date.now();
      this.lastTick = now;
      
      // Получение текущей цены
      const ticker = await this.api.getTicker(this.symbol);
      const currentPrice = parseFloat(ticker.data[0].last);
      
      // Периодическое обновление активной стратегии (раз в час)
      if (now - this.stats.lastMarketAnalysis.timestamp > 60 * 60 * 1000) {
        await this.updateActiveStrategy();
      }
      
      // Обработка открытых позиций
      if (this.openPosition) {
        await this.manageOpenPosition(currentPrice);
      } else {
        // Открытие новой позиции, если нет открытых
        await this.openNewPosition(currentPrice);
      }
    } catch (error) {
      console.error(`Error in bot tick for ${this.symbol}:`, error);
    }
  }

  // Управление открытой позицией
  async manageOpenPosition(currentPrice) {
    const position = this.openPosition;
    const elapsedMinutes = Math.floor((Date.now() - new Date(position.entryTime).getTime()) / 60000);
    
    // Подготовка данных для анализа
    const marketData = {
      position,
      elapsedMinutes
    };
    
    // Обновление максимальной/минимальной цены
    if (position.direction === 'LONG') {
      if (currentPrice > position.highestPrice) {
        position.highestPrice = currentPrice;
        
        // Обновление трейлинг-стопа в зависимости от стратегии
        if (position.strategy === 'DCA' || 
           (position.strategy === 'SCALPING' && 
            position.trailingStopActive)) {
          position.trailingStopPrice = this.dcaStrategy.calculateTrailingStopPrice(currentPrice, 'LONG');
        }
        
        // Активация трейлинг-стопа для скальпинга при достижении порога активации
        if (position.strategy === 'SCALPING' && !position.trailingStopActive) {
          const activationThreshold = position.entryPrice * (1 + this.config.scalping.trailingStopActivation / 100);
          if (currentPrice >= activationThreshold) {
            position.trailingStopActive = true;
            position.trailingStopPrice = currentPrice * (1 - this.config.scalping.trailingStopDistance / 100);
            console.log(`Activated trailing stop for ${this.symbol} at ${position.trailingStopPrice}`);
          }
        }
      }
    } else { // SHORT
      if (currentPrice < position.lowestPrice) {
        position.lowestPrice = currentPrice;
        
        // Обновление трейлинг-стопа в зависимости от стратегии
        if (position.strategy === 'DCA' || 
           (position.strategy === 'SCALPING' && 
            position.trailingStopActive)) {
          position.trailingStopPrice = this.dcaStrategy.calculateTrailingStopPrice(currentPrice, 'SHORT');
        }
        
        // Активация трейлинг-стопа для скальпинга при достижении порога активации
        if (position.strategy === 'SCALPING' && !position.trailingStopActive) {
          const activationThreshold = position.entryPrice * (1 - this.config.scalping.trailingStopActivation / 100);
          if (currentPrice <= activationThreshold) {
            position.trailingStopActive = true;
            position.trailingStopPrice = currentPrice * (1 + this.config.scalping.trailingStopDistance / 100);
            console.log(`Activated trailing stop for ${this.symbol} at ${position.trailingStopPrice}`);
          }
        }
      }
    }
    
    // Расчет PnL
    let pnl = 0;
    if (position.direction === 'LONG') {
      pnl = position.quantity * (currentPrice - position.entryPrice);
    } else { // SHORT
      pnl = position.quantity * (position.entryPrice - currentPrice);
    }
    
    // Анализ позиции с помощью текущей стратегии
    let strategyToUse;
    if (position.strategy === 'DCA') {
      strategyToUse = this.dcaStrategy;
    } else if (position.strategy === 'SCALPING') {
      strategyToUse = this.scalpingStrategy;
    } else {
      strategyToUse = this.currentStrategy;
    }
    
    const analysis = await strategyToUse.analyze(currentPrice, marketData);
    
    // Проверка условий для закрытия позиции
    if (analysis.shouldExit) {
      let reason;
      
      if (position.strategy === 'SCALPING') {
        const isTP = position.direction === 'LONG' 
          ? currentPrice >= position.takeProfitPrice 
          : currentPrice <= position.takeProfitPrice;
        
        const isSL = position.direction === 'LONG' 
          ? currentPrice <= position.stopLossPrice 
          : currentPrice >= position.stopLossPrice;
        
        if (isTP) reason = 'TAKE_PROFIT';
        else if (isSL) reason = 'STOP_LOSS';
        else if (position.trailingStopActive) reason = 'TRAILING_STOP';
        else reason = 'MAX_DURATION';
      } else {
        reason = 'TRAILING_STOP'; // Для DCA стратегии в основном используется trailing stop
      }
      
      await this.closePosition(reason, currentPrice, pnl);
    } else if (position.strategy === 'DCA' && analysis.shouldDCA) {
      // Для DCA стратегии проверяем необходимость DCA ордеров
      await this.placeDCAOrder(currentPrice);
    }
  }

  // Размещение DCA ордера
  async placeDCAOrder(currentPrice) {
    try {
      const position = this.openPosition;
      const dcaSize = position.trade.quantity * Math.pow(this.config.dca.dcaMultiplier, position.dcaCount);
      
      // Размещение ордера
      const order = await this.api.placeOrder(
        this.symbol,
        position.direction === 'LONG' ? 'buy' : 'sell',
        'market',
        dcaSize
      );
      
      // Обновление позиции
      position.dcaCount++;
      
      // Расчет новой средней цены входа
      const totalValue = position.entryPrice * position.quantity;
      const newValue = currentPrice * dcaSize;
      const newQuantity = position.quantity + dcaSize;
      position.entryPrice = (totalValue + newValue) / newQuantity;
      position.quantity = newQuantity;
      
      // Обновление трейлинг-стопа
      position.trailingStopPrice = this.dcaStrategy.calculateTrailingStopPrice(position.entryPrice, position.direction);
      
      // Обновление записи в базе данных
      await Trade.updateOne(
        { _id: position.trade._id },
        { 
          entryPrice: position.entryPrice,
          quantity: position.quantity,
          dcaCount: position.dcaCount
        }
      );
      
      console.log(`DCA order placed for ${this.symbol} at price ${currentPrice}, new entry price: ${position.entryPrice}`);
    } catch (error) {
      console.error(`Error placing DCA order for ${this.symbol}:`, error);
    }
  }

  // Открытие новой позиции
  async openNewPosition(currentPrice) {
    try {
      // Анализ рынка с помощью текущей стратегии
      const marketData = {};
      const analysis = await this.currentStrategy.analyze(currentPrice, marketData);
      
      // Проверка сигнала на вход
      if (!analysis.shouldEnter) {
        return; // Нет сигнала для входа
      }
      
      const direction = analysis.direction;
      const strategy = this.currentStrategy.name;
      
      // Расчет размера позиции
      const positionSize = analysis.entrySize;
      
      // Расчет уровней TP/SL для скальпинга
      let takeProfitPrice = null;
      let stopLossPrice = null;
      
      if (strategy === 'SCALPING') {
        takeProfitPrice = analysis.takeProfitPrice;
        stopLossPrice = analysis.stopLossPrice;
      }
      
      // Размещение ордера
      const order = await this.api.placeOrder(
        this.symbol,
        direction === 'LONG' ? 'buy' : 'sell',
        'market',
        positionSize
      );
      
      // Создание записи о сделке
      const trade = new Trade({
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
      });
      
      await trade.save();
      
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
        stopLossPrice
      };
      
      console.log(`New position opened for ${this.symbol}: ${direction} at price ${currentPrice} using ${strategy} strategy`);
    } catch (error) {
      console.error(`Error opening new position for ${this.symbol}:`, error);
    }
  }

  // Закрытие позиции
  async closePosition(reason, exitPrice = null, pnl = null) {
    try {
      if (!this.openPosition) return;
      
      const position = this.openPosition;
      
      // Если цена закрытия не предоставлена, получаем текущую
      if (!exitPrice) {
        const ticker = await this.api.getTicker(this.symbol);
        exitPrice = parseFloat(ticker.data[0].last);
      }
      
      // Если PnL не предоставлен, рассчитываем
      if (pnl === null) {
        if (position.direction === 'LONG') {
          pnl = position.quantity * (exitPrice - position.entryPrice);
        } else { // SHORT
          pnl = position.quantity * (position.entryPrice - exitPrice);
        }
      }
      
      // Размещение ордера на закрытие позиции
      const order = await this.api.placeOrder(
        this.symbol,
        position.direction === 'LONG' ? 'sell' : 'buy',
        'market',
        position.quantity,
        null,
        true // reduceOnly
      );
      
      // Обновление записи в базе данных
      await Trade.updateOne(
        { _id: position.trade._id },
        { 
          status: 'CLOSED',
          exitPrice,
          exitTime: new Date(),
          profitLoss: pnl,
          closeReason: reason
        }
      );
      
      // Обновление статистики
      this.stats.totalTrades++;
      this.stats.tradesToday++;
      
      if (pnl > 0) {
        this.stats.winTrades++;
      } else {
        this.stats.lossTrades++;
      }
      
      this.stats.totalPnl += pnl;
      this.stats.currentBalance += pnl;
      
      // Реинвестирование прибыли
      if (pnl > 0 && this.config.common.reinvestment > 0) {
        const reinvestAmount = pnl * (this.config.common.reinvestment / 100);
        this.stats.currentBalance += reinvestAmount;
      }
      
      // Обновление почасовой статистики
      const hour = new Date().getHours();
      this.stats.hourlyTrades[hour]++;
      this.stats.hourlyPnl[hour] += pnl;
      
      // Обновление статистики стратегии
      const strategyName = position.strategy;
      const strategyStats = this.stats.strategyPerformance[strategyName] || { trades: 0, winRate: 0, avgProfit: 0, avgLoss: 0 };
      
      strategyStats.trades++;
      
      // Обновляем средние значения
      if (pnl > 0) {
        const winCount = strategyStats.trades * (strategyStats.winRate / 100);
        const newWinCount = winCount + 1;
        strategyStats.winRate = (newWinCount / strategyStats.trades) * 100;
        
        // Обновляем среднюю прибыль
        strategyStats.avgProfit = ((strategyStats.avgProfit * winCount) + pnl) / newWinCount;
      } else if (pnl < 0) {
        const lossCount = strategyStats.trades * (1 - strategyStats.winRate / 100);
        const newLossCount = lossCount + 1;
        strategyStats.winRate = ((strategyStats.trades - newLossCount) / strategyStats.trades) * 100;
        
        // Обновляем средний убыток (храним как положительное число)
        strategyStats.avgLoss = ((strategyStats.avgLoss * lossCount) + Math.abs(pnl)) / newLossCount;
      }
      
      this.stats.strategyPerformance[strategyName] = strategyStats;
      
      // Сброс открытой позиции
      this.openPosition = null;
      
      console.log(`Position closed for ${this.symbol} at price ${exitPrice}, PnL: ${pnl}, reason: ${reason}, strategy: ${position.strategy}`);
    } catch (error) {
      console.error(`Error closing position for ${this.symbol}:`, error);
    }
  }

  // Обновление конфигурации
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Обновляем конфигурацию в стратегиях
    this.dcaStrategy = new DCAStrategy(this.symbol, this.config, this.api);
    this.scalpingStrategy = new ScalpingStrategy(this.symbol, this.config, this.api);
    this.marketAnalyzer = new MarketAnalyzer(this.symbol, this.config, this.api);
    
    // Обновляем активную стратегию
    this.activeStrategy = this.config.activeStrategy || 'AUTO';
    
    // Сразу обновляем используемую стратегию, если она фиксирована
    if (this.activeStrategy === 'DCA') {
      this.currentStrategy = this.dcaStrategy;
    } else if (this.activeStrategy === 'SCALPING') {
      this.currentStrategy = this.scalpingStrategy;
    }
  }

  // Принудительная смена стратегии
  setStrategy(strategy) {
    if (strategy === 'DCA') {
      this.activeStrategy = 'DCA';
      this.currentStrategy = this.dcaStrategy;
    } else if (strategy === 'SCALPING') {
      this.activeStrategy = 'SCALPING';
      this.currentStrategy = this.scalpingStrategy;
    } else if (strategy === 'AUTO') {
      this.activeStrategy = 'AUTO';
      // Реальную стратегию обновим при следующем анализе рынка
    }
    
    return this.currentStrategy.name;
  }

  // Проверка статуса бота
  isRunning() {
    return this.isActive;
  }

  // Получение времени работы бота
  getUptime() {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }

  // Получение статистики
  getStats() {
    return {
      ...this.stats,
      winRate: this.stats.totalTrades > 0 
        ? (this.stats.winTrades / this.stats.totalTrades) * 100 
        : 0,
      returnPercentage: ((this.stats.currentBalance - this.stats.initialBalance) / this.stats.initialBalance) * 100,
      openPosition: this.openPosition ? {
        direction: this.openPosition.direction,
        entryPrice: this.openPosition.entryPrice,
        currentPrice: null, // Заполняется при вызове
        pnl: null, // Заполняется при вызове
        duration: Math.floor((Date.now() - new Date(this.openPosition.entryTime).getTime()) / 60000),
        strategy: this.openPosition.strategy
      } : null,
      activeStrategy: this.currentStrategy.name,
      lastMarketAnalysis: this.stats.lastMarketAnalysis
    };
  }
}

module.exports = Bot;
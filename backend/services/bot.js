// backend/services/Bot.js
const BitgetAPI = require('./BitgetAPI');
const Trade = require('../api/models/Trade');
const { v4: uuidv4 } = require('uuid');

class Bot {
  constructor(symbol, config) {
    this.symbol = symbol;
    this.config = config;
    this.api = new BitgetAPI();
    this.isActive = false;
    this.startTime = null;
    this.lastTick = null;
    this.interval = null;
    this.botId = uuidv4();
    this.openPosition = null;
    this.dcaOrders = [];
    this.stats = {
      totalTrades: 0,
      winTrades: 0,
      lossTrades: 0,
      totalPnl: 0,
      maxDrawdown: 0,
      currentBalance: config.initialBalance || 100,
      initialBalance: config.initialBalance || 100,
      tradesToday: 0,
      hourlyTrades: Array(24).fill(0),
      hourlyPnl: Array(24).fill(0)
    };
  }

  // Инициализация бота
  async initialize() {
    try {
      // Установка плеча
      await this.api.setLeverage(this.symbol, this.config.leverage);
      
      // Загрузка истории сделок из базы данных
      const trades = await Trade.find({ botId: this.botId, symbol: this.symbol }).sort({ entryTime: -1 });
      
      // Обновление статистики на основе истории
      this.updateStatsFromHistory(trades);
      
      console.log(`Bot initialized for ${this.symbol} with leverage ${this.config.leverage}x`);
    } catch (error) {
      console.error('Error initializing bot:', error);
      throw error;
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
    let balance = this.config.initialBalance;
    let maxBalance = balance;
    let maxDrawdown = 0;
    
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
    });
    
    this.stats.winTrades = wins;
    this.stats.lossTrades = losses;
    this.stats.totalPnl = totalPnl;
    this.stats.maxDrawdown = maxDrawdown;
    this.stats.currentBalance = balance;
    
    // Проверка текущих открытых позиций
    const openTrade = trades.find(t => t.status === 'OPEN');
    if (openTrade) {
      this.openPosition = {
        trade: openTrade,
        entryPrice: openTrade.entryPrice,
        quantity: openTrade.quantity,
        direction: openTrade.direction,
        entryTime: openTrade.entryTime,
        dcaCount: openTrade.dcaCount,
        highestPrice: openTrade.direction === 'LONG' ? openTrade.entryPrice : Infinity,
        lowestPrice: openTrade.direction === 'SHORT' ? openTrade.entryPrice : 0,
        trailingStopPrice: this.calculateTrailingStopPrice(openTrade.entryPrice, openTrade.direction)
      };
    }
  }

  // Расчет цены трейлинг-стопа
  calculateTrailingStopPrice(price, direction) {
    return direction === 'LONG' 
      ? price * (1 - this.config.trailingStop / 100) 
      : price * (1 + this.config.trailingStop / 100);
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
    
    console.log(`Bot started for ${this.symbol}`);
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
      const currentPrice = parseFloat(ticker.data.last);
      
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
    
    // Обновление максимальной/минимальной цены и трейлинг-стопа
    if (position.direction === 'LONG') {
      if (currentPrice > position.highestPrice) {
        position.highestPrice = currentPrice;
        position.trailingStopPrice = this.calculateTrailingStopPrice(currentPrice, 'LONG');
      }
    } else { // SHORT
      if (currentPrice < position.lowestPrice) {
        position.lowestPrice = currentPrice;
        position.trailingStopPrice = this.calculateTrailingStopPrice(currentPrice, 'SHORT');
      }
    }
    
    // Расчет PnL
    let pnl = 0;
    if (position.direction === 'LONG') {
      pnl = position.quantity * (currentPrice - position.entryPrice);
    } else { // SHORT
      pnl = position.quantity * (position.entryPrice - currentPrice);
    }
    
    // Проверка условий для закрытия позиции
    const isTrailingStopTriggered = position.direction === 'LONG' 
      ? currentPrice < position.trailingStopPrice 
      : currentPrice > position.trailingStopPrice;
    
    const isMaxDurationReached = elapsedMinutes >= this.config.maxTradeDuration;
    
    // PnL не растет в течение некоторого времени
    let isPnlStagnant = false;
    // Здесь можно реализовать логику определения стагнации PnL
    
    if (isTrailingStopTriggered) {
      await this.closePosition('TRAILING_STOP', currentPrice, pnl);
    } else if (isMaxDurationReached) {
      await this.closePosition('MAX_DURATION', currentPrice, pnl);
    } else if (isPnlStagnant) {
      await this.closePosition('PNL_STAGNANT', currentPrice, pnl);
    } else {
      // Проверка необходимости DCA
      await this.checkAndPlaceDCAOrders(currentPrice);
    }
  }

  // Проверка и размещение DCA ордеров
  async checkAndPlaceDCAOrders(currentPrice) {
    if (!this.openPosition || this.openPosition.dcaCount >= this.config.maxDCAOrders) {
      return;
    }
    
    const position = this.openPosition;
    
    // Проверка условий для DCA
    if (position.direction === 'LONG' && currentPrice < position.entryPrice * (1 - this.config.dcaPriceStep / 100)) {
      await this.placeDCAOrder(currentPrice);
    } else if (position.direction === 'SHORT' && currentPrice > position.entryPrice * (1 + this.config.dcaPriceStep / 100)) {
      await this.placeDCAOrder(currentPrice);
    }
  }

  // Размещение DCA ордера
  async placeDCAOrder(currentPrice) {
    try {
      const position = this.openPosition;
      const dcaSize = position.trade.quantity * Math.pow(this.config.dcaMultiplier, position.dcaCount);
      
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
      position.trailingStopPrice = this.calculateTrailingStopPrice(position.entryPrice, position.direction);
      
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
      // Случайный выбор направления (в реальной стратегии здесь будет анализ рынка)
      const direction = Math.random() > 0.5 ? 'LONG' : 'SHORT';
      
      // Размер позиции с учетом плеча
      const positionSize = this.stats.currentBalance * this.config.leverage / currentPrice;
      
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
        dcaCount: 0
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
        trailingStopPrice: this.calculateTrailingStopPrice(currentPrice, direction)
      };
      
      console.log(`New position opened for ${this.symbol}: ${direction} at price ${currentPrice}`);
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
        exitPrice = parseFloat(ticker.data.last);
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
      if (pnl > 0 && this.config.reinvestment > 0) {
        const reinvestAmount = pnl * (this.config.reinvestment / 100);
        this.stats.currentBalance += reinvestAmount;
      }
      
      // Обновление почасовой статистики
      const hour = new Date().getHours();
      this.stats.hourlyTrades[hour]++;
      this.stats.hourlyPnl[hour] += pnl;
      
      // Сброс открытой позиции
      this.openPosition = null;
      
      console.log(`Position closed for ${this.symbol} at price ${exitPrice}, PnL: ${pnl}, reason: ${reason}`);
    } catch (error) {
      console.error(`Error closing position for ${this.symbol}:`, error);
    }
  }

  // Обновление конфигурации
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
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
        duration: Math.floor((Date.now() - new Date(this.openPosition.entryTime).getTime()) / 60000)
      } : null
    };
  }
}

module.exports = Bot;
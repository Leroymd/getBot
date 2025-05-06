// backend/services/strategies/ScalpingStrategy.js
class ScalpingStrategy {
  constructor(symbol, config, api) {
    this.symbol = symbol;
    this.config = config;
    this.api = api;
    this.name = 'SCALPING';
  }

  // Анализ текущего состояния рынка для принятия решений
  async analyze(currentPrice, marketData) {
    // Получаем исторические данные для анализа
    const klines = await this._getHistoricalData();
    
    // Метрики и сигналы
    return {
      shouldEnter: this._shouldEnterPosition(currentPrice, klines, marketData),
      shouldExit: this._shouldExitPosition(currentPrice, marketData),
      entrySize: this._calculateEntrySize(currentPrice, marketData),
      direction: this._determineDirection(currentPrice, klines, marketData),
      takeProfitPrice: this._calculateTakeProfitPrice(currentPrice, marketData),
      stopLossPrice: this._calculateStopLossPrice(currentPrice, marketData)
    };
  }

  // Получение исторических данных
  async _getHistoricalData() {
    try {
      const klines = await this.api.getKlines(
        this.symbol, 
        this.config.scalping.timeframe, 
        100 // Получаем 100 последних свечей
      );
      return klines.data || [];
    } catch (error) {
      console.error(`Error getting historical data for ${this.symbol}:`, error);
      return [];
    }
  }

  // Проверка условий для входа в позицию
  _shouldEnterPosition(currentPrice, klines, marketData) {
    if (klines.length < 20) return false; // Недостаточно данных
    
    // Проверяем спред
    const spread = this._calculateSpread(currentPrice, klines);
    if (spread > this.config.scalping.maxSpread) return false;
    
    // Проверяем волатильность
    const volatility = this._calculateVolatility(klines);
    if (volatility < this.config.scalping.minVolatility) return false;
    
    // Проверка импульса и других условий входа
    // В реальной стратегии здесь будет анализ технических индикаторов
    
    return Math.random() > 0.7; // Пример: 30% вероятность входа при соблюдении условий
  }

  // Проверка условий для выхода из позиции
  _shouldExitPosition(currentPrice, marketData) {
    if (!marketData.position) return false;
    
    const position = marketData.position;
    
    // Проверка достижения профита
    if (this._isTakeProfitReached(currentPrice, position)) return true;
    
    // Проверка стоп-лосса
    if (this._isStopLossReached(currentPrice, position)) return true;
    
    // Проверка трейлинг-стопа (если включен)
    if (this.config.scalping.useTrailingStop && this._isTrailingStopTriggered(currentPrice, position)) return true;
    
    // Проверка максимальной длительности сделки
    const elapsedMinutes = Math.floor((Date.now() - new Date(position.entryTime).getTime()) / 60000);
    if (elapsedMinutes >= this.config.scalping.maxTradeDuration) return true;
    
    return false;
  }

  // Расчет размера позиции
  _calculateEntrySize(currentPrice, marketData) {
    // Для скальпинга часто используются меньшие размеры позиций, чем для DCA
    const baseSize = this.config.common.initialBalance / currentPrice;
    return baseSize * 0.7; // Используем 70% от обычного размера
  }

  // Определение направления входа (LONG/SHORT)
  _determineDirection(currentPrice, klines, marketData) {
    // Анализ тренда на основе индикаторов
    const trend = this._analyzeTrend(klines);
    return trend > 0 ? 'LONG' : 'SHORT';
  }

  // Расчет цены take profit
  _calculateTakeProfitPrice(currentPrice, marketData) {
    let direction = marketData.position ? marketData.position.direction : this._determineDirection(currentPrice, [], marketData);
    
    return direction === 'LONG' 
      ? currentPrice * (1 + this.config.scalping.profitTarget / 100) 
      : currentPrice * (1 - this.config.scalping.profitTarget / 100);
  }

  // Расчет цены stop loss
  _calculateStopLossPrice(currentPrice, marketData) {
    let direction = marketData.position ? marketData.position.direction : this._determineDirection(currentPrice, [], marketData);
    
    return direction === 'LONG' 
      ? currentPrice * (1 - this.config.scalping.stopLoss / 100) 
      : currentPrice * (1 + this.config.scalping.stopLoss / 100);
  }

  // Проверка достижения take profit
  _isTakeProfitReached(currentPrice, position) {
    const takeProfitPrice = position.direction === 'LONG' 
      ? position.entryPrice * (1 + this.config.scalping.profitTarget / 100) 
      : position.entryPrice * (1 - this.config.scalping.profitTarget / 100);
    
    return position.direction === 'LONG' 
      ? currentPrice >= takeProfitPrice 
      : currentPrice <= takeProfitPrice;
  }

  // Проверка достижения stop loss
  _isStopLossReached(currentPrice, position) {
    const stopLossPrice = position.direction === 'LONG' 
      ? position.entryPrice * (1 - this.config.scalping.stopLoss / 100) 
      : position.entryPrice * (1 + this.config.scalping.stopLoss / 100);
    
    return position.direction === 'LONG' 
      ? currentPrice <= stopLossPrice 
      : currentPrice >= stopLossPrice;
  }

  // Проверка срабатывания трейлинг-стопа
  _isTrailingStopTriggered(currentPrice, position) {
    if (!position.trailingStopActive) return false;
    
    return position.direction === 'LONG' 
      ? currentPrice < position.trailingStopPrice 
      : currentPrice > position.trailingStopPrice;
  }

  // Расчет волатильности
  _calculateVolatility(klines) {
    if (klines.length < 2) return 0;
    
    // Расчет среднего истинного диапазона (ATR)
    let trueRanges = [];
    for (let i = 1; i < klines.length; i++) {
      const high = parseFloat(klines[i][2]);
      const low = parseFloat(klines[i][3]);
      const prevClose = parseFloat(klines[i-1][4]);
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    // Среднее значение
    const atr = trueRanges.reduce((sum, val) => sum + val, 0) / trueRanges.length;
    return atr;
  }

  // Расчет спреда
  _calculateSpread(currentPrice, klines) {
    // В реальности здесь должно быть получение данных о текущем спреде
    // В упрощенном варианте используем разницу между максимумом и минимумом последней свечи
    if (klines.length === 0) return 0;
    
    const lastCandle = klines[klines.length - 1];
    const high = parseFloat(lastCandle[2]);
    const low = parseFloat(lastCandle[3]);
    
    return (high - low) / low * 100; // в процентах
  }

  // Анализ тренда
  _analyzeTrend(klines) {
    if (klines.length < 20) return 0;
    
    // Простой пример: сравниваем текущую цену с ценой 20 свечей назад
    const currentClose = parseFloat(klines[klines.length - 1][4]);
    const oldClose = parseFloat(klines[klines.length - 20][4]);
    
    return currentClose > oldClose ? 1 : -1;
  }
}

module.exports = ScalpingStrategy;
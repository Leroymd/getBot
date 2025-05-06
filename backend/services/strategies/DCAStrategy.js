// backend/services/strategies/DCAStrategy.js
class DCAStrategy {
  constructor(symbol, config, api) {
    this.symbol = symbol;
    this.config = config;
    this.api = api;
    this.name = 'DCA';
  }

  // Анализ текущего состояния рынка для принятия решений
  async analyze(currentPrice, marketData) {
    // Метрики для DCA стратегии
    return {
      shouldEnter: this._shouldEnterPosition(currentPrice, marketData),
      shouldExit: this._shouldExitPosition(currentPrice, marketData),
      shouldDCA: this._shouldPlaceDCAOrder(currentPrice, marketData),
      entrySize: this._calculateEntrySize(currentPrice, marketData),
      direction: this._determineDirection(currentPrice, marketData)
    };
  }

  // Проверка условий для входа в позицию
  _shouldEnterPosition(currentPrice, marketData) {
    // В простейшем случае - статистический алгоритм или вероятностная модель
    // В продвинутом случае здесь могут быть индикаторы, паттерны и т.д.
    return Math.random() > 0.5; // Пример: 50% вероятность входа
  }

  // Проверка условий для выхода из позиции
  _shouldExitPosition(currentPrice, marketData) {
    if (!marketData.position) return false;
    
    // Проверка трейлинг-стопа
    const position = marketData.position;
    return this._isTrailingStopTriggered(currentPrice, position);
  }

  // Проверка условий для размещения DCA-ордера
  _shouldPlaceDCAOrder(currentPrice, marketData) {
    if (!marketData.position) return false;
    
    const position = marketData.position;
    if (position.dcaCount >= this.config.dca.maxDCAOrders) return false;
    
    // Проверка условий для DCA
    if (position.direction === 'LONG' && 
        currentPrice < position.entryPrice * (1 - this.config.dca.dcaPriceStep / 100)) {
      return true;
    } else if (position.direction === 'SHORT' && 
               currentPrice > position.entryPrice * (1 + this.config.dca.dcaPriceStep / 100)) {
      return true;
    }
    
    return false;
  }

  // Расчет размера позиции
  _calculateEntrySize(currentPrice, marketData) {
    const baseSize = this.config.common.initialBalance / currentPrice;
    return baseSize;
  }

  // Определение направления входа (LONG/SHORT)
  _determineDirection(currentPrice, marketData) {
    // Например, на основе индикаторов тренда
    return Math.random() > 0.5 ? 'LONG' : 'SHORT';
  }

  // Проверка срабатывания трейлинг-стопа
  _isTrailingStopTriggered(currentPrice, position) {
    if (position.direction === 'LONG') {
      return currentPrice < position.trailingStopPrice;
    } else { // SHORT
      return currentPrice > position.trailingStopPrice;
    }
  }

  // Расчет цены трейлинг-стопа
  calculateTrailingStopPrice(price, direction) {
    return direction === 'LONG' 
      ? price * (1 - this.config.dca.trailingStop / 100) 
      : price * (1 + this.config.dca.trailingStop / 100);
  }
}

module.exports = DCAStrategy;
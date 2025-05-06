// backend/api/controllers/marketController.js
const BitgetAPI = require('../../services/BitgetAPI');

exports.getSymbols = async (req, res) => {
  try {
    const api = new BitgetAPI();
    console.log('Запрос списка символов через BitgetAPI...');
    const symbols = await api.getSymbols();
    console.log(`Получены символы: ${symbols && symbols.data ? symbols.data.length : 0} шт.`);
    res.json(symbols);
  } catch (error) {
    console.error('Ошибка получения символов:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'ERROR_GET_SYMBOLS',
      // Возвращаем фиктивные данные для работы фронтенда при ошибке
      data: [
        { symbol: 'BTCUSDT', baseCoin: 'BTC', quoteCoin: 'USDT' },
        { symbol: 'ETHUSDT', baseCoin: 'ETH', quoteCoin: 'USDT' },
        { symbol: 'SOLUSDT', baseCoin: 'SOL', quoteCoin: 'USDT' }
      ]
    });
  }
};

exports.getKlines = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval, limit } = req.query;
    
    const api = new BitgetAPI();
    console.log(`Запрос свечей для ${symbol} через BitgetAPI...`);
    const klines = await api.getKlines(symbol, interval, limit);
    console.log(`Получены свечи для ${symbol}: ${klines && klines.data ? klines.data.length : 0} шт.`);
    res.json(klines);
  } catch (error) {
    console.error('Ошибка получения свечей:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'ERROR_GET_KLINES',
      data: [] 
    });
  }
};

exports.getTicker = async (req, res) => {
  try {
    const { symbol } = req.params;
    
    const api = new BitgetAPI();
    console.log(`Запрос тикера для ${symbol} через BitgetAPI...`);
    const ticker = await api.getTicker(symbol);
    console.log(`Получен тикер для ${symbol}:`, ticker && ticker.data ? ticker.data : null);
    res.json(ticker);
  } catch (error) {
    console.error('Ошибка получения тикера:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'ERROR_GET_TICKER',
      // Возвращаем фиктивные данные для работы фронтенда при ошибке
      data: [{
        symbol: symbol,
        lastPr: '50000.00',
        open24h: '49000.00',
        high24h: '51000.00',
        low24h: '48500.00',
        baseVolume: '1000.00',
        change24h: '0.02'
      }]
    });
  }
};
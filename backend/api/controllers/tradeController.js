// backend/api/controllers/tradeController.js
const BitgetAPI = require('../../services/BitgetAPI');
const Trade = require('../models/Trade');

exports.getTradeHistory = async (req, res) => {
  try {
    const { symbol, limit = 100 } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    // Получаем сделки из базы данных
    const localTrades = await Trade.find({ symbol, status: 'CLOSED' })
      .sort({ exitTime: -1 })
      .limit(parseInt(limit));
    
    // Если нет сделок в базе данных, обращаемся к API биржи
    if (localTrades.length === 0) {
      const api = new BitgetAPI();
      const exchangeTrades = await api.getTradeHistory(symbol, limit);
      
      res.json({
        trades: exchangeTrades.data || [],
        source: 'exchange'
      });
    } else {
      res.json({
        trades: localTrades,
        source: 'local'
      });
    }
  } catch (error) {
    console.error('Error getting trade history:', error);
    res.status(500).json({ error: error.message });
  }
};
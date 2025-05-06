// backend/api/controllers/accountController.js
const BitgetAPI = require('../../services/BitgetAPI');

exports.getBalance = async (req, res) => {
  try {
    const api = new BitgetAPI();
    console.log('Запрос баланса аккаунта через BitgetAPI...');
    const balance = await api.getAccountBalance();
    console.log('Получен баланс:', balance);
    res.json(balance);
  } catch (error) {
    console.error('Ошибка получения баланса:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'ERROR_GET_BALANCE'
    });
  }
};

exports.getPositions = async (req, res) => {
  try {
    const { symbol } = req.query;
    const api = new BitgetAPI();
    console.log('Запрос позиций через BitgetAPI...');
    const positions = await api.getPositions(symbol);
    console.log('Получены позиции:', positions);
    res.json(positions);
  } catch (error) {
    console.error('Ошибка получения позиций:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'ERROR_GET_POSITIONS'
    });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const { symbol, status, limit } = req.query;
    const api = new BitgetAPI();
    console.log('Запрос ордеров через BitgetAPI...');
    const orders = await api.getOrders(symbol, status, limit);
    console.log('Получены ордера:', orders);
    res.json(orders);
  } catch (error) {
    console.error('Ошибка получения ордеров:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'ERROR_GET_ORDERS'
    });
  }
};
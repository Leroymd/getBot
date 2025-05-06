// backend/api/routes.js
const express = require('express');
const router = express.Router();
const botController = require('./controllers/botController');
const accountController = require('./controllers/accountController');
const marketController = require('./controllers/marketController');

// Маршруты для бота
router.post('/bot/start', botController.startBot);
router.post('/bot/stop', botController.stopBot);
router.get('/bot/status', botController.getBotStatus);
router.post('/bot/config', botController.updateConfig);
router.get('/bot/config', botController.getConfig);
router.get('/bot/stats', botController.getStats);

// Маршруты для аккаунта
router.get('/account/balance', accountController.getBalance);
router.get('/account/positions', accountController.getPositions);
router.get('/account/orders', accountController.getOrders);

// Маршруты для рыночных данных
router.get('/market/symbols', marketController.getSymbols);
router.get('/market/klines/:symbol', marketController.getKlines);
router.get('/market/ticker/:symbol', marketController.getTicker);

module.exports = router;

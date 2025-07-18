// backend/api/routes.js - добавление маршрутов для анализа сигналов

const express = require('express');
const router = express.Router();
const botController = require('./controllers/botController');
const accountController = require('./controllers/accountController');
const marketController = require('./controllers/marketController');
const tradeController = require('./controllers/tradeController');
const signalController = require('./controllers/signalController');

// Маршруты для бота
router.post('/bot/start', botController.startBot);
router.post('/bot/stop', botController.stopBot);
router.get('/bot/status', botController.getBotStatus);
router.post('/bot/config', botController.updateConfig);
router.get('/bot/config', botController.getConfig);
router.get('/bot/stats', botController.getStats);
router.post('/bot/strategy', botController.setStrategy);
router.get('/bot/market-analysis', botController.analyzeMarket);

// Новый маршрут для сканирования пар, соответствующий вызову из фронтенда
router.get('/bot/scan-pairs', botController.scanPairs);

// Оставляем старый маршрут для обратной совместимости
router.get('/market/scan-pairs', botController.scanPairs);
router.get('/market/filter-pairs', botController.filterPairs);

// Маршруты для анализа корреляций
router.get('/market/correlations', botController.analyzeCorrelations);
router.get('/market/correlation-matrix', botController.getCorrelationMatrix);
router.get('/market/diversification-pairs', botController.findDiversificationPairs);

// Маршруты для анализа ликвидаций
router.get('/market/liquidations', botController.getLiquidations);
router.get('/market/liquidation-analysis', botController.analyzeLiquidations);
router.get('/market/reversal-points', botController.predictReversalPoints);

// Маршруты для аккаунта
router.get('/account/balance', accountController.getBalance);
router.get('/account/positions', accountController.getPositions);
router.get('/account/orders', accountController.getOrders);

// Маршруты для рыночных данных
router.get('/market/symbols', marketController.getSymbols);
router.get('/market/klines/:symbol', marketController.getKlines);
router.get('/market/ticker/:symbol', marketController.getTicker);

// Маршруты для истории сделок
router.get('/trades/history', tradeController.getTradeHistory);

// НОВЫЕ МАРШРУТЫ ДЛЯ УПРАВЛЕНИЯ СИГНАЛАМИ
// Получение настроек сигналов для указанного символа
router.get('/signals/settings', signalController.getSignalSettings);

// Обновление настроек сигналов для указанного символа
router.post('/signals/settings', signalController.updateSignalSettings);

// Тестирование настроек сигналов на исторических данных
router.post('/signals/backtest', signalController.backtestSignals);

// Получение текущих сигналов для символа с заданными настройками
router.get('/signals/current', signalController.getCurrentSignals);

// Получение рекомендуемых настроек на основе анализа рынка
router.get('/signals/recommended-settings', signalController.getRecommendedSettings);

module.exports = router;
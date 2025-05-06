// 7. Обновление botService для исправления запуска бота
// frontend/src/services/botService.js

import api from './api';

export const getBotStatus = async (symbol) => {
  try {
    return await api.get(`/bot/status?symbol=${symbol}`);
  } catch (error) {
    console.error('Error fetching bot status:', error);
    throw error;
  }
};

export const startBot = async (symbol, config) => {
  try {
    // Удостоверимся, что мы передаем все необходимые параметры
    const payload = { 
      symbol, 
      config: config || {
        timeframe: '1m',
        leverage: 10,
        initialBalance: 100,
        trailingStop: 0.5,
        maxDCAOrders: 5,
        dcaPriceStep: 1.5,
        dcaMultiplier: 1.5,
        maxTradeDuration: 5,
        reinvestment: 100,
        enabled: true
      }
    };
    console.log('Starting bot with payload:', payload);
    return await api.post('/bot/start', payload);
  } catch (error) {
    console.error('Error starting bot:', error);
    throw error;
  }
};

export const stopBot = async (symbol) => {
  try {
    return await api.post('/bot/stop', { symbol });
  } catch (error) {
    console.error('Error stopping bot:', error);
    throw error;
  }
};

export const getBotConfig = async (symbol) => {
  try {
    return await api.get(`/bot/config?symbol=${symbol}`);
  } catch (error) {
    console.error('Error getting bot config:', error);
    throw error;
  }
};

export const updateBotConfig = async (symbol, config) => {
  try {
    return await api.post('/bot/config', { symbol, config });
  } catch (error) {
    console.error('Error updating bot config:', error);
    throw error;
  }
};

export const getBotStats = async (symbol) => {
  try {
    return await api.get(`/bot/stats?symbol=${symbol}`);
  } catch (error) {
    console.error('Error getting bot stats:', error);
    throw error;
  }
};

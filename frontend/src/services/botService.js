// frontend/src/services/botService.js
import api from './api';

// Вспомогательная функция для обработки ошибок API
const handleApiError = (error, defaultMessage) => {
  console.error(defaultMessage, error);
  throw error.response?.data?.error || error.message || defaultMessage;
};

export const getBotStatus = async (symbol) => {
  try {
    const response = await api.get(`/bot/status?symbol=${symbol}`);
    return response;
  } catch (error) {
    return handleApiError(error, 'Error fetching bot status');
  }
};

export const startBot = async (symbol, config) => {
  try {
    const payload = { symbol, config };
    console.log('Starting bot with payload:', payload);
    const response = await api.post('/bot/start', payload);
    return response;
  } catch (error) {
    return handleApiError(error, 'Error starting bot');
  }
};

export const stopBot = async (symbol) => {
  try {
    const response = await api.post('/bot/stop', { symbol });
    return response;
  } catch (error) {
    return handleApiError(error, 'Error stopping bot');
  }
};

export const getBotConfig = async (symbol) => {
  try {
    const response = await api.get(`/bot/config?symbol=${symbol}`);
    return response;
  } catch (error) {
    return handleApiError(error, 'Error getting bot config');
  }
};

export const updateBotConfig = async (symbol, config) => {
  try {
    const response = await api.post('/bot/config', { symbol, config });
    return response;
  } catch (error) {
    return handleApiError(error, 'Error updating bot config');
  }
};

export const getBotStats = async (symbol) => {
  try {
    const response = await api.get(`/bot/stats?symbol=${symbol}`);
    return response;
  } catch (error) {
    return handleApiError(error, 'Error getting bot stats');
  }
};

export const setStrategy = async (symbol, strategy) => {
  try {
    const response = await api.post('/bot/strategy', { symbol, strategy });
    return response;
  } catch (error) {
    return handleApiError(error, 'Error setting strategy');
  }
};

export const analyzeMarket = async (symbol) => {
  try {
    const response = await api.get(`/bot/market-analysis?symbol=${symbol}`);
    return response;
  } catch (error) {
    return handleApiError(error, 'Error analyzing market');
  }
};
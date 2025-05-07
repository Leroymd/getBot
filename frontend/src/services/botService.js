// frontend/src/services/botService.js
import api from './api';

// Вспомогательная функция для обработки ошибок API
const handleApiError = (error, defaultMessage) => {
  console.error(defaultMessage, error);
  throw error.response?.data?.error || error.message || defaultMessage;
};

/**
 * Получить статус бота для указанного символа или всех ботов, если символ не указан
 * @param {string} symbol - Опциональный параметр символа
 * @returns {Promise<Object>} - Статус бота или объект со статусами всех ботов
 */
export const getBotStatus = async (symbol) => {
  try {
    const url = symbol ? `/bot/status?symbol=${symbol}` : '/bot/status';
    const response = await api.get(url);
    return response;
  } catch (error) {
    return handleApiError(error, 'Ошибка получения статуса бота');
  }
};

/// frontend/src/services/botService.js - исправленный метод startBot

/**
 * Запустить бота для указанного символа с опциональной конфигурацией
 * @param {string} symbol - Символ торговой пары
 * @param {Object} config - Опциональная конфигурация бота
 * @param {boolean} forceRestart - Принудительный перезапуск, если бот уже запущен
 * @returns {Promise<Object>} - Результат операции
 */
export const startBot = async (symbol, config, forceRestart = false) => {
  try {
    const payload = { symbol, config, forceRestart };
    console.log('Starting bot with settings:', payload);
    const response = await api.post('/bot/start', payload);
    return response;
  } catch (error) {
    // Проверяем, содержит ли ответ информацию о уже запущенном боте
    if (error.response?.status === 400 && 
        error.response?.data?.error === 'Bot already running for this symbol' && 
        error.response?.data?.botStatus) {
      
      // Если бот уже запущен, возвращаем его статус
      console.warn(`Bot for ${symbol} is already running. Use forceRestart=true to restart it.`);
      return error.response.data.botStatus;
    }
    
    return handleApiError(error, 'Error starting bot');
  }
};

/**
 * Остановить бота для указанного символа
 * @param {string} symbol - Символ торговой пары
 * @returns {Promise<Object>} - Результат операции
 */
export const stopBot = async (symbol) => {
  try {
    const response = await api.post('/bot/stop', { symbol });
    return response;
  } catch (error) {
    return handleApiError(error, 'Ошибка остановки бота');
  }
};

/**
 * Получить конфигурацию бота для указанного символа
 * @param {string} symbol - Символ торговой пары
 * @returns {Promise<Object>} - Конфигурация бота
 */
export const getBotConfig = async (symbol) => {
  try {
    const response = await api.get(`/bot/config?symbol=${symbol}`);
    return response;
  } catch (error) {
    return handleApiError(error, 'Ошибка получения конфигурации бота');
  }
};

/**
 * Обновить конфигурацию бота
 * @param {string} symbol - Символ торговой пары
 * @param {Object} config - Новая конфигурация
 * @returns {Promise<Object>} - Результат операции
 */
export const updateBotConfig = async (symbol, config) => {
  try {
    const response = await api.post('/bot/config', { symbol, config });
    return response;
  } catch (error) {
    return handleApiError(error, 'Ошибка обновления конфигурации бота');
  }
};

/**
 * Получить статистику бота
 * @param {string} symbol - Символ торговой пары
 * @returns {Promise<Object>} - Статистика бота
 */
export const getBotStats = async (symbol) => {
  try {
    const response = await api.get(`/bot/stats?symbol=${symbol}`);
    return response;
  } catch (error) {
    return handleApiError(error, 'Ошибка получения статистики бота');
  }
};

/**
 * Установить стратегию для бота
 * @param {string} symbol - Символ торговой пары
 * @param {string} strategy - Название стратегии (DCA, SCALPING, AUTO)
 * @returns {Promise<Object>} - Результат операции
 */
export const setStrategy = async (symbol, strategy) => {
  try {
    const response = await api.post('/bot/strategy', { symbol, strategy });
    return response;
  } catch (error) {
    return handleApiError(error, 'Ошибка установки стратегии');
  }
};

/**
 * Получить анализ рынка для указанного символа
 * @param {string} symbol - Символ торговой пары
 * @returns {Promise<Object>} - Результаты анализа рынка
 */
export const analyzeMarket = async (symbol) => {
  try {
    const response = await api.get(`/bot/market-analysis?symbol=${symbol}`);
    return response;
  } catch (error) {
    return handleApiError(error, 'Ошибка анализа рынка');
  }
};

/**
 * Сканировать все доступные торговые пары для поиска торговых возможностей
 * @returns {Promise<Array>} - Массив сигналов для торговых пар
 */
export const scanPairs = async () => {
  try {
    const response = await api.get('/bot/scan-pairs');
    return response;
  } catch (error) {
    return handleApiError(error, 'Ошибка сканирования торговых пар');
  }
};
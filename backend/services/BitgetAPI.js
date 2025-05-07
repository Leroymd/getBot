// backend/services/BitgetAPI.js
const crypto = require('crypto');
const axios = require('axios');
const config = require('../config');
const querystring = require('querystring');

/**
 * Класс для работы с API BitGet с поддержкой Promise и callback-функций
 */
class BitgetAPI {
  /**
   * Конструктор класса
   * @param {Object} options - Опции для API
   */
  constructor(options = {}) {
    // Загружаем настройки из конфига или переданных опций
    this.baseUrl = options.baseUrl || config.bitget.apiUrl;
    this.apiKey = options.apiKey || config.bitget.apiKey;
    this.secretKey = options.secretKey || config.bitget.secretKey;
    this.passphrase = options.passphrase || config.bitget.passphrase;
    this.demo = options.demo !== undefined ? options.demo : config.bitget.demo;
    
    // Настройки для повторных попыток и таймаутов
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.timeout = options.timeout || 30000;
    
    // Настройки для логирования
    this.debug = options.debug !== undefined ? options.debug : true;
    
    this.log('BitGet API initialized with:');
    this.log('- API Key:', this.apiKey ? `${this.apiKey.substring(0, 4)}...` : 'Not set');
    this.log('- Secret Key:', this.secretKey ? 'Set (hidden)' : 'Not set');
    this.log('- Passphrase:', this.passphrase ? 'Set (hidden)' : 'Not set');
    this.log('- Demo mode:', this.demo ? 'Enabled' : 'Disabled');
    this.log('- Max retries:', this.maxRetries);
    this.log('- Retry delay:', this.retryDelay);
    this.log('- Request timeout:', this.timeout);
  }

  /**
   * Логирование с разными уровнями
   * @param  {...any} args - Аргументы для логирования
   */
  log(...args) {
    if (this.debug) {
      console.log('[BitgetAPI]', ...args);
    }
  }

  /**
   * Логирование ошибок
   * @param  {...any} args - Аргументы для логирования
   */
  logError(...args) {
    console.error('[BitgetAPI ERROR]', ...args);
  }

  /**
   * Генерация подписи для API запросов
   * @param {string} timestamp - Временная метка
   * @param {string} method - HTTP метод
   * @param {string} requestPath - Путь запроса
   * @param {string} body - Тело запроса
   * @returns {string} - Сгенерированная подпись
   */
  generateSignature(timestamp, method, requestPath, body = '') {
    try {
      // Формируем сообщение для подписи
      const message = timestamp + method.toUpperCase() + requestPath + (body || '');
      
      if (this.debug) {
        this.log('Signature message:', message);
      }
      
      // Создаем HMAC SHA256 подпись с secretKey и кодируем в Base64
      const signature = crypto
        .createHmac('sha256', this.secretKey)
        .update(message)
        .digest('base64');
      
      if (this.debug) {
        this.log('Generated signature:', signature);
      }
      
      return signature;
    } catch (error) {
      this.logError('Error generating signature:', error);
      throw error;
    }
  }

  /**
   * Заголовки для API запросов
   * @param {string} timestamp - Временная метка
   * @param {string} method - HTTP метод
   * @param {string} requestPath - Путь запроса
   * @param {string} body - Тело запроса
   * @returns {Object} - Заголовки запроса
   */
  getHeaders(timestamp, method, requestPath, body = '') {
    try {
      const signature = this.generateSignature(timestamp, method, requestPath, body);
      
      return {
        'ACCESS-KEY': this.apiKey,
        'ACCESS-SIGN': signature,
        'ACCESS-TIMESTAMP': timestamp,
        'ACCESS-PASSPHRASE': this.passphrase,
        'Content-Type': 'application/json',
        'X-SIMULATED-TRADING': this.demo ? '1' : '0'
      };
    } catch (error) {
      this.logError('Error getting headers:', error);
      throw error;
    }
  }

  /**
   * Выполнение API запроса с поддержкой Promise и callback
   * @param {string} method - HTTP метод
   * @param {string} endpoint - Конечная точка API
   * @param {Object} params - Параметры запроса
   * @param {Object} data - Данные для тела запроса
   * @param {Function} callback - Callback-функция (опционально)
   * @returns {Promise|void} - Promise с результатом или void при использовании callback
   */
  request(method, endpoint, params = {}, data = null, callback, retryCount = 0) {
    // Создаем Promise для поддержки обоих стилей вызова
    const promise = new Promise(async (resolve, reject) => {
      try {
        const timestamp = Date.now().toString();
        let requestPath = endpoint;
        let url = `${this.baseUrl}${endpoint}`;
        let queryString = '';
        
        // Обрабатываем GET параметры
        if (params && Object.keys(params).length > 0 && method.toUpperCase() === 'GET') {
          queryString = '?' + querystring.stringify(params);
          requestPath += queryString;
          url += queryString;
        }
        
        // Преобразуем данные в JSON для POST запросов
        const jsonData = data ? JSON.stringify(data) : '';
        
        // Получаем заголовки для запроса
        const headers = this.getHeaders(timestamp, method, requestPath, jsonData);
        
        this.log(`API Request: ${method.toUpperCase()} ${url}`);
        this.log('Request params:', params);
        
        if (jsonData) {
          this.log('Request body:', jsonData);
        }
        
        // Выполняем запрос
        const response = await axios({
          method: method.toUpperCase(),
          url,
          headers,
          data: jsonData || undefined,
          timeout: this.timeout
        });
        
        this.log(`API Response (${method.toUpperCase()} ${endpoint}):`, 
                  response.status, response.statusText);
        
        resolve(response.data);
      } catch (error) {
        this.logError(`API Error (${method.toUpperCase()} ${endpoint}):`, error.message);
        
        if (error.response) {
          this.logError('Response status:', error.response.status);
          this.logError('Response data:', error.response.data);
        }
        
        // Проверяем, нужно ли повторить запрос
        if (retryCount < this.maxRetries && 
            (error.code === 'ECONNABORTED' || // Таймаут
             error.code === 'ETIMEDOUT' || // Таймаут
             error.response && error.response.status >= 500)) { // Ошибка сервера
          
          this.log(`Retrying request (${retryCount + 1}/${this.maxRetries}) after ${this.retryDelay}ms...`);
          
          // Ждем перед повторной попыткой
          await new Promise(r => setTimeout(r, this.retryDelay));
          
          try {
            // Рекурсивно вызываем request с увеличенным счетчиком повторов
            const result = await this.request(method, endpoint, params, data, null, retryCount + 1);
            resolve(result);
          } catch (retryError) {
            reject(retryError);
          }
        } else {
          reject(error);
        }
      }
    });
    
    // Обрабатываем в зависимости от стиля вызова (Promise или callback)
    if (typeof callback === 'function') {
      promise
        .then(result => callback(null, result))
        .catch(error => callback(error));
    } else {
      return promise;
    }
  }

  /**
   * Попытка выполнить запрос с альтернативным эндпоинтом при ошибке
   * @param {string} method - HTTP метод
   * @param {string} primaryEndpoint - Основной эндпоинт
   * @param {string} alternativeEndpoint - Альтернативный эндпоинт
   * @param {Object} params - Параметры запроса
   * @param {Object} data - Данные для тела запроса
   * @param {Object} alternativeData - Альтернативные данные для тела запроса
   * @param {Function} callback - Callback-функция (опционально)
   * @returns {Promise|void} - Promise с результатом или void при использовании callback
   */
  requestWithFallback(method, primaryEndpoint, alternativeEndpoint, params = {}, data = null, alternativeData = null, callback) {
    const promise = new Promise(async (resolve, reject) => {
      try {
        // Пробуем основной эндпоинт
        const result = await this.request(method, primaryEndpoint, params, data);
        resolve(result);
      } catch (error) {
        this.logError(`Error with primary endpoint ${primaryEndpoint}:`, error.message);
        this.log(`Trying alternative endpoint ${alternativeEndpoint}...`);
        
        try {
          // Пробуем альтернативный эндпоинт
          const alternativeResult = await this.request(
            method, 
            alternativeEndpoint, 
            params, 
            alternativeData || data
          );
          resolve(alternativeResult);
        } catch (alternativeError) {
          this.logError(`Alternative endpoint ${alternativeEndpoint} also failed:`, alternativeError.message);
          reject(error); // Выбрасываем исходную ошибку
        }
      }
    });
    
    // Обрабатываем в зависимости от стиля вызова (Promise или callback)
    if (typeof callback === 'function') {
      promise
        .then(result => callback(null, result))
        .catch(error => callback(error));
    } else {
      return promise;
    }
  }

  // API методы с поддержкой Promise и callback
  
  /**
   * Получение баланса аккаунта
   * @param {Function} callback - Callback-функция (опционально)
   * @returns {Promise|void} - Promise с результатом или void при использовании callback
   */
  getAccountBalance(callback) {
    return this.request('GET', '/api/v2/mix/account/accounts', { productType: "USDT-FUTURES" }, null, callback);
  }

  /**
   * Получение открытых позиций
   * @param {string} symbol - Символ (опционально)
   * @param {Function} callback - Callback-функция (опционально)
   * @returns {Promise|void} - Promise с результатом или void при использовании callback
   */
  getPositions(symbol = '', callback) {
    const params = { productType: "USDT-FUTURES" };
    if (symbol) params.symbol = symbol;
    return this.request('GET', '/api/v2/mix/position/all-position', params, null, callback);
  }

  /**
   * Получение ордеров
   * @param {string} symbol - Символ
   * @param {string} status - Статус ордеров
   * @param {number} limit - Ограничение количества результатов
   * @param {Function} callback - Callback-функция (опционально)
   * @returns {Promise|void} - Promise с результатом или void при использовании callback
   */
  getOrders(symbol, status = 'HISTORY', limit = 100, callback) {
    return this.request('GET', '/api/v2/mix/order/history', {
      symbol,
      productType: "USDT-FUTURES",
      startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 дней назад
      endTime: Date.now(),
      pageSize: limit
    }, null, callback);
  }

  /**
   * Получение списка символов
   * @param {Function} callback - Callback-функция (опционально)
   * @returns {Promise|void} - Promise с результатом или void при использовании callback
   */
  getSymbols(callback) {
    return this.request('GET', '/api/v2/mix/market/contracts', { productType: "USDT-FUTURES" }, null, callback);
  }

  /**
   * Получение свечей (klines)
   * @param {string} symbol - Символ
   * @param {string} interval - Интервал времени
   * @param {number} limit - Ограничение количества результатов
   * @param {Function} callback - Callback-функция (опционально)
   * @returns {Promise|void} - Promise с результатом или void при использовании callback
   */
  getKlines(symbol, interval = '1m', limit = 100, callback) {
    // Преобразуем временной интервал в правильный формат для API Bitget
    // Bitget API v2 использует форматы: 1m, 3m, 5m, 15m, 30m, 1H, 4H, 6H, 12H, 1D, 1W, 1M
    const intervalMap = {
      '1h': '1H',
      '2h': '2H',
      '4h': '4H', 
      '6h': '6H',
      '12h': '12H',
      '1d': '1D',
      '1w': '1W',
      '1M': '1M'
    };
    
    // Преобразуем интервал, если есть в карте преобразований
    const formattedInterval = intervalMap[interval.toLowerCase()] || interval;
    
    this.log(`Fetching klines for ${symbol} with timeframe ${formattedInterval}`);
    
    const promise = new Promise(async (resolve, reject) => {
      try {
        const response = await this.request('GET', '/api/v2/mix/market/candles', {
          symbol,
          productType: "USDT-FUTURES",
          granularity: formattedInterval,
          limit
        });
        
        if (response && response.data && Array.isArray(response.data)) {
          this.log(`Получены свечи для ${symbol}: ${response.data.length} шт.`);
        } else {
          this.log(`Некорректный формат ответа API для свечей ${symbol}`);
        }
        
        resolve(response);
      } catch (error) {
        this.logError(`Error fetching klines for ${symbol} with interval ${formattedInterval}:`, error);
        
        // Если не удалось получить данные с текущим интервалом, пробуем другой
        if (interval !== '15m') {
          this.log(`Retrying with 15m timeframe for ${symbol}`);
          try {
            const fallbackResponse = await this.getKlines(symbol, '15m', limit);
            resolve(fallbackResponse);
          } catch (fallbackError) {
            reject(fallbackError);
          }
        } else {
          reject(error);
        }
      }
    });
    
    // Обрабатываем в зависимости от стиля вызова (Promise или callback)
    if (typeof callback === 'function') {
      promise
        .then(result => callback(null, result))
        .catch(error => callback(error));
    } else {
      return promise;
    }
  }

  /**
   * Получение текущей цены (тикер)
   * @param {string} symbol - Символ
   * @param {Function} callback - Callback-функция (опционально)
   * @returns {Promise|void} - Promise с результатом или void при использовании callback
   */
  getTicker(symbol, callback) {
    this.log(`Fetching ticker for ${symbol}`);
    return this.request('GET', '/api/v2/mix/market/ticker', { 
      symbol,
      productType: "USDT-FUTURES"
    }, null, callback);
  }

  /**
   * Установка плеча
   * @param {string} symbol - Символ
   * @param {number} leverage - Плечо
   * @param {Function} callback - Callback-функция (опционально)
   * @returns {Promise|void} - Promise с результатом или void при использовании callback
   */
  setLeverage(symbol, leverage, callback) {
    this.log(`Попытка установки плеча ${leverage}x для ${symbol}`);
    
    // Приводим символ к нижнему регистру, как в примере
    const formattedSymbol = symbol.toLowerCase();
    
    const promise = new Promise(async (resolve, reject) => {
      try {
        const endpoint = '/api/v2/mix/account/set-leverage';
        const data = {
          symbol: formattedSymbol,
          productType: "USDT-FUTURES",
          marginCoin: "usdt",
          leverage: leverage.toString(),
          holdSide: "long_short" // Можно использовать "long_short" для обеих сторон
        };
        
        const response = await this.request('POST', endpoint, {}, data);
        this.log(`Установлено плечо ${leverage}x для ${symbol}`);
        resolve(response);
      } catch (error) {
        this.logError(`Ошибка установки плеча для ${symbol}: ${error.message}`);
        this.log(`Продолжаем работу без установки плеча для ${symbol}`);
        // Имитируем успешный ответ, чтобы не блокировать работу бота
        resolve({ code: '00000', msg: 'success', data: {} });
      }
    });
    
    // Обрабатываем в зависимости от стиля вызова (Promise или callback)
    if (typeof callback === 'function') {
      promise
        .then(result => callback(null, result))
        .catch(error => callback(error));
    } else {
      return promise;
    }
  }

  /**
   * Размещение ордера
   * @param {string} symbol - Символ
   * @param {string} side - Сторона (buy/sell)
   * @param {string} orderType - Тип ордера (market/limit)
   * @param {number} size - Размер ордера
   * @param {number} price - Цена (опционально)
   * @param {boolean} reduceOnly - Только для уменьшения позиции
   * @param {Function} callback - Callback-функция (опционально)
   * @returns {Promise|void} - Promise с результатом или void при использовании callback
   */
  placeOrder(symbol, side, orderType, size, price = null, reduceOnly = false, callback) {
    this.log(`Размещение ордера ${side} для ${symbol}, размер: ${size}`);
    
    const primaryEndpoint = '/api/v2/mix/order/place-order';
    const alternativeEndpoint = '/api/mix/v1/order/placeOrder';
    
    const primaryData = {
      symbol,
      marginCoin: 'USDT',
      size: size.toString(),
      side: side.toUpperCase(),
      orderType: orderType.toUpperCase(),
      productType: "USDT-FUTURES",
      reduceOnly: reduceOnly
    };
    
    if (price !== null) {
      primaryData.price = price.toString();
    }
    
    const alternativeData = {
      symbol,
      marginCoin: 'USDT',
      size: size.toString(),
      side: side.toUpperCase(),
      orderType: orderType.toUpperCase(),
      timeInForceValue: 'normal',
      reduceOnly: reduceOnly ? 'true' : 'false'
    };
    
    if (price !== null) {
      alternativeData.price = price.toString();
    }
    
    return this.requestWithFallback(
      'POST',
      primaryEndpoint,
      alternativeEndpoint,
      {},
      primaryData,
      alternativeData,
      callback
    );
  }

  /**
   * Отмена ордера
   * @param {string} symbol - Символ
   * @param {string} orderId - ID ордера
   * @param {Function} callback - Callback-функция (опционально)
   * @returns {Promise|void} - Promise с результатом или void при использовании callback
   */
  cancelOrder(symbol, orderId, callback) {
    this.log(`Отмена ордера ${orderId} для ${symbol}`);
    
    const primaryEndpoint = '/api/v2/mix/order/cancel-order';
    const alternativeEndpoint = '/api/mix/v1/order/cancel-order';
    
    const primaryData = {
      symbol,
      orderId,
      productType: "USDT-FUTURES",
      marginCoin: 'USDT'
    };
    
    const alternativeData = {
      symbol,
      orderId,
      marginCoin: 'USDT'
    };
    
    return this.requestWithFallback(
      'POST',
      primaryEndpoint,
      alternativeEndpoint,
      {},
      primaryData,
      alternativeData,
      callback
    );
  }

  /**
   * Получение истории сделок
   * @param {string} symbol - Символ
   * @param {number} limit - Ограничение количества результатов
   * @param {Function} callback - Callback-функция (опционально)
   * @returns {Promise|void} - Promise с результатом или void при использовании callback
   */
  getTradeHistory(symbol, limit = 100, callback) {
    this.log(`Получение истории сделок для ${symbol}`);
    
    const primaryEndpoint = '/api/v2/mix/order/fills';
    const alternativeEndpoint = '/api/mix/v1/order/fills';
    
    const params = {
      symbol,
      productType: "USDT-FUTURES",
      limit
    };
    
    return this.requestWithFallback(
      'GET',
      primaryEndpoint,
      alternativeEndpoint,
      params,
      null,
      null,
      callback
    );
  }

  /**
   * Проверка валидности API ключей
   * @param {boolean} verbose - Подробный вывод
   * @param {Function} callback - Callback-функция (опционально)
   * @returns {Promise|void} - Promise с результатом или void при использовании callback
   */
  validateKeys(verbose = true, callback) {
    if (verbose) this.log('Проверка API ключей BitGet...');
    
    const promise = new Promise(async (resolve, reject) => {
      try {
        const response = await this.getAccountBalance();
        
        if (response && response.code === '00000') {
          if (verbose) this.log('✅ API ключи BitGet валидны');
          resolve(true);
        } else {
          if (verbose) this.logError('❌ API ключи BitGet невалидны:', response);
          resolve(false);
        }
      } catch (error) {
        if (verbose) this.logError('❌ Ошибка проверки API ключей BitGet:', error.message);
        resolve(false);
      }
    });
    
    // Обрабатываем в зависимости от стиля вызова (Promise или callback)
    if (typeof callback === 'function') {
      promise
        .then(result => callback(null, result))
        .catch(error => callback(error));
    } else {
      return promise;
    }
  }
}

module.exports = BitgetAPI;
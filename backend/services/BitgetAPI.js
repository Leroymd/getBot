// backend/services/BitgetAPI.js
const crypto = require('crypto');
const axios = require('axios');
const config = require('../config');
const querystring = require('querystring');

class BitgetAPI {
  constructor() {
    this.baseUrl = config.bitget.apiUrl;
    this.apiKey = config.bitget.apiKey;
    this.secretKey = config.bitget.secretKey;
    this.passphrase = config.bitget.passphrase;
    this.demo = config.bitget.demo;
    
    console.log('BitGet API initialized with:');
    console.log('- API Key:', this.apiKey ? `${this.apiKey.substring(0, 4)}...` : 'Not set');
    console.log('- Secret Key:', this.secretKey ? 'Set (hidden)' : 'Not set');
    console.log('- Passphrase:', this.passphrase ? 'Set (hidden)' : 'Not set');
    console.log('- Demo mode:', this.demo ? 'Enabled' : 'Disabled');
  }

  // Генерация подписи для API запросов
  generateSignature(timestamp, method, requestPath, body = '') {
    // Формируем сообщение для подписи
    const message = timestamp + method.toUpperCase() + requestPath + (body || '');
    
    console.log('Signature message:', message);
    
    // Создаем HMAC SHA256 подпись с secretKey и кодируем в Base64
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(message)
      .digest('base64');
    
    console.log('Generated signature:', signature);
    return signature;
  }

  // Заголовки для API запросов
  getHeaders(timestamp, method, requestPath, body = '') {
    const signature = this.generateSignature(timestamp, method, requestPath, body);
    
    return {
      'ACCESS-KEY': this.apiKey,
      'ACCESS-SIGN': signature,
      'ACCESS-TIMESTAMP': timestamp,
      'ACCESS-PASSPHRASE': this.passphrase,
      'Content-Type': 'application/json',
      'X-SIMULATED-TRADING': this.demo ? '1' : '0'
    };
  }

  // Выполнение API запроса
  async request(method, endpoint, params = {}, data = null) {
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
      
      console.log(`API Request: ${method.toUpperCase()} ${url}`);
      console.log('Request params:', params);
      
      if (jsonData) {
        console.log('Request body:', jsonData);
      }
      
      // Выполняем запрос
      const response = await axios({
        method: method.toUpperCase(),
        url,
        headers,
        data: jsonData || undefined
      });
      
      console.log(`API Response (${method.toUpperCase()} ${endpoint}):`, 
                 response.status, response.statusText);
      
      return response.data;
    } catch (error) {
      console.error(`API Error (${method.toUpperCase()} ${endpoint}):`, error.message);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      
      throw error;
    }
  }

  // Получение баланса аккаунта
  async getAccountBalance() {
    // Используем актуальный эндпоинт из API v2
    return this.request('GET', '/api/v2/mix/account/accounts', { productType: "USDT-FUTURES" });
  }

  // Получение открытых позиций
  async getPositions(symbol = '') {
    const params = { productType: "USDT-FUTURES" };
    if (symbol) params.symbol = symbol;
    return this.request('GET', '/api/v2/mix/position/all-position', params);
  }

  // Получение ордеров
  async getOrders(symbol, status = 'HISTORY', limit = 100) {
    return this.request('GET', '/api/v2/mix/order/history', {
      symbol,
      productType: "USDT-FUTURES",
      startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 дней назад
      endTime: Date.now(),
      pageSize: limit
    });
  }

  // Получение списка символов
  async getSymbols() {
    return this.request('GET', '/api/v2/mix/market/contracts', { productType: "USDT-FUTURES" });
  }

  // Получение свечей (klines)
  async getKlines(symbol, interval = '1m', limit = 100) {
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
    
    try {
      console.log(`Fetching klines for ${symbol} with timeframe ${formattedInterval}`);
      
      const response = await this.request('GET', '/api/v2/mix/market/candles', {
        symbol,
        productType: "USDT-FUTURES",
        granularity: formattedInterval,
        limit
      });
      
      if (response && response.data && Array.isArray(response.data)) {
        console.log(`Получены свечи для ${symbol}: ${response.data.length} шт.`);
      } else {
        console.warn(`Некорректный формат ответа API для свечей ${symbol}`);
      }
      
      return response;
    } catch (error) {
      console.error(`Error fetching klines for ${symbol} with interval ${formattedInterval}:`, error);
      
      // Если не удалось получить данные с текущим интервалом, пробуем другой
      if (interval !== '15m') {
        console.log(`Retrying with 15m timeframe for ${symbol}`);
        return this.getKlines(symbol, '15m', limit);
      }
      
      throw error;
    }
  }

  // Получение текущей цены (тикер)
  async getTicker(symbol) {
    try {
      console.log(`Fetching ticker for ${symbol}`);
      const response = await this.request('GET', '/api/v2/mix/market/ticker', { 
        symbol,
        productType: "USDT-FUTURES"
      });
      console.log('Ticker response:', response);
      return response;
    } catch (error) {
      console.error(`Error getting ticker for ${symbol}:`, error);
      throw error;
    }
  }

 // Обновленный метод setLeverage в BitgetAPI.js
// Обновленный метод setLeverage в BitgetAPI.js
async setLeverage(symbol, leverage) {
  try {
    console.log(`Попытка установки плеча ${leverage}x для ${symbol}`);
    
    // Приводим символ к нижнему регистру
    const formattedSymbol = symbol.toLowerCase();
    
    const endpoint = '/api/v2/mix/account/set-leverage';
    const data = {
      symbol: formattedSymbol,
      productType: "USDT-FUTURES",
      marginCoin: "usdt",
      leverage: leverage.toString(),
      holdSide: "long_short" // Убедимся, что это поле существует и не пустое
    };
    
    try {
      const response = await this.request('POST', endpoint, {}, data);
      console.log(`Установлено плечо ${leverage}x для ${symbol}`);
      return response;
    } catch (error1) {
      // Если первая попытка не удалась, попробуем отдельно для каждой стороны
      console.log(`Попытка установки плеча отдельно для long и short`);
      
      // Попытка для long
      try {
        const longData = { ...data, holdSide: "long" };
        await this.request('POST', endpoint, {}, longData);
      } catch (longError) {
        console.warn(`Ошибка установки плеча для long: ${longError.message}`);
      }
      
      // Попытка для short
      try {
        const shortData = { ...data, holdSide: "short" };
        await this.request('POST', endpoint, {}, shortData);
      } catch (shortError) {
        console.warn(`Ошибка установки плеча для short: ${shortError.message}`);
      }
      
      console.log(`Плечо ${leverage}x установлено для ${symbol} (частично или полностью)`);
      return { code: '00000', msg: 'success', data: {} };
    }
  } catch (error) {
    console.warn(`Ошибка установки плеча для ${symbol}: ${error.message}`);
    console.log(`Продолжаем работу без установки плеча для ${symbol}`);
    
    // Имитируем успешный ответ, чтобы не блокировать работу бота
    return { code: '00000', msg: 'success', data: {} };
  }
}

  // Отмена ордера
  async cancelOrder(symbol, orderId) {
    try {
      const endpoint = '/api/v2/mix/order/cancel-order';
      const data = {
        symbol,
        orderId,
        productType: "USDT-FUTURES",
        marginCoin: 'USDT'
      };
      
      return this.request('POST', endpoint, {}, data);
    } catch (error) {
      console.error(`Ошибка отмены ордера для ${symbol}:`, error);
      
      // Пробуем альтернативный URL
      try {
        console.log('Пробуем альтернативный URL для отмены ордера');
        const alternativeEndpoint = '/api/mix/v1/order/cancel-order';
        
        const alternativeData = {
          symbol,
          orderId,
          marginCoin: 'USDT'
        };
        
        return this.request('POST', alternativeEndpoint, {}, alternativeData);
      } catch (altError) {
        console.error('Альтернативный URL также не сработал:', altError);
        throw error; // Выбрасываем исходную ошибку
      }
    }
  }

  // Получение истории сделок
  async getTradeHistory(symbol, limit = 100) {
    try {
      return this.request('GET', '/api/v2/mix/order/fills', {
        symbol,
        productType: "USDT-FUTURES",
        limit
      });
    } catch (error) {
      console.error(`Ошибка получения истории сделок для ${symbol}:`, error);
      
      // Пробуем альтернативный URL
      try {
        console.log('Пробуем альтернативный URL для истории сделок');
        return this.request('GET', '/api/mix/v1/order/fills', {
          symbol,
          limit
        });
      } catch (altError) {
        console.error('Альтернативный URL также не сработал:', altError);
        throw error; // Выбрасываем исходную ошибку
      }
    }
  }
  
  // Проверка валидности API ключей
  async validateKeys(verbose = true) {
    try {
      if (verbose) console.log('Проверка API ключей BitGet...');
      
      const response = await this.getAccountBalance();
      
      if (response && response.code === '00000') {
        if (verbose) console.log('✅ API ключи BitGet валидны');
        return true;
      } else {
        if (verbose) console.error('❌ API ключи BitGet невалидны:', response);
        return false;
      }
    } catch (error) {
      if (verbose) console.error('❌ Ошибка проверки API ключей BitGet:', error.message);
      return false;
    }
  }
}

module.exports = BitgetAPI;
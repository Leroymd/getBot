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
    return this.request('GET', '/api/v2/mix/market/candles', {
      symbol,
      productType: "USDT-FUTURES",
      granularity: interval,
      limit
    });
  }

  // Получение текущей цены (тикер)
  async getTicker(symbol) {
    return this.request('GET', '/api/v2/mix/market/ticker', { 
      symbol,
      productType: "USDT-FUTURES"
    });
  }

  // Установка плеча для символа
  async setLeverage(symbol, leverage) {
    const endpoint = '/api/v2/mix/account/set-leverage';
    const data = {
      symbol,
      marginCoin: 'USDT',
      leverage: leverage.toString(),
      holdSide: 'long_short',
      productType: "USDT-FUTURES"
    };
    
    return this.request('POST', endpoint, {}, data);
  }

  // Размещение ордера
  async placeOrder(symbol, side, orderType, size, price = null, reduceOnly = false) {
    const endpoint = '/api/v2/mix/order/place';
    const data = {
      symbol,
      marginCoin: 'USDT',
      size: size.toString(),
      side: side.toUpperCase(),
      orderType: orderType.toUpperCase(),
      productType: "USDT-FUTURES",
      reduceOnly: reduceOnly
    };
    
    if (price !== null) {
      data.price = price.toString();
    }
    
    return this.request('POST', endpoint, {}, data);
  }

  // Отмена ордера
  async cancelOrder(symbol, orderId) {
    const endpoint = '/api/v2/mix/order/cancel';
    const data = {
      symbol,
      orderId,
      productType: "USDT-FUTURES",
      marginCoin: 'USDT'
    };
    
    return this.request('POST', endpoint, {}, data);
  }

  // Получение истории сделок
  async getTradeHistory(symbol, limit = 100) {
    return this.request('GET', '/api/v2/mix/order/fills', {
      symbol,
      productType: "USDT-FUTURES",
      limit
    });
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
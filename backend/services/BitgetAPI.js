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
      if (Object.keys(params).length > 0 && method.toUpperCase() === 'GET') {
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
}

module.exports = BitgetAPI;
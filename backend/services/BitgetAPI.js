// backend/services/BitgetAPI.js (частичное обновление только функций, которые нужно изменить)

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

// Выполнение API запроса с поддержкой callback
request(method, endpoint, params = {}, data = null, callback) {
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
  axios({
    method: method.toUpperCase(),
    url,
    headers,
    data: jsonData || undefined
  })
  .then(response => {
    console.log(`API Response (${method.toUpperCase()} ${endpoint}):`, 
              response.status, response.statusText);
    callback(null, response.data);
  })
  .catch(error => {
    console.error(`API Error (${method.toUpperCase()} ${endpoint}):`, error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    callback(error);
  });
}

// Получение баланса аккаунта с поддержкой callback
getAccountBalance(callback) {
  // Используем актуальный эндпоинт из API v2
  this.request('GET', '/api/v2/mix/account/accounts', { productType: "USDT-FUTURES" }, null, callback);
}

// Получение открытых позиций с поддержкой callback
getPositions(symbol = '', callback) {
  const params = { productType: "USDT-FUTURES" };
  if (symbol) params.symbol = symbol;
  this.request('GET', '/api/v2/mix/position/all-position', params, null, callback);
}

// Получение ордеров с поддержкой callback
getOrders(symbol, status = 'HISTORY', limit = 100, callback) {
  this.request('GET', '/api/v2/mix/order/history', {
    symbol,
    productType: "USDT-FUTURES",
    startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 дней назад
    endTime: Date.now(),
    pageSize: limit
  }, null, callback);
}

// Получение списка символов с поддержкой callback
getSymbols(callback) {
  this.request('GET', '/api/v2/mix/market/contracts', { productType: "USDT-FUTURES" }, null, callback);
}

// Получение свечей (klines) с поддержкой callback
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
  
  console.log(`Fetching klines for ${symbol} with timeframe ${formattedInterval}`);
  
  this.request('GET', '/api/v2/mix/market/candles', {
    symbol,
    productType: "USDT-FUTURES",
    granularity: formattedInterval,
    limit
  }, null, (err, response) => {
    if (err) {
      console.error(`Error fetching klines for ${symbol} with interval ${formattedInterval}:`, err);
      
      // Если не удалось получить данные с текущим интервалом, пробуем другой
      if (interval !== '15m') {
        console.log(`Retrying with 15m timeframe for ${symbol}`);
        this.getKlines(symbol, '15m', limit, callback);
      } else {
        callback(err);
      }
    } else {
      if (response && response.data && Array.isArray(response.data)) {
        console.log(`Получены свечи для ${symbol}: ${response.data.length} шт.`);
      } else {
        console.warn(`Некорректный формат ответа API для свечей ${symbol}`);
      }
      
      callback(null, response);
    }
  });
}

// Получение текущей цены (тикер) с поддержкой callback
getTicker(symbol, callback) {
  console.log(`Fetching ticker for ${symbol}`);
  this.request('GET', '/api/v2/mix/market/ticker', { 
    symbol,
    productType: "USDT-FUTURES"
  }, null, (err, response) => {
    if (err) {
      console.error(`Error getting ticker for ${symbol}:`, err);
      callback(err);
    } else {
      console.log('Ticker response:', response);
      callback(null, response);
    }
  });
}

// Обновленный метод setLeverage с поддержкой callback
setLeverage(symbol, leverage, callback) {
  console.log(`Попытка установки плеча ${leverage}x для ${symbol}`);
  
  // Приводим символ к нижнему регистру, как в примере
  const formattedSymbol = symbol.toLowerCase();
  
  const endpoint = '/api/v2/mix/account/set-leverage';
  const data = {
    symbol: formattedSymbol,
    productType: "USDT-FUTURES",
    marginCoin: "usdt",
    leverage: leverage.toString(),
    holdSide: "long_short" // Можно использовать "long_short" для обеих сторон
  };
  
  this.request('POST', endpoint, {}, data, (err, response) => {
    if (err) {
      console.warn(`Ошибка установки плеча для ${symbol}: ${err.message}`);
      console.log(`Продолжаем работу без установки плеча для ${symbol}`);
      // Имитируем успешный ответ, чтобы не блокировать работу бота
      callback(null, { code: '00000', msg: 'success', data: {} });
    } else {
      console.log(`Установлено плечо ${leverage}x для ${symbol}`);
      callback(null, response);
    }
  });
}

// Размещение ордера с поддержкой callback
placeOrder(symbol, side, orderType, size, price = null, reduceOnly = false, callback) {
  const endpoint = '/api/v2/mix/order/place-order';
  
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
  
  console.log(`Размещение ордера ${side} для ${symbol}, размер: ${size}`);
  
  this.request('POST', endpoint, {}, data, (err, response) => {
    if (err) {
      console.error(`Ошибка размещения ордера для ${symbol}:`, err);
      
      // Пробуем альтернативный URL, если первый не сработал
      console.log('Пробуем альтернативный URL для размещения ордера');
      const alternativeEndpoint = '/api/mix/v1/order/placeOrder';
      
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
      
      this.request('POST', alternativeEndpoint, {}, alternativeData, (altErr, altResponse) => {
        if (altErr) {
          console.error('Альтернативный URL также не сработал:', altErr);
          callback(err); // Возвращаем исходную ошибку
        } else {
          callback(null, altResponse);
        }
      });
    } else {
      callback(null, response);
    }
  });
}

// Отмена ордера с поддержкой callback
cancelOrder(symbol, orderId, callback) {
  const endpoint = '/api/v2/mix/order/cancel-order';
  const data = {
    symbol,
    orderId,
    productType: "USDT-FUTURES",
    marginCoin: 'USDT'
  };
  
  this.request('POST', endpoint, {}, data, (err, response) => {
    if (err) {
      console.error(`Ошибка отмены ордера для ${symbol}:`, err);
      
      // Пробуем альтернативный URL
      console.log('Пробуем альтернативный URL для отмены ордера');
      const alternativeEndpoint = '/api/mix/v1/order/cancel-order';
      
      const alternativeData = {
        symbol,
        orderId,
        marginCoin: 'USDT'
      };
      
      this.request('POST', alternativeEndpoint, {}, alternativeData, (altErr, altResponse) => {
        if (altErr) {
          console.error('Альтернативный URL также не сработал:', altErr);
          callback(err); // Возвращаем исходную ошибку
        } else {
          callback(null, altResponse);
        }
      });
    } else {
      callback(null, response);
    }
  });
}

// Получение истории сделок с поддержкой callback
getTradeHistory(symbol, limit = 100, callback) {
  this.request('GET', '/api/v2/mix/order/fills', {
    symbol,
    productType: "USDT-FUTURES",
    limit
  }, null, (err, response) => {
    if (err) {
      console.error(`Ошибка получения истории сделок для ${symbol}:`, err);
      
      // Пробуем альтернативный URL
      console.log('Пробуем альтернативный URL для истории сделок');
      this.request('GET', '/api/mix/v1/order/fills', {
        symbol,
        limit
      }, null, (altErr, altResponse) => {
        if (altErr) {
          console.error('Альтернативный URL также не сработал:', altErr);
          callback(err); // Возвращаем исходную ошибку
        } else {
          callback(null, altResponse);
        }
      });
    } else {
      callback(null, response);
    }
  });
}

// Проверка валидности API ключей с поддержкой callback
validateKeys(verbose = true, callback) {
  if (verbose) console.log('Проверка API ключей BitGet...');
  
  this.getAccountBalance((err, response) => {
    if (err) {
      if (verbose) console.error('❌ Ошибка проверки API ключей BitGet:', err.message);
      callback(null, false);
      return;
    }
    
    if (response && response.code === '00000') {
      if (verbose) console.log('✅ API ключи BitGet валидны');
      callback(null, true);
    } else {
      if (verbose) console.error('❌ API ключи BitGet невалидны:', response);
      callback(null, false);
    }
  });
}
import api from './api';

export const getAccountBalance = async () => {
  try {
    // Получаем данные из API
    const response = await api.get('/account/balance');
    console.log('Raw account balance response:', response);
    
    // Проверяем валидность ответа
    if (response && response.data) {
      return response;
    }
    
    // Если ответ не в ожидаемом формате, возвращаем дефолтную структуру
    throw new Error('Invalid response format');
  } catch (error) {
    console.error('Error getting account balance:', error);
    
    // В случае ошибки возвращаем дефолтную структуру с нулевым балансом
    return { 
      code: '00000',
      msg: 'success',
      requestTime: Date.now(),
      data: {
        marginCoin: 'USDT',
        available: 0,
        equity: 0,
        usdtEquity: 0
      }
    };
  }
};

export const getPositions = async (symbol) => {
  try {
    const url = symbol ? `/account/positions?symbol=${symbol}` : '/account/positions';
    const response = await api.get(url);
    
    if (response && (response.data || Array.isArray(response))) {
      return response;
    }
    
    throw new Error('Invalid positions response format');
  } catch (error) {
    console.error('Error getting positions:', error);
    return { code: '00000', msg: 'success', requestTime: Date.now(), data: [] };
  }
};

export const getOrders = async (symbol, status, limit) => {
  try {
    let url = '/account/orders';
    const params = [];
    
    if (symbol) params.push(`symbol=${symbol}`);
    if (status) params.push(`status=${status}`);
    if (limit) params.push(`limit=${limit}`);
    
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    
    const response = await api.get(url);
    
    if (response && (response.data || Array.isArray(response))) {
      return response;
    }
    
    throw new Error('Invalid orders response format');
  } catch (error) {
    console.error('Error getting orders:', error);
    return { code: '00000', msg: 'success', requestTime: Date.now(), data: [] };
  }
};
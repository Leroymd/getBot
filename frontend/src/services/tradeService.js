import api from './api';

export const getTrades = async (filters = {}) => {
  try {
    const { symbol, status, dateFrom, dateTo, limit = 100 } = filters;
    
    let url = '/trades';
    const params = [];
    
    if (symbol) params.push(`symbol=${symbol}`);
    if (status) params.push(`status=${status}`);
    if (dateFrom) params.push(`dateFrom=${dateFrom}`);
    if (dateTo) params.push(`dateTo=${dateTo}`);
    if (limit) params.push(`limit=${limit}`);
    
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    
    return await api.get(url);
  } catch (error) {
    console.error('Error getting trades:', error);
    
    // Временные данные для демонстрации
    return [
      {
        _id: '1',
        symbol: 'BTCUSDT',
        botId: 'bot1',
        direction: 'LONG',
        entryPrice: 82345.67,
        exitPrice: 83210.45,
        quantity: 0.01,
        entryTime: new Date(Date.now() - 3600000),
        exitTime: new Date(),
        profitLoss: 125.67,
        status: 'CLOSED',
        dcaCount: 0,
        closeReason: 'TRAILING_STOP'
      },
      {
        _id: '2',
        symbol: 'ETHUSDT',
        botId: 'bot2',
        direction: 'SHORT',
        entryPrice: 5987.34,
        exitPrice: 5845.21,
        quantity: 0.1,
        entryTime: new Date(Date.now() - 7200000),
        exitTime: new Date(Date.now() - 3600000),
        profitLoss: 87.45,
        status: 'CLOSED',
        dcaCount: 1,
        closeReason: 'MAX_DURATION'
      },
      {
        _id: '3',
        symbol: 'SOLUSDT',
        botId: 'bot3',
        direction: 'LONG',
        entryPrice: 302.56,
        quantity: 1,
        entryTime: new Date(Date.now() - 1800000),
        status: 'OPEN',
        dcaCount: 0
      }
    ];
  }
};
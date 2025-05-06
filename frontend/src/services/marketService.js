import api from './api';

export const getSymbols = async () => {
  try {
    const response = await api.get('/market/symbols');
    console.log('Symbols response:', response);
    return response;
  } catch (error) {
    console.error('Error fetching symbols:', error);
    throw error;
  }
};

export const getKlines = async (symbol, interval = '1m', limit = 100) => {
  try {
    const response = await api.get(`/market/klines/${symbol}?interval=${interval}&limit=${limit}`);
    console.log('Klines response:', response);
    return response;
  } catch (error) {
    console.error(`Error fetching klines for ${symbol}:`, error);
    throw error;
  }
};

export const getTicker = async (symbol) => {
  try {
    console.log(`Fetching ticker for ${symbol}`);
    const response = await api.get(`/market/ticker/${symbol}`);
    console.log('Ticker response:', response);
    return response;
  } catch (error) {
    console.error(`Error getting ticker for ${symbol}:`, error);
    throw error;
  }
};
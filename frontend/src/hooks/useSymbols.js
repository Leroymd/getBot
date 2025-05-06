// frontend/src/hooks/useSymbols.js
// Исправление экспорта по умолчанию

import { useState, useEffect } from 'react';
import { getSymbols } from '../services/marketService';

function useSymbols() {
  const [symbols, setSymbols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSymbols = async () => {
      setLoading(true);
      try {
        const response = await getSymbols();
        console.log('Symbols response in hook:', response);
        
        // Дефолтные символы на случай проблем с API
        const defaultSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
        
        // Формат ответа API v2
        if (response && response.data && Array.isArray(response.data)) {
          // Извлекаем символы из данных
          const extractedSymbols = response.data
            .filter(item => item && typeof item.symbol === 'string')
            .map(item => item.symbol);
          
          if (extractedSymbols.length > 0) {
            console.log('Extracted symbols:', extractedSymbols);
            setSymbols(extractedSymbols);
          } else {
            console.warn('No symbols found in API response, using defaults');
            setSymbols(defaultSymbols);
          }
        } else {
          console.warn('Invalid API response structure, using default symbols');
          setSymbols(defaultSymbols);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching symbols:', err);
        setError(err);
        
        // В случае ошибки используем дефолтные символы
        setSymbols(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
      } finally {
        setLoading(false);
      }
    };

    fetchSymbols();
  }, []);

  return { symbols, loading, error };
}

export default useSymbols;


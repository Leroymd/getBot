// 2. Исправление hooks/useKlines.js для обеспечения загрузки данных
// frontend/src/hooks/useKlines.js

import { useState, useEffect } from 'react';
import { getKlines } from '../services/marketService';

const useKlines = (symbol, interval = '1m', limit = 100) => {
  const [klines, setKlines] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchKlines = async () => {
      if (!symbol) return;
      
      setLoading(true);
      try {
        const data = await getKlines(symbol, interval, limit);
        console.log('Klines data:', data); // Отладочная информация
        setKlines(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching klines:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchKlines();
    
    // Периодическое обновление данных
    const intervalId = setInterval(fetchKlines, 60000); // обновление каждую минуту
    
    return () => clearInterval(intervalId);
  }, [symbol, interval, limit]);

  return { klines, loading, error };
};

export default useKlines;

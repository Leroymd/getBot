// 2. ����������� hooks/useKlines.js ��� ����������� �������� ������
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
        console.log('Klines data:', data); // ���������� ����������
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
    
    // ������������� ���������� ������
    const intervalId = setInterval(fetchKlines, 60000); // ���������� ������ ������
    
    return () => clearInterval(intervalId);
  }, [symbol, interval, limit]);

  return { klines, loading, error };
};

export default useKlines;

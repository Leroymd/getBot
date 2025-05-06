import { useState, useEffect } from 'react';
import { getBotStatus } from '../services/botService';

const useBotStatus = (symbol) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    if (!symbol) {
      setStatus(null);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const data = await getBotStatus(symbol);
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Обновление каждые 30 секунд
    const interval = setInterval(fetchStatus, 30000);
    
    return () => clearInterval(interval);
  }, [symbol]);

  return { status, loading, error, refetch: fetchStatus };
};

export default useBotStatus;
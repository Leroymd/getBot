// frontend/src/hooks/useBotStats.js
import { useState, useEffect } from 'react';
import { getBotStatus } from '../services/botService';

function useBotStats(symbol, interval = 30000) {
  const [stats, setStats] = useState(null);
  const [running, setRunning] = useState(false);
  const [uptime, setUptime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    if (!symbol) return;

    try {
      setLoading(true);
      const response = await getBotStatus(symbol);
      
      // Проверка наличия данных в ответе
      if (response) {
        setStats(response.stats || null);
        setRunning(response.running || false);
        setUptime(response.uptime || 0);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching bot stats:', err);
      setError(err.message || 'Failed to load bot statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Обновляем статистику с заданным интервалом
    const timer = setInterval(fetchStats, interval);
    
    return () => clearInterval(timer);
  }, [symbol, interval]);

  return { stats, running, uptime, loading, error, refresh: fetchStats };
}

export default useBotStats;
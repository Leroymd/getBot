// frontend/src/hooks/useBotStats.js
import { useState, useEffect } from 'react';
import { getBotStatus } from '../services/botService';

function useBotStats(symbol, interval = 30000) {
  const [stats, setStats] = useState(null);
  const [running, setRunning] = useState(false);
  const [uptime, setUptime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  const fetchStats = async () => {
    if (!symbol) return;

    try {
      setLoading(true);
      const response = await getBotStatus(symbol);
      
      console.log('Bot status response:', response);
      
      // Проверка наличия ответа
      if (response) {
        setStats(response.stats || null);
        setRunning(response.running === true);
        setUptime(response.uptime || 0);
        setMessage(response.message || '');
      } else {
        console.warn('Empty response from bot status API');
        setRunning(false);
        setMessage('No response from server');
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching bot stats:', err);
      setError(err.message || 'Failed to load bot statistics');
      setRunning(false);
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

  return { stats, running, uptime, message, loading, error, refresh: fetchStats };
}

export default useBotStats;
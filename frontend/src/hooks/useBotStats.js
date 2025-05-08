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
        // Обеспечиваем загрузку stats даже если бот не запущен
        if (response.stats) {
          setStats(response.stats);
        } else if (response.running === false) {
          // Если бот не запущен, создаем минимальный объект статистики
          setStats({
            totalTrades: 0,
            winTrades: 0,
            lossTrades: 0,
            totalPnl: 0,
            maxDrawdown: 0,
            currentBalance: 100,
            initialBalance: 100,
            tradesToday: 0,
            hourlyTrades: Array(24).fill(0),
            hourlyPnl: Array(24).fill(0),
            strategyPerformance: {
              DCA: { trades: 0, winRate: 0, avgProfit: 0, avgLoss: 0 },
              SCALPING: { trades: 0, winRate: 0, avgProfit: 0, avgLoss: 0 }
            },
            lastMarketAnalysis: {
              timestamp: Date.now(),
              recommendedStrategy: 'DCA',
              marketType: 'UNKNOWN',
              volatility: 0,
              volumeRatio: 0,
              trendStrength: 0,
              confidence: 0.5
            },
            activeStrategy: 'DCA'
          });
        }
        
        setRunning(response.running === true);
        setUptime(response.uptime || 0);
        setMessage(response.message || '');
      } else {
        console.warn('Empty response from bot status API');
        setRunning(false);
        setMessage('No response from server');
        
        // В случае пустого ответа также создаем минимальный объект статистики
        setStats({
          totalTrades: 0,
          winTrades: 0,
          lossTrades: 0,
          totalPnl: 0,
          maxDrawdown: 0,
          currentBalance: 100,
          initialBalance: 100,
          tradesToday: 0,
          hourlyTrades: Array(24).fill(0),
          hourlyPnl: Array(24).fill(0),
          strategyPerformance: {
            DCA: { trades: 0, winRate: 0, avgProfit: 0, avgLoss: 0 },
            SCALPING: { trades: 0, winRate: 0, avgProfit: 0, avgLoss: 0 }
          },
          lastMarketAnalysis: {
            timestamp: Date.now(),
            recommendedStrategy: 'DCA',
            marketType: 'UNKNOWN',
            volatility: 0,
            volumeRatio: 0,
            trendStrength: 0,
            confidence: 0.5
          },
          activeStrategy: 'DCA'
        });
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching bot stats:', err);
      setError(err.message || 'Failed to load bot statistics');
      setRunning(false);
      
      // В случае ошибки также создаем минимальный объект статистики
      setStats({
        totalTrades: 0,
        winTrades: 0,
        lossTrades: 0,
        totalPnl: 0,
        maxDrawdown: 0,
        currentBalance: 100,
        initialBalance: 100,
        tradesToday: 0,
        hourlyTrades: Array(24).fill(0),
        hourlyPnl: Array(24).fill(0),
        strategyPerformance: {
          DCA: { trades: 0, winRate: 0, avgProfit: 0, avgLoss: 0 },
          SCALPING: { trades: 0, winRate: 0, avgProfit: 0, avgLoss: 0 }
        },
        lastMarketAnalysis: {
          timestamp: Date.now(),
          recommendedStrategy: 'DCA',
          marketType: 'UNKNOWN',
          volatility: 0,
          volumeRatio: 0,
          trendStrength: 0,
          confidence: 0.5
        },
        activeStrategy: 'DCA'
      });
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
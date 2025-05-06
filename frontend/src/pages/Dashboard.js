// frontend/src/pages/Dashboard.js (новая версия)
import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  Grid, 
  Paper, 
  Button, 
  CircularProgress, 
  Alert 
} from '@mui/material';
import { getBotStatus, startBot, stopBot } from '../services/botService';
import StatsCard from '../components/StatsCard';
import PositionCard from '../components/PositionCard';
import PnLChart from '../components/PnLChart';
import TradeList from '../components/TradeList';
import StrategyStats from '../components/StrategyStats';
import useSymbols from '../hooks/useSymbols';

const Dashboard = () => {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [botStatus, setBotStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { symbols } = useSymbols();

  // Загрузка статуса бота
  useEffect(() => {
    if (selectedSymbol) {
      fetchBotStatus();
      const interval = setInterval(fetchBotStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [selectedSymbol]);

  // Выбор первого символа, если нет выбранного
  useEffect(() => {
    if (!selectedSymbol && symbols && symbols.length > 0) {
      setSelectedSymbol(symbols[0]);
    }
  }, [symbols, selectedSymbol]);

  // Получение статуса бота
  const fetchBotStatus = async () => {
    try {
      setLoading(true);
      const response = await getBotStatus(selectedSymbol);
      setBotStatus(response);
      setError(null);
    } catch (err) {
      console.error('Error fetching bot status:', err);
      setError(`Ошибка загрузки статуса бота: ${err.message || 'Неизвестная ошибка'}`);
    } finally {
      setLoading(false);
    }
  };

  // Запуск бота
  const handleStartBot = async () => {
    try {
      setLoading(true);
      await startBot(selectedSymbol);
      await fetchBotStatus();
    } catch (err) {
      console.error('Error starting bot:', err);
      setError(`Ошибка запуска бота: ${err.message || 'Неизвестная ошибка'}`);
    } finally {
      setLoading(false);
    }
  };

  // Остановка бота
  const handleStopBot = async () => {
    try {
      setLoading(true);
      await stopBot(selectedSymbol);
      await fetchBotStatus();
    } catch (err) {
      console.error('Error stopping bot:', err);
      setError(`Ошибка остановки бота: ${err.message || 'Неизвестная ошибка'}`);
    } finally {
      setLoading(false);
    }
  };

  // Если идет загрузка и нет данных
  if (loading && !botStatus) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading data...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard ({selectedSymbol})
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        {(!botStatus || !botStatus.running) ? (
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleStartBot}
            disabled={loading}
          >
            Start Bot
          </Button>
        ) : (
          <Button 
            variant="contained" 
            color="error" 
            onClick={handleStopBot}
            disabled={loading}
          >
            Stop бля Bot
          </Button>
        )}
        
        <Button 
          variant="outlined" 
          onClick={fetchBotStatus}
          disabled={loading}
        >
          Refresh Data
        </Button>
      </Box>

      {botStatus && botStatus.stats && (
        <>
          <StatsCard stats={botStatus.stats} />
          
          <StrategyStats stats={botStatus.stats} />
          
          {botStatus.stats.openPosition && (
            <PositionCard position={botStatus.stats.openPosition} />
          )}
          
          <Grid container spacing={3} sx={{ mt: 2 }}>
            <Grid item xs={12} lg={8}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  PnL by Hour
                </Typography>
                <PnLChart data={botStatus.stats.hourlyPnl} />
              </Paper>
            </Grid>
            
            <Grid item xs={12} lg={4}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Bot Status
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body1">
                    Status: <strong>{botStatus.running ? 'Running' : 'Stopped'}</strong>
                  </Typography>
                  
                  {botStatus.running && (
                    <Typography variant="body1">
                      Uptime: <strong>{Math.floor(botStatus.uptime / (1000 * 60 * 60))} h {Math.floor((botStatus.uptime % (1000 * 60 * 60)) / (1000 * 60))} min</strong>
                    </Typography>
                  )}
                  
                  <Typography variant="body1">
                    Total Trades: <strong>{botStatus.stats.totalTrades}</strong>
                  </Typography>
                  
                  <Typography variant="body1">
                    Win Rate: <strong>{((botStatus.stats.winTrades / botStatus.stats.totalTrades) * 100 || 0).toFixed(2)}%</strong>
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 3 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Recent Trades
              </Typography>
              <TradeList symbol={selectedSymbol} />
            </Paper>
          </Box>
        </>
      )}
    </Box>
  );
};

export default Dashboard;
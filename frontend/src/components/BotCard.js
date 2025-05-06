import React, { useState } from 'react';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import Chip from '@mui/material/Chip';
import useBotStatus from '../hooks/useBotStatus';
import { startBot, stopBot } from '../services/botService';

const BotCard = ({ symbol, config }) => {
  const { status, loading, error, refetch } = useBotStatus(symbol);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

 / 6. Исправление проблемы с запуском бота
// frontend/src/components/BotCard.js (часть с обработчиками)

const handleStart = async () => {
  setIsStarting(true);
  try {
    const response = await startBot(symbol, config);
    console.log('Bot started:', response);
    await refetch();
  } catch (error) {
    console.error(`Error starting bot for ${symbol}:`, error);
    alert(`Ошибка запуска бота: ${error.message || 'Неизвестная ошибка'}`);
  } finally {
    setIsStarting(false);
  }
};

const handleStop = async () => {
  setIsStopping(true);
  try {
    const response = await stopBot(symbol);
    console.log('Bot stopped:', response);
    await refetch();
  } catch (error) {
    console.error(`Error stopping bot for ${symbol}:`, error);
    alert(`Ошибка остановки бота: ${error.message || 'Неизвестная ошибка'}`);
  } finally {
    setIsStopping(false);
  }
};


  if (loading) {
    return (
      <Card sx={{ minWidth: 275, height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress />
      </Card>
    );
  }

  const isRunning = status?.running;
  const uptime = status?.uptime ? Math.floor(status.uptime / (1000 * 60 * 60)) : 0; // в часах
  const stats = status?.stats || {};

  return (
    <Card sx={{ minWidth: 275, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={symbol}
        subheader={
          <Chip 
            label={isRunning ? "Running" : "Stopped"} 
            color={isRunning ? "success" : "error"} 
            size="small" 
            sx={{ mt: 1 }}
          />
        }
        action={
          <Switch
            checked={isRunning}
            onChange={isRunning ? handleStop : handleStart}
            disabled={isStarting || isStopping}
          />
        }
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="subtitle2" color="textSecondary">Balance</Typography>
            <Typography variant="h6">{stats.currentBalance?.toFixed(2)} USDT</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="subtitle2" color="textSecondary">P&L</Typography>
            <Typography 
              variant="h6" 
              color={stats.totalPnl > 0 ? 'success.main' : 'error.main'}
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              {stats.totalPnl?.toFixed(2)} USDT
              {stats.totalPnl > 0 ? <TrendingUpIcon sx={{ ml: 1 }} /> : <TrendingDownIcon sx={{ ml: 1 }} />}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="subtitle2" color="textSecondary">Win Rate</Typography>
            <Typography variant="h6">{stats.winRate?.toFixed(2)}%</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="subtitle2" color="textSecondary">Total Trades</Typography>
            <Typography variant="h6">{stats.totalTrades || 0}</Typography>
          </Grid>
          {isRunning && (
            <>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Uptime</Typography>
                <Typography variant="body2">{uptime} hours</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Today's Trades</Typography>
                <Typography variant="body2">{stats.tradesToday || 0}</Typography>
              </Grid>
            </>
          )}
        </Grid>
      </CardContent>
      <CardActions>
        <Button 
          size="small" 
          startIcon={isRunning ? <StopIcon /> : <PlayArrowIcon />}
          color={isRunning ? "error" : "success"}
          onClick={isRunning ? handleStop : handleStart}
          disabled={isStarting || isStopping}
        >
          {isRunning ? "Stop" : "Start"}
        </Button>
        <Button size="small" color="primary">
          Details
        </Button>
      </CardActions>
    </Card>
  );
};

export default BotCard;
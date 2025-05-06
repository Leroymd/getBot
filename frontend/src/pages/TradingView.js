// 2. frontend/src/pages/TradingView.js
// Исправление компонента для корректной обработки данных

import React, { useState, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { startBot } from '../services/botService';
import ChartComponent from '../components/ChartComponent';
import useSymbols from '../hooks/useSymbols';
import useTicker from '../hooks/useTicker';

// Компонент выбора таймфрейма
const TimeframeSelector = ({ value, onChange }) => {
  const timeframes = [
    { value: '1m', label: '1 Minute' },
    { value: '3m', label: '3 Minutes' },
    { value: '5m', label: '5 Minutes' },
    { value: '15m', label: '15 Minutes' },
    { value: '30m', label: '30 Minutes' },
    { value: '1h', label: '1 Hour' },
    { value: '4h', label: '4 Hours' },
    { value: '1d', label: '1 Day' }
  ];
  
  return (
    <FormControl sx={{ minWidth: 120 }}>
      <InputLabel>Timeframe</InputLabel>
      <Select
        value={value}
        onChange={onChange}
        label="Timeframe"
      >
        {timeframes.map((tf) => (
          <MenuItem key={tf.value} value={tf.value}>{tf.label}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

const TradingView = () => {
  const { symbols, loading: loadingSymbols, error: symbolsError } = useSymbols();
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT'); // Устанавливаем дефолтное значение
  const [timeframe, setTimeframe] = useState('1m');
  const { ticker, loading: loadingTicker, error: tickerError } = useTicker(selectedSymbol);

  // Обновление выбранного символа при загрузке данных
  useEffect(() => {
    if (symbols && symbols.length > 0 && !selectedSymbol) {
      setSelectedSymbol(symbols[0]);
    }
  }, [symbols, selectedSymbol]);

  const handleSymbolChange = (event) => {
    setSelectedSymbol(event.target.value);
  };

  const handleTimeframeChange = (event) => {
    setTimeframe(event.target.value);
  };

  const handleStartBot = async () => {
    if (!selectedSymbol) {
      alert('Пожалуйста, выберите торговую пару');
      return;
    }
    
    try {
      const response = await startBot(selectedSymbol);
      console.log('Bot started:', response);
      alert(`Бот для ${selectedSymbol} успешно запущен!`);
    } catch (error) {
      console.error('Error starting bot:', error);
      alert(`Ошибка запуска бота: ${error.message || 'Неизвестная ошибка'}`);
    }
  };

  // Форматирование цены
  const formatPrice = (price) => {
    if (!price) return '0.00';
    return parseFloat(price).toFixed(2);
  };

  // Расчет изменения в процентах
  const calculateChange = (last, open) => {
    if (!last || !open) return 0;
    return ((last - open) / open) * 100;
  };

  if (loadingSymbols) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Загрузка данных...</Typography>
      </Box>
    );
  }

  if (symbolsError && (!symbols || symbols.length === 0)) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>Trading View</Typography>
        <Paper sx={{ p: 3, bgcolor: 'error.light' }}>
          <Typography variant="h6">Ошибка загрузки символов</Typography>
          <Typography>{symbolsError?.message || 'Неизвестная ошибка'}</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Trading View
      </Typography>
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Symbol</InputLabel>
            <Select
              value={selectedSymbol}
              onChange={handleSymbolChange}
              label="Symbol"
              disabled={loadingSymbols}
            >
              {Array.isArray(symbols) && symbols.map((symbol) => (
                <MenuItem key={symbol} value={symbol}>{symbol}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item>
          <TimeframeSelector value={timeframe} onChange={handleTimeframeChange} />
        </Grid>
      </Grid>
      
      {selectedSymbol && (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={9}>
            <Paper sx={{ p: 2, height: '600px' }}>
              <ChartComponent 
                symbol={selectedSymbol} 
                interval={timeframe}
                height={560}
              />
            </Paper>
          </Grid>
          
          <Grid item xs={12} lg={3}>
            <Paper sx={{ p: 2, height: '600px', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>
                Market Info
              </Typography>
              
              {loadingTicker ? (
  <Typography>Loading market data...</Typography>
) : tickerError ? (
  <Typography color="error">Error loading market data: {tickerError.message}</Typography>
) : ticker && ticker.data ? (
  <Box>
    <Grid container spacing={2}>
      <Grid item xs={6}>
        <Typography variant="subtitle2" color="textSecondary">Last Price</Typography>
        <Typography variant="h5">{formatPrice(ticker.data?.last)}</Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="subtitle2" color="textSecondary">24h Change</Typography>
        <Typography 
          variant="h5" 
          color={parseFloat(ticker.data?.change24h || 0) >= 0 ? 'success.main' : 'error.main'}
        >
          {(parseFloat(ticker.data?.change24h || 0) * 100).toFixed(2)}%
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="subtitle2" color="textSecondary">24h High</Typography>
        <Typography variant="body1">{formatPrice(ticker.data?.high24h)}</Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="subtitle2" color="textSecondary">24h Low</Typography>
        <Typography variant="body1">{formatPrice(ticker.data?.low24h)}</Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="subtitle2" color="textSecondary">24h Volume</Typography>
        <Typography variant="body1">{parseFloat(ticker.data?.volume24h || 0).toFixed(2)}</Typography>
      </Grid>
      <Grid item xs={12} sx={{ mt: 2 }}>
        <Button 
          variant="contained" 
          color="success"
          fullWidth
          sx={{ mb: 1 }}
        >
          Buy / Long
        </Button>
        <Button 
          variant="contained" 
          color="error"
          fullWidth
        >
          Sell / Short
        </Button>
      </Grid>
    </Grid>
  </Box>
) : (
  <Typography>No market data available.</Typography>
)}

              <Box sx={{ flexGrow: 1 }} />
              
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                  Quick Bot Actions
                </Typography>
                <Button 
                  variant="outlined" 
                  color="primary"
                  fullWidth
                  sx={{ mb: 1 }}
                  onClick={handleStartBot}
                >
                  Start Bot for {selectedSymbol || 'BTCUSDT'}
                </Button>
                <Button 
                  variant="outlined" 
                  color="error"
                  fullWidth
                >
                  Stop All Bots
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default TradingView;
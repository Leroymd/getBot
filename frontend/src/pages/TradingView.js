// frontend/src/pages/TradingView.js
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
import { startBot, getBotStatus } from '../services/botService';
import ChartComponent from '../components/ChartComponent';
import useSymbols from '../hooks/useSymbols';
import useTicker from '../hooks/useTicker';
import MarketAnalyzer from '../components/MarketAnalyzer';

// Компонент выбора таймфрейма
const TimeframeSelector = ({ value, onChange }) => {
  const timeframes = [
    { value: '1m', label: '1 Минута' },
    { value: '3m', label: '3 Минуты' },
    { value: '5m', label: '5 Минут' },
    { value: '15m', label: '15 Минут' },
    { value: '30m', label: '30 Минут' },
    { value: '1h', label: '1 Час' },
    { value: '4h', label: '4 Часа' },
    { value: '1d', label: '1 День' }
  ];
  
  return (
    <FormControl sx={{ minWidth: 120 }}>
      <InputLabel>Таймфрейм</InputLabel>
      <Select
        value={value}
        onChange={onChange}
        label="Таймфрейм"
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
  const [botStatus, setBotStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Обновление выбранного символа при загрузке данных
  useEffect(() => {
    if (symbols && symbols.length > 0 && !selectedSymbol) {
      setSelectedSymbol(symbols[0]);
    }
  }, [symbols, selectedSymbol]);

  // Загрузка статуса бота при изменении символа
  useEffect(() => {
    if (selectedSymbol) {
      fetchBotStatus();
    }
  }, [selectedSymbol]);

  const handleSymbolChange = (event) => {
    setSelectedSymbol(event.target.value);
  };

  const handleTimeframeChange = (event) => {
    setTimeframe(event.target.value);
  };

  const handleStrategyChange = () => {
    // Обновляем статус бота после изменения стратегии
    fetchBotStatus();
  };

  const fetchBotStatus = async () => {
    try {
      setLoadingStatus(true);
      const response = await getBotStatus(selectedSymbol);
      setBotStatus(response);
    } catch (error) {
      console.error('Error fetching bot status:', error);
    } finally {
      setLoadingStatus(false);
    }
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
      // Обновляем статус бота
      fetchBotStatus();
    } catch (error) {
      console.error('Error starting bot:', error);
      alert(`Ошибка запуска бота: ${error.message || 'Неизвестная ошибка'}`);
    }
  };

  const handleStopBot = async () => {
    if (!selectedSymbol) {
      alert('Пожалуйста, выберите торговую пару');
      return;
    }
    
    try {
      await startBot(selectedSymbol);
      console.log('Bot stopped');
      alert(`Бот для ${selectedSymbol} успешно остановлен!`);
      // Обновляем статус бота
      fetchBotStatus();
    } catch (error) {
      console.error('Error stopping bot:', error);
      alert(`Ошибка остановки бота: ${error.message || 'Неизвестная ошибка'}`);
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
        <Typography variant="h4" gutterBottom>Торговый терминал</Typography>
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
        Торговый терминал
      </Typography>
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Символ</InputLabel>
            <Select
              value={selectedSymbol}
              onChange={handleSymbolChange}
              label="Символ"
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
                Рыночная информация
              </Typography>
              
              {loadingTicker ? (
                <Typography>Загрузка данных рынка...</Typography>
              ) : tickerError ? (
                <Typography color="error">Ошибка загрузки данных: {tickerError.message}</Typography>
              ) : ticker && ticker.data ? (
                <Box>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">Последняя цена</Typography>
                      <Typography variant="h5">{formatPrice(ticker.data?.last)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">Изменение за 24ч</Typography>
                      <Typography 
                        variant="h5" 
                        color={parseFloat(ticker.data?.change24h || 0) >= 0 ? 'success.main' : 'error.main'}
                      >
                        {(parseFloat(ticker.data?.change24h || 0) * 100).toFixed(2)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">Максимум 24ч</Typography>
                      <Typography variant="body1">{formatPrice(ticker.data?.high24h)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">Минимум 24ч</Typography>
                      <Typography variant="body1">{formatPrice(ticker.data?.low24h)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">Объем 24ч</Typography>
                      <Typography variant="body1">{parseFloat(ticker.data?.volume24h || 0).toFixed(2)}</Typography>
                    </Grid>
                    <Grid item xs={12} sx={{ mt: 2 }}>
                      <Button 
                        variant="contained" 
                        color="success"
                        fullWidth
                        sx={{ mb: 1 }}
                      >
                        Купить / Лонг
                      </Button>
                      <Button 
                        variant="contained" 
                        color="error"
                        fullWidth
                      >
                        Продать / Шорт
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              ) : (
                <Typography>Нет доступных рыночных данных.</Typography>
              )}

              <Box sx={{ flexGrow: 1 }} />
              
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                  Быстрые действия бота
                </Typography>
                {botStatus && botStatus.running ? (
                  <Button 
                    variant="outlined" 
                    color="error"
                    fullWidth
                    sx={{ mb: 1 }}
                    onClick={handleStopBot}
                  >
                    Остановить бота для {selectedSymbol}
                  </Button>
                ) : (
                  <Button 
                    variant="outlined" 
                    color="primary"
                    fullWidth
                    sx={{ mb: 1 }}
                    onClick={handleStartBot}
                  >
                    Запустить бота для {selectedSymbol}
                  </Button>
                )}
                <Button 
                  variant="outlined" 
                  color="secondary"
                  fullWidth
                  onClick={fetchBotStatus}
                  disabled={loadingStatus}
                >
                  {loadingStatus ? 'Загрузка...' : 'Обновить статус'}
                </Button>
              </Box>
            </Paper>
          </Grid>
          
          {/* Добавляем компонент для анализа рынка */}
          <Grid item xs={12}>
            <MarketAnalyzer 
              symbol={selectedSymbol} 
              onStrategyChange={handleStrategyChange} 
              refreshStats={fetchBotStatus}
            />
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default TradingView;
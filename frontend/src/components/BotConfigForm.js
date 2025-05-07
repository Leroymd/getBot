// frontend/src/components/BotConfigForm.js
// Обновленный код для загрузки фактических настроек бота

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem,
  Slider,
  Typography,
  FormControlLabel,
  Switch,
  Grid,
  CircularProgress,
  Alert
} from '@mui/material';
import { getBotConfig, getBotStatus } from '../services/botService';

const BotConfigForm = ({ symbol, initialConfig, onSubmit }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState({
    activeStrategy: 'AUTO',
    common: {
      enabled: true,
      leverage: 10,
      initialBalance: 100,
      reinvestment: 100
    },
    dca: {
      maxDCAOrders: 5,
      dcaPriceStep: 1.5,
      dcaMultiplier: 1.5,
      maxTradeDuration: 240,
      trailingStop: 0.5
    },
    scalping: {
      timeframe: '1m',
      profitTarget: 0.5,
      stopLoss: 0.3,
      maxTradeDuration: 30,
      minVolatility: 0.2,
      maxSpread: 0.1,
      useTrailingStop: true,
      trailingStopActivation: 0.2,
      trailingStopDistance: 0.1
    },
    autoSwitching: {
      enabled: true,
      volatilityThreshold: 1.5,
      volumeThreshold: 2.0,
      trendStrengthThreshold: 0.6
    }
  });

  // Получение конфигурации бота с обёрткой в useCallback
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      // Сначала проверяем, запущен ли бот, чтобы получить его текущие настройки
      const botStatus = await getBotStatus(symbol);
      let configData = null;
      
      // Если бот запущен, получаем его текущие настройки из статуса
      if (botStatus && botStatus.running) {
        console.log('Bot is running, fetching current settings from status');
        
        // Извлекаем конфигурацию из текущего статуса бота
        if (botStatus.config) {
          configData = botStatus.config;
          console.log('Got config from bot status:', configData);
        } else {
          console.log('Bot is running but no config in status, trying to get from database');
          const dbConfig = await getBotConfig(symbol);
          if (dbConfig) {
            configData = dbConfig;
            console.log('Got config from database:', configData);
          }
        }
      } else {
        // Если бот не запущен, получаем сохраненную конфигурацию из базы данных
        console.log('Bot is not running, fetching saved config');
        const dbConfig = await getBotConfig(symbol);
        if (dbConfig) {
          configData = dbConfig;
          console.log('Got config from database:', configData);
        }
      }
      
      // Если получили конфигурацию, используем ее
      if (configData) {
        setConfig(configData);
      } else if (initialConfig && initialConfig.recommendedStrategy) {
        // Если передана конфигурация с рекомендуемой стратегией, используем ее
        setConfig(prevConfig => ({
          ...prevConfig,
          activeStrategy: initialConfig.recommendedStrategy
        }));
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching configuration:', err);
      setError('Failed to load configuration: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [symbol, initialConfig]);

  // Загрузка конфигурации при монтировании компонента
  useEffect(() => {
    if (symbol) {
      fetchConfig();
    }
  }, [symbol, fetchConfig]);

  // Обработка изменения стратегии
  const handleStrategyChange = (event) => {
    setConfig(prevConfig => ({
      ...prevConfig,
      activeStrategy: event.target.value
    }));
  };

  // Обработка изменения полей
  const handleChange = (section, field) => (event) => {
    const { value, checked } = event.target;
    const newValue = event.target.type === 'checkbox' ? checked : value;
    
    setConfig(prevConfig => ({
      ...prevConfig,
      [section]: {
        ...prevConfig[section],
        [field]: newValue
      }
    }));
  };

  // Обработка изменения слайдеров
  const handleSliderChange = (section, field) => (event, value) => {
    setConfig(prevConfig => ({
      ...prevConfig,
      [section]: {
        ...prevConfig[section],
        [field]: value
      }
    }));
  };

  // Обработка отправки формы
  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(config);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Active Strategy</InputLabel>
            <Select
              value={config.activeStrategy}
              onChange={handleStrategyChange}
              label="Active Strategy"
            >
              <MenuItem value="AUTO">Automatic Selection</MenuItem>
              <MenuItem value="DCA">DCA (Dollar Cost Averaging)</MenuItem>
              <MenuItem value="SCALPING">Scalping</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Typography gutterBottom>
            Leverage: {config.common.leverage}x
          </Typography>
          <Slider
            value={config.common.leverage}
            onChange={handleSliderChange('common', 'leverage')}
            min={1}
            max={100}
            step={1}
            marks={[
              { value: 1, label: '1x' },
              { value: 25, label: '25x' },
              { value: 50, label: '50x' },
              { value: 75, label: '75x' },
              { value: 100, label: '100x' },
            ]}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom>
            General Settings
          </Typography>
          
          <TextField
            label="Initial Balance (USDT)"
            type="number"
            value={config.common.initialBalance}
            onChange={handleChange('common', 'initialBalance')}
            fullWidth
            sx={{ mb: 2 }}
          />
          
          <Typography gutterBottom>
            Reinvestment: {config.common.reinvestment}%
          </Typography>
          <Slider
            value={config.common.reinvestment}
            onChange={handleSliderChange('common', 'reinvestment')}
            min={0}
            max={100}
            step={10}
            marks={[
              { value: 0, label: '0%' },
              { value: 50, label: '50%' },
              { value: 100, label: '100%' },
            ]}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={config.common.enabled}
                onChange={handleChange('common', 'enabled')}
              />
            }
            label="Enable Bot"
            sx={{ mt: 2 }}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom>
            DCA Settings
          </Typography>
          
          <TextField
            label="Max DCA Orders"
            type="number"
            value={config.dca.maxDCAOrders}
            onChange={handleChange('dca', 'maxDCAOrders')}
            fullWidth
            sx={{ mb: 2 }}
          />
          
          <TextField
            label="DCA Price Step (%)"
            type="number"
            value={config.dca.dcaPriceStep}
            onChange={handleChange('dca', 'dcaPriceStep')}
            fullWidth
            sx={{ mb: 2 }}
          />
          
          <TextField
            label="Trailing Stop (%)"
            type="number"
            value={config.dca.trailingStop}
            onChange={handleChange('dca', 'trailingStop')}
            fullWidth
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom>
            Scalping Settings
          </Typography>
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Timeframe</InputLabel>
            <Select
              value={config.scalping.timeframe}
              onChange={handleChange('scalping', 'timeframe')}
              label="Timeframe"
            >
              <MenuItem value="1m">1 Minute</MenuItem>
              <MenuItem value="3m">3 Minutes</MenuItem>
              <MenuItem value="5m">5 Minutes</MenuItem>
              <MenuItem value="15m">15 Minutes</MenuItem>
              <MenuItem value="30m">30 Minutes</MenuItem>
              <MenuItem value="1h">1 Hour</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            label="Take Profit (%)"
            type="number"
            value={config.scalping.profitTarget}
            onChange={handleChange('scalping', 'profitTarget')}
            fullWidth
            sx={{ mb: 2 }}
          />
          
          <TextField
            label="Stop Loss (%)"
            type="number"
            value={config.scalping.stopLoss}
            onChange={handleChange('scalping', 'stopLoss')}
            fullWidth
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom>
            Auto-Switching
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={config.autoSwitching.enabled}
                onChange={handleChange('autoSwitching', 'enabled')}
              />
            }
            label="Enable Automatic Strategy Switching"
            sx={{ mb: 2, display: 'block' }}
          />
          
          <TextField
            label="Volatility Threshold (%)"
            type="number"
            value={config.autoSwitching.volatilityThreshold}
            onChange={handleChange('autoSwitching', 'volatilityThreshold')}
            fullWidth
            sx={{ mb: 2 }}
          />
          
          <TextField
            label="Trend Strength Threshold (0-1)"
            type="number"
            value={config.autoSwitching.trendStrengthThreshold}
            onChange={handleChange('autoSwitching', 'trendStrengthThreshold')}
            fullWidth
          />
        </Grid>
      </Grid>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          size="large"
        >
          Launch Bot
        </Button>
      </Box>
    </Box>
  );
};

export default BotConfigForm;
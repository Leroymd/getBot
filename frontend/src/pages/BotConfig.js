// frontend/src/pages/BotConfig.js
import React, { useState, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Slider from '@mui/material/Slider';
import useSymbols from '../hooks/useSymbols';
import { getBotConfig, updateBotConfig } from '../services/botService';

const BotConfig = () => {
  const [tab, setTab] = useState(0);
  const [savedAlert, setSaved] = useState(false);
  const { symbols, loading: loadingSymbols } = useSymbols();
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Структура конфигурации с поддержкой обеих стратегий
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

  // При изменении выбранного символа загружаем его конфигурацию
  useEffect(() => {
    if (selectedSymbol) {
      loadConfig(selectedSymbol);
    } else if (symbols && symbols.length > 0 && !selectedSymbol) {
      setSelectedSymbol(symbols[0]);
    }
  }, [selectedSymbol, symbols]);

  // Загрузка конфигурации с сервера
  const loadConfig = async (symbol) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getBotConfig(symbol);
      console.log('Loaded config:', response);
      if (response) {
        setConfig(response);
      }
    } catch (err) {
      console.error('Error loading config:', err);
      setError('Ошибка загрузки конфигурации: ' + (err.message || 'Неизвестная ошибка'));
    } finally {
      setLoading(false);
    }
  };

  // Обработка изменения вкладки
  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  // Обработка изменения выбранного символа
  const handleSymbolChange = (event) => {
    setSelectedSymbol(event.target.value);
  };

  // Обработка изменения полей формы
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

  // Обработка изменения выбора стратегии
  const handleStrategyChange = (event) => {
    setConfig(prevConfig => ({
      ...prevConfig,
      activeStrategy: event.target.value
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

  // Сохранение конфигурации
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSymbol) {
      setError('Необходимо выбрать символ');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await updateBotConfig(selectedSymbol, config);
      console.log('Configuration saved:', config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error saving config:', err);
      setError('Ошибка сохранения конфигурации: ' + (err.message || 'Неизвестная ошибка'));
    } finally {
      setLoading(false);
    }
  };

  // Сброс конфигурации к значениям по умолчанию
  const handleReset = () => {
    setConfig({
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
  };

  const TabPanel = ({ children, value, index }) => {
    return (
      <div role="tabpanel" hidden={value !== index}>
        {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
      </div>
    );
  };

  if (loadingSymbols) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Typography>Загрузка символов...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Конфигурация бота
      </Typography>
      
      {savedAlert && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Конфигурация успешно сохранена!
        </Alert>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Символ</InputLabel>
                <Select
                  value={selectedSymbol}
                  onChange={handleSymbolChange}
                  label="Символ"
                  disabled={loading}
                >
                  {Array.isArray(symbols) && symbols.map((symbol) => (
                    <MenuItem key={symbol} value={symbol}>{symbol}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Активная стратегия</InputLabel>
                <Select
                  value={config.activeStrategy}
                  onChange={handleStrategyChange}
                  label="Активная стратегия"
                >
                  <MenuItem value="AUTO">Автоматический выбор</MenuItem>
                  <MenuItem value="DCA">DCA (Dollar Cost Averaging)</MenuItem>
                  <MenuItem value="SCALPING">Скальпинг</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          
          <Tabs value={tab} onChange={handleTabChange} aria-label="strategy tabs">
            <Tab label="Общие настройки" />
            <Tab label="DCA Стратегия" />
            <Tab label="Скальпинг стратегия" />
            <Tab label="Автопереключение" />
          </Tabs>
          
          {/* Общие настройки */}
          <TabPanel value={tab} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography gutterBottom>
                  Плечо: {config.common.leverage}x
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
                <TextField
                  label="Начальный баланс (USDT)"
                  type="number"
                  value={config.common.initialBalance}
                  onChange={handleChange('common', 'initialBalance')}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography gutterBottom>
                  Реинвестирование: {config.common.reinvestment}%
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
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.common.enabled}
                      onChange={handleChange('common', 'enabled')}
                    />
                  }
                  label="Включить бота"
                />
              </Grid>
            </Grid>
          </TabPanel>
          
          {/* DCA Стратегия */}
          <TabPanel value={tab} index={1}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Настройки DCA (Dollar Cost Averaging)
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  DCA стратегия постепенно увеличивает позицию при движении цены против вашей позиции, снижая среднюю цену входа.
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <TextField
                  label="Макс. кол-во DCA ордеров"
                  type="number"
                  value={config.dca.maxDCAOrders}
                  onChange={handleChange('dca', 'maxDCAOrders')}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12} md={4}>
                <TextField
                  label="Шаг цены DCA (%)"
                  type="number"
                  value={config.dca.dcaPriceStep}
                  onChange={handleChange('dca', 'dcaPriceStep')}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12} md={4}>
                <TextField
                  label="Множитель размера DCA"
                  type="number"
                  value={config.dca.dcaMultiplier}
                  onChange={handleChange('dca', 'dcaMultiplier')}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Макс. длительность сделки (минут)"
                  type="number"
                  value={config.dca.maxTradeDuration}
                  onChange={handleChange('dca', 'maxTradeDuration')}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Trailing Stop (%)"
                  type="number"
                  value={config.dca.trailingStop}
                  onChange={handleChange('dca', 'trailingStop')}
                  fullWidth
                />
              </Grid>
            </Grid>
          </TabPanel>
          
          {/* Скальпинг стратегия */}
          <TabPanel value={tab} index={2}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Настройки скальпинга
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Скальпинг стратегия нацелена на получение небольшой прибыли от краткосрочных движений рынка.
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Таймфрейм</InputLabel>
                  <Select
                    value={config.scalping.timeframe}
                    onChange={handleChange('scalping', 'timeframe')}
                    label="Таймфрейм"
                  >
                    <MenuItem value="1m">1 Минута</MenuItem>
                    <MenuItem value="3m">3 Минуты</MenuItem>
                    <MenuItem value="5m">5 Минут</MenuItem>
                    <MenuItem value="15m">15 Минут</MenuItem>
                    <MenuItem value="30m">30 Минут</MenuItem>
                    <MenuItem value="1h">1 Час</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <TextField
                  label="Take Profit (%)"
                  type="number"
                  value={config.scalping.profitTarget}
                  onChange={handleChange('scalping', 'profitTarget')}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12} md={4}>
                <TextField
                  label="Stop Loss (%)"
                  type="number"
                  value={config.scalping.stopLoss}
                  onChange={handleChange('scalping', 'stopLoss')}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Макс. длительность сделки (минут)"
                  type="number"
                  value={config.scalping.maxTradeDuration}
                  onChange={handleChange('scalping', 'maxTradeDuration')}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Мин. волатильность (%)"
                  type="number"
                  value={config.scalping.minVolatility}
                  onChange={handleChange('scalping', 'minVolatility')}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Макс. спред (%)"
                  type="number"
                  value={config.scalping.maxSpread}
                  onChange={handleChange('scalping', 'maxSpread')}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.scalping.useTrailingStop}
                      onChange={handleChange('scalping', 'useTrailingStop')}
                    />
                  }
                  label="Использовать Trailing Stop"
                />
              </Grid>
              
              {config.scalping.useTrailingStop && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Активация Trailing Stop (%)"
                      type="number"
                      value={config.scalping.trailingStopActivation}
                      onChange={handleChange('scalping', 'trailingStopActivation')}
                      fullWidth
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Дистанция Trailing Stop (%)"
                      type="number"
                      value={config.scalping.trailingStopDistance}
                      onChange={handleChange('scalping', 'trailingStopDistance')}
                      fullWidth
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </TabPanel>
          
          {/* Настройки автопереключения */}
          <TabPanel value={tab} index={3}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Настройки автоматического переключения стратегий
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Эти настройки определяют, как бот будет выбирать между DCA и скальпинг стратегиями в режиме AUTO.
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.autoSwitching.enabled}
                      onChange={handleChange('autoSwitching', 'enabled')}
                    />
                  }
                  label="Включить автоматическое переключение"
                />
              </Grid>
              
              <Grid item xs={12} md={4}>
                <TextField
                  label="Порог волатильности (%)"
                  type="number"
                  value={config.autoSwitching.volatilityThreshold}
                  onChange={handleChange('autoSwitching', 'volatilityThreshold')}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12} md={4}>
                <TextField
                  label="Порог объема (множитель)"
                  type="number"
                  value={config.autoSwitching.volumeThreshold}
                  onChange={handleChange('autoSwitching', 'volumeThreshold')}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12} md={4}>
                <TextField
                  label="Порог силы тренда (0-1)"
                  type="number"
                  value={config.autoSwitching.trendStrengthThreshold}
                  onChange={handleChange('autoSwitching', 'trendStrengthThreshold')}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="body2" color="textSecondary">
                  <b>Пояснение:</b> Бот выберет стратегию скальпинга при высокой волатильности и объеме, а стратегию DCA - при устойчивом тренде с умеренной волатильностью.
                </Typography>
              </Grid>
            </Grid>
          </TabPanel>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button 
              variant="outlined" 
              onClick={handleReset}
              disabled={loading}
            >
              Сбросить
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary"
              disabled={loading}
            >
              Сохранить конфигурацию
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default BotConfig;
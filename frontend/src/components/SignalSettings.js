// frontend/src/components/SignalSettings.js
import React, { useState, useEffect } from 'react';
import { 
  Container, Grid, Card, CardHeader, CardContent, 
  TextField, Slider, Switch, Button, FormControlLabel, 
  Typography, Tabs, Tab, Box, Divider, Alert, CircularProgress,
  Select, MenuItem, FormControl, InputLabel, Chip
} from '@mui/material';
import { getSignalSettings, updateSignalSettings, getRecommendedSettings } from '../services/signalService';
import { scanPairs } from '../services/botService';

// Вкладка для общих настроек
function GeneralSettings({ settings, onChange }) {
  return (
    <div>
      <Typography variant="h6" gutterBottom>
        Общие настройки сигналов
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Typography gutterBottom>
            Чувствительность к сигналам: {settings.general.sensitivity}%
          </Typography>
          <Slider
            value={settings.general.sensitivity}
            min={0}
            max={100}
            step={1}
            onChange={(e, value) => onChange('general.sensitivity', value)}
            valueLabelDisplay="auto"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label="Минимальная волатильность (%)"
            type="number"
            inputProps={{ step: 0.1, min: 0 }}
            value={settings.general.minVolatility}
            onChange={(e) => onChange('general.minVolatility', parseFloat(e.target.value))}
            fullWidth
            margin="normal"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label="Максимальная волатильность (%)"
            type="number"
            inputProps={{ step: 0.1, min: 0 }}
            value={settings.general.maxVolatility}
            onChange={(e) => onChange('general.maxVolatility', parseFloat(e.target.value))}
            fullWidth
            margin="normal"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label="Минимальный объем ($)"
            type="number"
            inputProps={{ step: 1000, min: 0 }}
            value={settings.general.minVolume}
            onChange={(e) => onChange('general.minVolume', parseFloat(e.target.value))}
            fullWidth
            margin="normal"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label="Требуемые подтверждения"
            type="number"
            inputProps={{ step: 1, min: 1 }}
            value={settings.general.confirmationRequired}
            onChange={(e) => onChange('general.confirmationRequired', parseInt(e.target.value))}
            fullWidth
            margin="normal"
          />
        </Grid>
      </Grid>
    </div>
  );
}

// Вкладка для настроек индикаторов
function IndicatorSettings({ settings, onChange }) {
  return (
    <div>
      <Typography variant="h6" gutterBottom>
        Настройки индикаторов
      </Typography>

      <Card style={{ marginBottom: 20 }}>
        <CardHeader title="RSI" />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.indicators.rsi.enabled}
                    onChange={(e) => onChange('indicators.rsi.enabled', e.target.checked)}
                    color="primary"
                  />
                }
                label="Использовать RSI"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Период"
                type="number"
                inputProps={{ step: 1, min: 1 }}
                value={settings.indicators.rsi.period}
                onChange={(e) => onChange('indicators.rsi.period', parseInt(e.target.value))}
                fullWidth
                disabled={!settings.indicators.rsi.enabled}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Перекупленность"
                type="number"
                inputProps={{ step: 1, min: 50, max: 100 }}
                value={settings.indicators.rsi.overbought}
                onChange={(e) => onChange('indicators.rsi.overbought', parseInt(e.target.value))}
                fullWidth
                disabled={!settings.indicators.rsi.enabled}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Перепроданность"
                type="number"
                inputProps={{ step: 1, min: 0, max: 50 }}
                value={settings.indicators.rsi.oversold}
                onChange={(e) => onChange('indicators.rsi.oversold', parseInt(e.target.value))}
                fullWidth
                disabled={!settings.indicators.rsi.enabled}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography gutterBottom>
                Вес: {settings.indicators.rsi.weight}
              </Typography>
              <Slider
                value={settings.indicators.rsi.weight}
                min={0.1}
                max={10}
                step={0.1}
                onChange={(e, value) => onChange('indicators.rsi.weight', value)}
                valueLabelDisplay="auto"
                disabled={!settings.indicators.rsi.enabled}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <CardHeader title="MACD" />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.indicators.macd.enabled}
                    onChange={(e) => onChange('indicators.macd.enabled', e.target.checked)}
                    color="primary"
                  />
                }
                label="Использовать MACD"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Быстрый период"
                type="number"
                inputProps={{ step: 1, min: 1 }}
                value={settings.indicators.macd.fastPeriod}
                onChange={(e) => onChange('indicators.macd.fastPeriod', parseInt(e.target.value))}
                fullWidth
                disabled={!settings.indicators.macd.enabled}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Медленный период"
                type="number"
                inputProps={{ step: 1, min: 1 }}
                value={settings.indicators.macd.slowPeriod}
                onChange={(e) => onChange('indicators.macd.slowPeriod', parseInt(e.target.value))}
                fullWidth
                disabled={!settings.indicators.macd.enabled}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Сигнальный период"
                type="number"
                inputProps={{ step: 1, min: 1 }}
                value={settings.indicators.macd.signalPeriod}
                onChange={(e) => onChange('indicators.macd.signalPeriod', parseInt(e.target.value))}
                fullWidth
                disabled={!settings.indicators.macd.enabled}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography gutterBottom>
                Вес: {settings.indicators.macd.weight}
              </Typography>
              <Slider
                value={settings.indicators.macd.weight}
                min={0.1}
                max={10}
                step={0.1}
                onChange={(e, value) => onChange('indicators.macd.weight', value)}
                valueLabelDisplay="auto"
                disabled={!settings.indicators.macd.enabled}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <CardHeader title="Bollinger Bands" />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.indicators.bollinger.enabled}
                    onChange={(e) => onChange('indicators.bollinger.enabled', e.target.checked)}
                    color="primary"
                  />
                }
                label="Использовать Bollinger Bands"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Период"
                type="number"
                inputProps={{ step: 1, min: 1 }}
                value={settings.indicators.bollinger.period}
                onChange={(e) => onChange('indicators.bollinger.period', parseInt(e.target.value))}
                fullWidth
                disabled={!settings.indicators.bollinger.enabled}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Стандартное отклонение"
                type="number"
                inputProps={{ step: 0.1, min: 0.1 }}
                value={settings.indicators.bollinger.deviation}
                onChange={(e) => onChange('indicators.bollinger.deviation', parseFloat(e.target.value))}
                fullWidth
                disabled={!settings.indicators.bollinger.enabled}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography gutterBottom>
                Вес: {settings.indicators.bollinger.weight}
              </Typography>
              <Slider
                value={settings.indicators.bollinger.weight}
                min={0.1}
                max={10}
                step={0.1}
                onChange={(e, value) => onChange('indicators.bollinger.weight', value)}
                valueLabelDisplay="auto"
                disabled={!settings.indicators.bollinger.enabled}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Moving Average" />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.indicators.ma.enabled}
                    onChange={(e) => onChange('indicators.ma.enabled', e.target.checked)}
                    color="primary"
                  />
                }
                label="Использовать Moving Average"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Быстрый период"
                type="number"
                inputProps={{ step: 1, min: 1 }}
                value={settings.indicators.ma.fastPeriod}
                onChange={(e) => onChange('indicators.ma.fastPeriod', parseInt(e.target.value))}
                fullWidth
                disabled={!settings.indicators.ma.enabled}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Медленный период"
                type="number"
                inputProps={{ step: 1, min: 1 }}
                value={settings.indicators.ma.slowPeriod}
                onChange={(e) => onChange('indicators.ma.slowPeriod', parseInt(e.target.value))}
                fullWidth
                disabled={!settings.indicators.ma.enabled}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={!settings.indicators.ma.enabled}>
                <InputLabel id="ma-type-label">Тип MA</InputLabel>
                <Select
                  labelId="ma-type-label"
                  value={settings.indicators.ma.type}
                  onChange={(e) => onChange('indicators.ma.type', e.target.value)}
                  label="Тип MA"
                >
                  <MenuItem value="SMA">SMA</MenuItem>
                  <MenuItem value="EMA">EMA</MenuItem>
                  <MenuItem value="WMA">WMA</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography gutterBottom>
                Вес: {settings.indicators.ma.weight}
              </Typography>
              <Slider
                value={settings.indicators.ma.weight}
                min={0.1}
                max={10}
                step={0.1}
                onChange={(e, value) => onChange('indicators.ma.weight', value)}
                valueLabelDisplay="auto"
                disabled={!settings.indicators.ma.enabled}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </div>
  );
}

// Вкладка для настроек входа в позицию
function EntryConditionSettings({ settings, onChange }) {
  return (
    <div>
      <Typography variant="h6" gutterBottom>
        Настройки входа в позицию
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.entryConditions.useTrendDetection}
                onChange={(e) => onChange('entryConditions.useTrendDetection', e.target.checked)}
                color="primary"
              />
            }
            label="Использовать определение тренда"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography gutterBottom>
            Минимальная сила тренда: {settings.entryConditions.minTrendStrength}
          </Typography>
          <Slider
            value={settings.entryConditions.minTrendStrength}
            min={0}
            max={1}
            step={0.01}
            onChange={(e, value) => onChange('entryConditions.minTrendStrength', value)}
            valueLabelDisplay="auto"
            disabled={!settings.entryConditions.useTrendDetection}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.entryConditions.allowCounterTrend}
                onChange={(e) => onChange('entryConditions.allowCounterTrend', e.target.checked)}
                color="primary"
              />
            }
            label="Разрешить торговлю против тренда"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.entryConditions.requireVolumeConfirmation}
                onChange={(e) => onChange('entryConditions.requireVolumeConfirmation', e.target.checked)}
                color="primary"
              />
            }
            label="Требовать подтверждения объемом"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label="Мин. соотношение объема"
            type="number"
            inputProps={{ step: 0.1, min: 0 }}
            value={settings.entryConditions.minVolumeRatio}
            onChange={(e) => onChange('entryConditions.minVolumeRatio', parseFloat(e.target.value))}
            fullWidth
            disabled={!settings.entryConditions.requireVolumeConfirmation}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.entryConditions.allowDuringNews}
                onChange={(e) => onChange('entryConditions.allowDuringNews', e.target.checked)}
                color="primary"
              />
            }
            label="Разрешить торговлю во время новостей"
          />
        </Grid>
      </Grid>
    </div>
  );
}

// Вкладка для настроек выхода из позиции
function ExitConditionSettings({ settings, onChange }) {
  return (
    <div>
      <Typography variant="h6" gutterBottom>
        Настройки выхода из позиции
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.exitConditions.useTrailingStop}
                onChange={(e) => onChange('exitConditions.useTrailingStop', e.target.checked)}
                color="primary"
              />
            }
            label="Использовать трейлинг-стоп"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label="Активация трейлинг-стопа (%)"
            type="number"
            inputProps={{ step: 0.1, min: 0 }}
            value={settings.exitConditions.trailingStopActivation}
            onChange={(e) => onChange('exitConditions.trailingStopActivation', parseFloat(e.target.value))}
            fullWidth
            disabled={!settings.exitConditions.useTrailingStop}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label="Дистанция трейлинг-стопа (%)"
            type="number"
            inputProps={{ step: 0.1, min: 0 }}
            value={settings.exitConditions.trailingStopDistance}
            onChange={(e) => onChange('exitConditions.trailingStopDistance', parseFloat(e.target.value))}
            fullWidth
            disabled={!settings.exitConditions.useTrailingStop}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label="Макс. длительность сделки (мин)"
            type="number"
            inputProps={{ step: 1, min: 1 }}
            value={settings.exitConditions.maxTradeDuration}
            onChange={(e) => onChange('exitConditions.maxTradeDuration', parseInt(e.target.value))}
            fullWidth
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.exitConditions.closeOnReversalSignal}
                onChange={(e) => onChange('exitConditions.closeOnReversalSignal', e.target.checked)}
                color="primary"
              />
            }
            label="Закрывать при разворотном сигнале"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.exitConditions.closeOnWeakTrend}
                onChange={(e) => onChange('exitConditions.closeOnWeakTrend', e.target.checked)}
                color="primary"
              />
            }
            label="Закрывать при ослаблении тренда"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label="Мин. прибыль для закрытия (%)"
            type="number"
            inputProps={{ step: 0.1, min: 0 }}
            value={settings.exitConditions.minProfitToClose}
            onChange={(e) => onChange('exitConditions.minProfitToClose', parseFloat(e.target.value))}
            fullWidth
          />
        </Grid>
      </Grid>
    </div>
  );
}

// Вкладка для настроек фильтрации рынка
function MarketFilterSettings({ settings, onChange }) {
  return (
    <div>
      <Typography variant="h6" gutterBottom>
        Фильтры рыночных условий
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.marketFilters.avoidHighVolatility}
                onChange={(e) => onChange('marketFilters.avoidHighVolatility', e.target.checked)}
                color="primary"
              />
            }
            label="Избегать торговли при высокой волатильности"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.marketFilters.avoidLowLiquidity}
                onChange={(e) => onChange('marketFilters.avoidLowLiquidity', e.target.checked)}
                color="primary"
              />
            }
            label="Избегать торговли при низкой ликвидности"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.marketFilters.considerMarketTrend}
                onChange={(e) => onChange('marketFilters.considerMarketTrend', e.target.checked)}
                color="primary"
              />
            }
            label="Учитывать общий тренд рынка (BTC)"
          />
        </Grid>

        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel id="preferred-market-types-label">Предпочтительные типы рынка</InputLabel>
            <Select
              labelId="preferred-market-types-label"
              multiple
              value={settings.marketFilters.preferredMarketTypes}
              onChange={(e) => onChange('marketFilters.preferredMarketTypes', e.target.value)}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} />
                  ))}
                </Box>
              )}
            >
              <MenuItem value="TRENDING">Трендовый</MenuItem>
              <MenuItem value="RANGING">Боковой</MenuItem>
              <MenuItem value="VOLATILE">Волатильный</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </div>
  );
}

// Вкладка для настроек стратегий
function StrategySpecificSettings({ settings, onChange }) {
  return (
    <div>
      <Typography variant="h6" gutterBottom>
        Настройки стратегий
      </Typography>

      <Card style={{ marginBottom: 20 }}>
        <CardHeader title="DCA (Dollar Cost Averaging)" />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Шаг цены для DCA (%)"
                type="number"
                inputProps={{ step: 0.1, min: 0.1 }}
                value={settings.strategySpecific.dca.priceStep}
                onChange={(e) => onChange('strategySpecific.dca.priceStep', parseFloat(e.target.value))}
                fullWidth
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Множитель размера ордера"
                type="number"
                inputProps={{ step: 0.1, min: 1 }}
                value={settings.strategySpecific.dca.sizeMultiplier}
                onChange={(e) => onChange('strategySpecific.dca.sizeMultiplier', parseFloat(e.target.value))}
                fullWidth
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Макс. количество DCA ордеров"
                type="number"
                inputProps={{ step: 1, min: 1 }}
                value={settings.strategySpecific.dca.maxOrders}
                onChange={(e) => onChange('strategySpecific.dca.maxOrders', parseInt(e.target.value))}
                fullWidth
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.strategySpecific.dca.useProgressiveStep}
                    onChange={(e) => onChange('strategySpecific.dca.useProgressiveStep', e.target.checked)}
                    color="primary"
                  />
                }
                label="Использовать прогрессивный шаг цены"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Scalping" />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Целевая прибыль (%)"
                type="number"
                inputProps={{ step: 0.1, min: 0.1 }}
                value={settings.strategySpecific.scalping.profitTarget}
                onChange={(e) => onChange('strategySpecific.scalping.profitTarget', parseFloat(e.target.value))}
                fullWidth
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Стоп-лосс (%)"
                type="number"
                inputProps={{ step: 0.1, min: 0.1 }}
                value={settings.strategySpecific.scalping.stopLoss}
                onChange={(e) => onChange('strategySpecific.scalping.stopLoss', parseFloat(e.target.value))}
                fullWidth
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Максимальный спред (%)"
                type="number"
                inputProps={{ step: 0.01, min: 0 }}
                value={settings.strategySpecific.scalping.maxSpread}
                onChange={(e) => onChange('strategySpecific.scalping.maxSpread', parseFloat(e.target.value))}
                fullWidth
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.strategySpecific.scalping.requireMomentum}
                    onChange={(e) => onChange('strategySpecific.scalping.requireMomentum', e.target.checked)}
                    color="primary"
                  />
                }
                label="Требовать импульс цены"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </div>
  );
}

// Компонент настроек производительности
function PerformanceSettings({ settings, onChange }) {
  return (
    <div>
      <Typography variant="h6" gutterBottom>
        Настройки мониторинга производительности
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.performance.enableAdaptiveSettings}
                onChange={(e) => onChange('performance.enableAdaptiveSettings', e.target.checked)}
                color="primary"
              />
            }
            label="Включить адаптивные настройки"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label="Период для анализа (дни)"
            type="number"
            inputProps={{ step: 1, min: 1 }}
            value={settings.performance.analysisPeriod}
            onChange={(e) => onChange('performance.analysisPeriod', parseInt(e.target.value))}
            fullWidth
            disabled={!settings.performance.enableAdaptiveSettings}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label="Мин. количество сделок для адаптации"
            type="number"
            inputProps={{ step: 1, min: 5 }}
            value={settings.performance.minTradesForAdaptation}
            onChange={(e) => onChange('performance.minTradesForAdaptation', parseInt(e.target.value))}
            fullWidth
            disabled={!settings.performance.enableAdaptiveSettings}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography gutterBottom>
            Макс. изменение параметров (%): {settings.performance.maxParameterChange}
          </Typography>
          <Slider
            value={settings.performance.maxParameterChange}
            min={5}
            max={50}
            step={1}
            onChange={(e, value) => onChange('performance.maxParameterChange', value)}
            valueLabelDisplay="auto"
            disabled={!settings.performance.enableAdaptiveSettings}
          />
        </Grid>
      </Grid>
    </div>
  );
}

// Утилита для обновления вложенных свойств
function updateNestedProperty(obj, path, value) {
  const parts = path.split('.');
  let current = { ...obj };
  let currentObj = current;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    currentObj[part] = { ...currentObj[part] };
    currentObj = currentObj[part];
  }

  currentObj[parts[parts.length - 1]] = value;
  return current;
}

// Основной компонент настроек сигналов
function SignalSettings({ symbol }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [pairs, setPairs] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState(symbol || 'BTCUSDT');

  useEffect(() => {
    // Загрузка списка доступных пар
    const loadPairs = async () => {
      try {
        const result = await scanPairs();
        if (result && result.results) {
          const pairList = result.results.map(pair => pair.symbol);
          setPairs(pairList);
        }
      } catch (err) {
        console.error('Error loading pairs:', err);
      }
    };

    loadPairs();
  }, []);

  useEffect(() => {
    // Загрузка настроек при изменении символа
    const loadSettings = async () => {
      setLoading(true);
      try {
        const result = await getSignalSettings(selectedSymbol);
        setSettings(result);
        setError(null);
      } catch (err) {
        console.error('Error loading signal settings:', err);
        setError('Ошибка загрузки настроек сигналов. Пожалуйста, попробуйте позже.');
      } finally {
        setLoading(false);
      }
    };

    if (selectedSymbol) {
      loadSettings();
    }
  }, [selectedSymbol]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleSettingChange = (path, value) => {
    setSettings(prev => updateNestedProperty(prev, path, value));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSignalSettings(selectedSymbol, settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving signal settings:', err);
      setError('Ошибка сохранения настроек. Пожалуйста, попробуйте позже.');
    } finally {
      setSaving(false);
    }
  };

  const loadRecommendedSettings = async () => {
    setLoading(true);
    try {
      const result = await getRecommendedSettings(selectedSymbol);
      if (result && result.recommendedSettings) {
        setSettings(result.recommendedSettings);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error loading recommended settings:', err);
      setError('Ошибка загрузки рекомендуемых настроек. Пожалуйста, попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !settings) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container>
      <Typography variant="h4" gutterBottom>
        Настройки анализа сигналов
      </Typography>

      {error && (
        <Alert severity="error" style={{ marginBottom: 20 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" style={{ marginBottom: 20 }}>
          Настройки успешно сохранены
        </Alert>
      )}

      <Grid container spacing={3} style={{ marginBottom: 20 }}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel id="symbol-select-label">Торговая пара</InputLabel>
            <Select
              labelId="symbol-select-label"
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              label="Торговая пара"
            >
              {pairs.map((pair) => (
                <MenuItem key={pair} value={pair}>{pair}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box display="flex" justifyContent="space-between">
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <CircularProgress size={24} /> : 'Сохранить настройки'}
            </Button>
            
            <Button
              variant="outlined"
              color="secondary"
              onClick={loadRecommendedSettings}
              disabled={loading}
            >
              Загрузить рекомендуемые
            </Button>
          </Box>
        </Grid>
      </Grid>

      <Box sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="signal settings tabs">
            <Tab label="Общие" />
            <Tab label="Индикаторы" />
            <Tab label="Вход" />
            <Tab label="Выход" />
            <Tab label="Фильтры рынка" />
            <Tab label="Стратегии" />
            <Tab label="Производительность" />
          </Tabs>
        </Box>
        
        <Box sx={{ padding: 2 }}>
          {activeTab === 0 && settings && (
            <GeneralSettings settings={settings} onChange={handleSettingChange} />
          )}
          {activeTab === 1 && settings && (
            <IndicatorSettings settings={settings} onChange={handleSettingChange} />
          )}
          {activeTab === 2 && settings && (
            <EntryConditionSettings settings={settings} onChange={handleSettingChange} />
          )}
          {activeTab === 3 && settings && (
            <ExitConditionSettings settings={settings} onChange={handleSettingChange} />
          )}
          {activeTab === 4 && settings && (
            <MarketFilterSettings settings={settings} onChange={handleSettingChange} />
          )}
          {activeTab === 5 && settings && (
            <StrategySpecificSettings settings={settings} onChange={handleSettingChange} />
          )}
          {activeTab === 6 && settings && (
            <PerformanceSettings settings={settings} onChange={handleSettingChange} />
          )}
        </Box>
      </Box>
    </Container>
  );
}

export default SignalSettings;
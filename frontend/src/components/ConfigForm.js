// frontend/src/components/ConfigForm.js
import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { getBotConfig, updateBotConfig } from '../services/botService';
import { Slider } from '@mui/material';

const ConfigForm = ({ symbol, onConfigChange }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { control, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      timeframe: '1m',
      leverage: 10,
      initialBalance: 100,
      trailingStop: 0.5,
      maxDCAOrders: 5,
      dcaPriceStep: 1.5,
      dcaMultiplier: 1.5,
      maxTradeDuration: 5,
      reinvestment: 100,
      enabled: true
    }
  });

  // Загрузка конфигурации при монтировании
  useEffect(() => {
    const loadConfig = async () => {
      if (!symbol) return;
      
      setLoading(true);
      try {
        const config = await getBotConfig(symbol);
        if (config) {
          // Установка значений формы
          Object.entries(config).forEach(([key, value]) => {
            setValue(key, value);
          });
        }
      } catch (error) {
        console.error('Error loading bot config:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [symbol, setValue]);

  const onSubmit = async (data) => {
    if (!symbol) return;
    
    setSaving(true);
    try {
      await updateBotConfig(symbol, data);
      if (onConfigChange) {
        onConfigChange(data);
      }
    } catch (error) {
      console.error('Error saving bot config:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    reset();
  };

  const currentLeverage = watch('leverage');
  const currentReinvestment = watch('reinvestment');

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          Bot Configuration for {symbol}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Controller
                name="timeframe"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Timeframe</InputLabel>
                    <Select {...field} label="Timeframe">
                      <MenuItem value="1m">1 Minute</MenuItem>
                      <MenuItem value="3m">3 Minutes</MenuItem>
                      <MenuItem value="5m">5 Minutes</MenuItem>
                      <MenuItem value="15m">15 Minutes</MenuItem>
                      <MenuItem value="30m">30 Minutes</MenuItem>
                      <MenuItem value="1h">1 Hour</MenuItem>
                      <MenuItem value="4h">4 Hours</MenuItem>
                      <MenuItem value="1d">1 Day</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Controller
                name="initialBalance"
                control={control}
                rules={{ required: true, min: 1 }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Initial Balance (USDT)"
                    variant="outlined"
                    type="number"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error ? 'Required, minimum 1 USDT' : ''}
                    InputProps={{
                      endAdornment: <Typography variant="body2">USDT</Typography>,
                    }}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Leverage: {currentLeverage}x
              </Typography>
              <Controller
                name="leverage"
                control={control}
                render={({ field }) => (
                  <Slider
                    {...field}
                    min={1}
                    max={100}
                    step={1}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 1, label: '1x' },
                      { value: 20, label: '20x' },
                      { value: 50, label: '50x' },
                      { value: 100, label: '100x' },
                    ]}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Controller
                name="trailingStop"
                control={control}
                rules={{ required: true, min: 0.1 }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Trailing Stop (%)"
                    variant="outlined"
                    type="number"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error ? 'Required, minimum 0.1%' : ''}
                    InputProps={{
                      endAdornment: <Typography variant="body2">%</Typography>,
                    }}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                DCA Settings
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Controller
                name="maxDCAOrders"
                control={control}
                rules={{ required: true, min: 0, max: 10 }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Max DCA Orders"
                    variant="outlined"
                    type="number"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error ? 'Required, 0-10' : ''}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Controller
                name="dcaPriceStep"
                control={control}
                rules={{ required: true, min: 0.1 }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="DCA Price Step (%)"
                    variant="outlined"
                    type="number"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error ? 'Required, minimum 0.1%' : ''}
                    InputProps={{
                      endAdornment: <Typography variant="body2">%</Typography>,
                    }}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Controller
                name="dcaMultiplier"
                control={control}
                rules={{ required: true, min: 1 }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="DCA Size Multiplier"
                    variant="outlined"
                    type="number"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error ? 'Required, minimum 1' : ''}
                    InputProps={{
                      endAdornment: <Typography variant="body2">x</Typography>,
                    }}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Trade Settings
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Controller
                name="maxTradeDuration"
                control={control}
                rules={{ required: true, min: 1 }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Max Trade Duration (minutes)"
                    variant="outlined"
                    type="number"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error ? 'Required, minimum 1 minute' : ''}
                    InputProps={{
                      endAdornment: <Typography variant="body2">min</Typography>,
                    }}
                  />
                )}
              />
            
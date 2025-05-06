import React, { useState } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Slider from '@mui/material/Slider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';

const BotConfig = () => {
  const [config, setConfig] = useState({
    symbol: 'BTCUSDT',
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
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig({ ...config, [name]: value });
  };

  const handleSliderChange = (name) => (e, value) => {
    setConfig({ ...config, [name]: value });
  };

  const handleSwitchChange = (name) => (e) => {
    setConfig({ ...config, [name]: e.target.checked });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Configuration submitted:', config);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Bot Configuration
      </Typography>
      
      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Symbol</InputLabel>
                <Select
                  name="symbol"
                  value={config.symbol}
                  onChange={handleChange}
                  label="Symbol"
                >
                  <MenuItem value="BTCUSDT">BTCUSDT</MenuItem>
                  <MenuItem value="ETHUSDT">ETHUSDT</MenuItem>
                  <MenuItem value="SOLUSDT">SOLUSDT</MenuItem>
                  <MenuItem value="AVAXUSDT">AVAXUSDT</MenuItem>
                  <MenuItem value="BNBUSDT">BNBUSDT</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Timeframe</InputLabel>
                <Select
                  name="timeframe"
                  value={config.timeframe}
                  onChange={handleChange}
                  label="Timeframe"
                >
                  <MenuItem value="1m">1 Minute</MenuItem>
                  <MenuItem value="5m">5 Minutes</MenuItem>
                  <MenuItem value="15m">15 Minutes</MenuItem>
                  <MenuItem value="1h">1 Hour</MenuItem>
                  <MenuItem value="4h">4 Hours</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <Typography gutterBottom>
                Leverage: {config.leverage}x
              </Typography>
              <Slider
                value={config.leverage}
                onChange={handleSliderChange('leverage')}
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
                name="initialBalance"
                label="Initial Balance (USDT)"
                type="number"
                value={config.initialBalance}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                name="trailingStop"
                label="Trailing Stop (%)"
                type="number"
                value={config.trailingStop}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                DCA Settings
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                name="maxDCAOrders"
                label="Max DCA Orders"
                type="number"
                value={config.maxDCAOrders}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                name="dcaPriceStep"
                label="DCA Price Step (%)"
                type="number"
                value={config.dcaPriceStep}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                name="dcaMultiplier"
                label="DCA Size Multiplier"
                type="number"
                value={config.dcaMultiplier}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Trade Settings
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                name="maxTradeDuration"
                label="Max Trade Duration (minutes)"
                type="number"
                value={config.maxTradeDuration}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography gutterBottom>
                Reinvestment: {config.reinvestment}%
              </Typography>
              <Slider
                value={config.reinvestment}
                onChange={handleSliderChange('reinvestment')}
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
                    checked={config.enabled}
                    onChange={handleSwitchChange('enabled')}
                  />
                }
                label="Enable Bot"
              />
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                <Button variant="outlined">
                  Reset
                </Button>
                <Button type="submit" variant="contained">
                  Save Configuration
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
};

export default BotConfig;
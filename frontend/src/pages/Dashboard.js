import React from 'react';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';

const Dashboard = () => {
  // Данные для ботов
  const botList = [
    { symbol: 'BTCUSDT', status: 'running', balance: 1243.12, pnl: 87.21, winRate: 51.2 },
    { symbol: 'ETHUSDT', status: 'running', balance: 865.34, pnl: 124.56, winRate: 54.6 },
    { symbol: 'SOLUSDT', status: 'stopped', balance: 532.89, pnl: -32.45, winRate: 48.3 },
    { symbol: 'AVAXUSDT', status: 'running', balance: 892.34, pnl: 203.45, winRate: 58.9 },
    { symbol: 'BNBUSDT', status: 'stopped', balance: 456.23, pnl: -18.87, winRate: 47.1 }
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Box sx={{ mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6} lg={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6">Total Balance</Typography>
              <Typography variant="h4">3,989.92 USDT</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6">Total PnL</Typography>
              <Typography variant="h4" color="success.main">+363.90 USDT</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6">Win Rate</Typography>
              <Typography variant="h4">52.7%</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6">Active Bots</Typography>
              <Typography variant="h4">3 / 5</Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
      
      <Typography variant="h5" gutterBottom>
        Active Bots
      </Typography>
      
      <Grid container spacing={3}>
        {botList.map((bot, index) => (
          <Grid item xs={12} md={6} lg={4} key={index}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">{bot.symbol}</Typography>
                <Box 
                  sx={{ 
                    bgcolor: bot.status === 'running' ? 'success.main' : 'error.main',
                    color: 'white',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '0.75rem'
                  }}
                >
                  {bot.status.toUpperCase()}
                </Box>
              </Box>
              
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Balance</Typography>
                  <Typography variant="body1">{bot.balance.toFixed(2)} USDT</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">PnL</Typography>
                  <Typography 
                    variant="body1" 
                    color={bot.pnl >= 0 ? 'success.main' : 'error.main'}
                  >
                    {bot.pnl >= 0 ? '+' : ''}{bot.pnl.toFixed(2)} USDT
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Win Rate</Typography>
                  <Typography variant="body1">{bot.winRate.toFixed(1)}%</Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Dashboard;
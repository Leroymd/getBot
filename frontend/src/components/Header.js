import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AccountCircle from '@mui/icons-material/AccountCircle';
import MenuIcon from '@mui/icons-material/Menu';
import Box from '@mui/material/Box';
import useAccountBalance from '../hooks/useAccountBalance';

// Исправление для компонента Header.js
const Header = () => {
  const { balance, loading } = useAccountBalance();

  // Функция для отображения баланса с учетом новой структуры ответа API
  const getBalanceDisplay = () => {
    if (loading) return "Loading...";
    
    // Проверяем, что баланс получен и имеет правильную структуру
    if (balance && balance.data && Array.isArray(balance.data) && balance.data.length > 0) {
      // Используем available из первого элемента массива data
      return parseFloat(balance.data[0].available).toFixed(2) + " USDT";
    } else if (balance && balance.data && balance.data.totalAvailableMargin) {
      // Для совместимости со старым форматом
      return parseFloat(balance.data.totalAvailableMargin).toFixed(2) + " USDT";
    } else {
      return "0.00 USDT";
    }
  };

  return (
    <AppBar position="fixed" color="primary" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          sx={{ mr: 2, display: { sm: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          BitGet Trading Bot
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
          <Typography variant="body1" sx={{ mr: 1 }}>
            Balance:
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
            {getBalanceDisplay()}
          </Typography>
        </Box>
        
        {/* ... остальной код ... */}
      </Toolbar>
    </AppBar>
  );
};

 

export default Header;
// frontend/src/components/StrategyStats.js
import React from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Grid, 
  Chip, 
  Divider,
  LinearProgress
} from '@mui/material';
import { formatPercentage, formatCurrency } from '../utils/formatters';

const StrategyStats = ({ stats }) => {
  if (!stats) return null;
  
  // Безопасно извлекаем значения с проверкой на существование
  const { 
    strategyPerformance = {
      DCA: { trades: 0, winRate: 0, avgProfit: 0, avgLoss: 0 },
      SCALPING: { trades: 0, winRate: 0, avgProfit: 0, avgLoss: 0 }
    }, 
    lastMarketAnalysis = {
      timestamp: Date.now(),
      recommendedStrategy: 'DCA',
      marketType: 'UNKNOWN',
      volatility: 0,
      volumeRatio: 0,
      trendStrength: 0,
      confidence: 0.5
    }, 
    activeStrategy = 'DCA' 
  } = stats;
  
  const getMarketTypeBadgeColor = (marketType) => {
    switch (marketType) {
      case 'TRENDING':
        return 'primary';
      case 'VOLATILE':
        return 'error';
      case 'RANGING':
        return 'success';
      default:
        return 'default';
    }
  };
  
  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Статистика стратегий
      </Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">
              Активная стратегия: 
              <Chip 
                label={activeStrategy} 
                color="primary"
                size="small"
                sx={{ ml: 1 }}
              />
            </Typography>
          </Box>
          
          <Typography variant="subtitle2" gutterBottom>
            DCA Стратегия
          </Typography>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="body2" color="textSecondary">
                Сделок:
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2">
                {strategyPerformance.DCA?.trades || 0}
              </Typography>
            </Grid>
            
            <Grid item xs={6}>
              <Typography variant="body2" color="textSecondary">
                Win Rate:
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2">
                {formatPercentage(strategyPerformance.DCA?.winRate || 0)}
              </Typography>
            </Grid>
            
            <Grid item xs={6}>
              <Typography variant="body2" color="textSecondary">
                Средняя прибыль:
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="success.main">
                {formatCurrency(strategyPerformance.DCA?.avgProfit || 0)}
              </Typography>
            </Grid>
            
            <Grid item xs={6}>
              <Typography variant="body2" color="textSecondary">
                Средний убыток:
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="error.main">
                {formatCurrency(strategyPerformance.DCA?.avgLoss || 0)}
              </Typography>
            </Grid>
          </Grid>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" gutterBottom>
            Скальпинг Стратегия
          </Typography>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="body2" color="textSecondary">
                Сделок:
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2">
                {strategyPerformance.SCALPING?.trades || 0}
              </Typography>
            </Grid>
            
            <Grid item xs={6}>
              <Typography variant="body2" color="textSecondary">
                Win Rate:
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2">
                {formatPercentage(strategyPerformance.SCALPING?.winRate || 0)}
              </Typography>
            </Grid>
            
            <Grid item xs={6}>
              <Typography variant="body2" color="textSecondary">
                Средняя прибыль:
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="success.main">
                {formatCurrency(strategyPerformance.SCALPING?.avgProfit || 0)}
              </Typography>
            </Grid>
            
            <Grid item xs={6}>
              <Typography variant="body2" color="textSecondary">
                Средний убыток:
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="error.main">
                {formatCurrency(strategyPerformance.SCALPING?.avgLoss || 0)}
              </Typography>
            </Grid>
          </Grid>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">
              Анализ рынка
              {lastMarketAnalysis.timestamp && (
                <Typography variant="caption" sx={{ ml: 1 }}>
                  (обновлено {new Date(lastMarketAnalysis.timestamp).toLocaleTimeString()})
                </Typography>
              )}
            </Typography>
          </Box>
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Тип рынка:
            </Typography>
            <Chip 
              label={lastMarketAnalysis.marketType || 'UNKNOWN'} 
              color={getMarketTypeBadgeColor(lastMarketAnalysis.marketType)}
              size="small"
            />
          </Box>
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Рекомендуемая стратегия:
            </Typography>
            <Chip 
              label={lastMarketAnalysis.recommendedStrategy || 'DCA'} 
              color={activeStrategy === lastMarketAnalysis.recommendedStrategy ? 'success' : 'default'}
              size="small"
            />
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              Уверенность: {formatPercentage(lastMarketAnalysis.confidence * 100 || 0)}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={lastMarketAnalysis.confidence * 100 || 0} 
              sx={{ mt: 0.5 }}
            />
          </Box>
          
          <Typography variant="subtitle2" gutterBottom>
            Метрики рынка
          </Typography>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="body2" color="textSecondary">
                Волатильность:
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2">
                {formatPercentage(lastMarketAnalysis.volatility || 0)}
              </Typography>
            </Grid>
            
            <Grid item xs={6}>
              <Typography variant="body2" color="textSecondary">
                Соотношение объема:
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2">
                {(lastMarketAnalysis.volumeRatio || 0).toFixed(2)}x
              </Typography>
            </Grid>
            
            <Grid item xs={6}>
              <Typography variant="body2" color="textSecondary">
                Сила тренда:
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2">
                {(lastMarketAnalysis.trendStrength || 0).toFixed(2)}
              </Typography>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default StrategyStats;
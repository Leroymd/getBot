// frontend/src/components/MarketAnalyzer.js
import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Button, 
  Chip, 
  CircularProgress,
  Grid,
  LinearProgress,
  Alert
} from '@mui/material';
import { analyzeMarket, setStrategy } from '../services/botService';
import { formatPercentage } from '../utils/formatters';

const MarketAnalyzer = ({ symbol, onStrategyChange, refreshStats }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Получение анализа рынка
  const fetchAnalysis = async () => {
    if (!symbol) return;
    
    try {
      setLoading(true);
      setError(null);
      const result = await analyzeMarket(symbol);
      setAnalysis(result);
    } catch (err) {
      console.error('Error analyzing market:', err);
      setError('Ошибка анализа рынка: ' + (err.message || 'Неизвестная ошибка'));
    } finally {
      setLoading(false);
    }
  };

  // Загрузка анализа при изменении символа
  useEffect(() => {
    if (symbol) {
      fetchAnalysis();
    }
  }, [symbol]);

  // Изменение стратегии
  const handleSetStrategy = async (strategy) => {
    try {
      setChanging(true);
      setError(null);
      await setStrategy(symbol, strategy);
      setSuccess(`Стратегия успешно изменена на ${strategy}`);
      setTimeout(() => setSuccess(null), 3000);
      
      // Обновляем статистику, если есть callback
      if (refreshStats) {
        refreshStats();
      }
    } catch (err) {
      console.error('Error setting strategy:', err);
      setError('Ошибка изменения стратегии: ' + (err.message || 'Неизвестная ошибка'));
    } finally {
      setChanging(false);
    }
  };

  // Цвет для типа рынка
  const getMarketTypeColor = (marketType) => {
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
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Анализ рынка для {symbol}
        </Typography>
        <Button 
          variant="outlined" 
          size="small" 
          onClick={fetchAnalysis}
          disabled={loading}
        >
          Обновить анализ
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <CircularProgress size={24} />
          <Typography sx={{ ml: 1 }}>
            Анализ рынка...
          </Typography>
        </Box>
      )}

      {!loading && analysis && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Тип рынка:
              </Typography>
              <Chip 
                label={analysis.marketType} 
                color={getMarketTypeColor(analysis.marketType)}
              />
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Рекомендуемая стратегия:
              </Typography>
              <Chip 
                label={analysis.recommendedStrategy} 
                color="primary"
                sx={{ mr: 1 }}
              />
              <Typography variant="caption">
                (уверенность: {formatPercentage(analysis.confidence * 100)})
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={analysis.confidence * 100} 
                sx={{ mt: 1 }}
              />
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Метрики рынка:
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="body2" color="textSecondary">
                  Волатильность:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  {formatPercentage(analysis.volatility)}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="textSecondary">
                  Отношение объема:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  {analysis.volumeRatio.toFixed(2)}x
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="textSecondary">
                  Сила тренда:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  {analysis.trendStrength.toFixed(2)}
                </Typography>
              </Grid>
            </Grid>
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Установить стратегию:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                variant="outlined" 
                color="primary" 
                size="small" 
                onClick={() => handleSetStrategy('AUTO')}
                disabled={changing}
              >
                AUTO
              </Button>
              <Button 
                variant="outlined" 
                color="primary" 
                size="small" 
                onClick={() => handleSetStrategy('DCA')}
                disabled={changing}
              >
                DCA
              </Button>
              <Button 
                variant="outlined" 
                color="primary" 
                size="small" 
                onClick={() => handleSetStrategy('SCALPING')}
                disabled={changing}
              >
                SCALPING
              </Button>
              <Button 
                variant="contained" 
                color="primary" 
                size="small" 
                onClick={() => handleSetStrategy(analysis.recommendedStrategy)}
                disabled={changing}
              >
                Использовать рекомендуемую
              </Button>
            </Box>
          </Grid>
        </Grid>
      )}
      
      {!loading && !analysis && (
        <Typography variant="body2" color="textSecondary">
          Нет данных анализа. Нажмите "Обновить анализ" для получения информации о текущем состоянии рынка.
        </Typography>
      )}
    </Paper>
  );
};

export default MarketAnalyzer;
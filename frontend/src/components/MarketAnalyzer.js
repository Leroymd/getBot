// frontend/src/components/MarketAnalyzer.js - Исправленная версия
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
  const [retryCount, setRetryCount] = useState(0);

  // Получение анализа рынка с обработкой ошибок
  const fetchAnalysis = async () => {
    if (!symbol) return;
    
    try {
      setLoading(true);
      setError(null);
      // Изменим вызов для добавления случайного значения, чтобы избежать кэширования
      const cacheBuster = `&_=${Date.now()}`;
      console.log(`Analyzing market for ${symbol}${cacheBuster}...`);
      
      try {
        const result = await analyzeMarket(`${symbol}${cacheBuster}`);
        
        if (result) {
          console.log(`Analysis result for ${symbol}:`, result);
          
          // Проверяем, есть ли в результате сообщение об ошибке 
          if (result._source && result._source.includes('synthetic')) {
            // Это синтетические данные из-за ошибки, но мы всё равно их показываем
            console.warn(`Received synthetic data for ${symbol}: ${result.message || 'Unknown reason'}`);
            setAnalysis(result);
            setError({
              type: 'warning',
              message: result.message || 'Показаны приблизительные данные из-за проблем с API'
            });
          } else {
            // Нормальные данные
            setAnalysis(result);
            setError(null);
          }
        } else {
          throw new Error('Пустой ответ от API');
        }
      } catch (apiError) {
        console.error('Error analyzing market:', apiError);
        
        // Создаем синтетические данные для отображения
        const syntheticResult = {
          symbol,
          recommendedStrategy: 'DCA',
          marketType: 'RANGING',
          volatility: 1.2,
          volumeRatio: 1.0,
          trendStrength: 0.4,
          confidence: 0.7,
          _source: 'client-side-synthetic'
        };
        
        setAnalysis(syntheticResult);
        setError({
          type: 'error',
          message: `Ошибка анализа рынка: ${apiError.message || 'Неизвестная ошибка'}. Показаны приблизительные данные.`
        });
        
        // Если это первая попытка, попробуем еще раз через 1 секунду
        if (retryCount === 0) {
          setRetryCount(1);
          setTimeout(() => {
            console.log(`Retrying market analysis for ${symbol}...`);
            setRetryCount(0);
            fetchAnalysis();
          }, 1000);
        }
      }
    } catch (err) {
      console.error('Unexpected error during analysis:', err);
      setError({
        type: 'error',
        message: `Неожиданная ошибка: ${err.message}`
      });
      
      // Создаем минимальные данные для отображения
      setAnalysis({
        symbol,
        recommendedStrategy: 'DCA',
        marketType: 'UNKNOWN',
        volatility: 0,
        volumeRatio: 0,
        trendStrength: 0,
        confidence: 0.5,
        _source: 'error-fallback'
      });
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

  // Изменение стратегии с обработкой ошибок
  const handleSetStrategy = async (strategy) => {
    try {
      setChanging(true);
      setError(null);
      
      try {
        await setStrategy(symbol, strategy);
        setSuccess(`Стратегия успешно изменена на ${strategy}`);
        setTimeout(() => setSuccess(null), 3000);
        
        // Обновляем статистику, если есть callback
        if (refreshStats) {
          refreshStats();
        }
        
        // Уведомляем родительский компонент об изменении стратегии
        if (onStrategyChange) {
          onStrategyChange();
        }
      } catch (apiError) {
        console.error('Error setting strategy:', apiError);
        setError({
          type: 'error',
          message: `Ошибка изменения стратегии: ${apiError.message || 'Неизвестная ошибка'}`
        });
      }
    } catch (err) {
      console.error('Unexpected error setting strategy:', err);
      setError({
        type: 'error',
        message: `Неожиданная ошибка: ${err.message}`
      });
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
          {loading ? 'Обновление...' : 'Обновить анализ'}
        </Button>
      </Box>
      
      {error && (
        <Alert severity={error.type || "error"} sx={{ mb: 2 }}>
          {error.message}
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
                (уверенность: {formatPercentage(analysis.confidence * 100 || 0)})
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={analysis.confidence * 100 || 0} 
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
                  {formatPercentage(analysis.volatility || 0)}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="textSecondary">
                  Соотношение объема:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  {(analysis.volumeRatio || 0).toFixed(2)}x
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="textSecondary">
                  Сила тренда:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  {(analysis.trendStrength || 0).toFixed(2)}
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
import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import Box from '@mui/material/Box';
import useKlines from '../hooks/useKlines';
import { formatCandlestickData } from '../utils/dataFormatters';
import CircularProgress from '@mui/material/CircularProgress';

const ChartComponent = ({ symbol, interval = '1m', height = 400 }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const { klines, loading, error } = useKlines(symbol, interval);

  // Создание и очистка графика
  useEffect(() => {
    // Функция для создания графика
    const createChartInstance = () => {
      if (!chartContainerRef.current) return;
      
      // Создание графика
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height,
        layout: {
          background: { color: '#1E1E1E' },
          textColor: '#d1d4dc',
        },
        grid: {
          vertLines: {
            color: 'rgba(42, 46, 57, 0.5)',
          },
          horzLines: {
            color: 'rgba(42, 46, 57, 0.5)',
          },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
      });
      
      chartRef.current = chart;
      
      // Обработчик изменения размера окна
      const handleResize = () => {
        if (chart && chartContainerRef.current) {
          chart.applyOptions({ 
            width: chartContainerRef.current.clientWidth 
          });
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    };
    
    // Вызываем функцию создания графика
    const cleanupResize = createChartInstance();
    
    // Очистка при размонтировании
    return () => {
      cleanupResize && cleanupResize();
      
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      
      candlestickSeriesRef.current = null;
    };
  }, [height, symbol]); // Пересоздаем график при изменении symbol или height

  // Обновление данных графика
  useEffect(() => {
    if (!chartRef.current || !klines || klines.length === 0) return;
    
    console.log('Updating chart data:', { symbol, interval, klinesLength: klines?.length });
    
    // Форматирование данных для графика
    const candlestickData = formatCandlestickData(klines);
    
    // Удаляем старую серию если есть
    if (candlestickSeriesRef.current) {
      try {
        chartRef.current.removeSeries(candlestickSeriesRef.current);
      } catch (err) {
        console.error('Error removing old series:', err);
      }
    }
    
    // Создаем новую серию
    try {
      const newSeries = chartRef.current.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });
      
      // Сохраняем ссылку на серию
      candlestickSeriesRef.current = newSeries;
      
      // Устанавливаем данные
      if (candlestickData && candlestickData.length > 0) {
        newSeries.setData(candlestickData);
        
        // Подгоняем масштаб
        chartRef.current.timeScale().fitContent();
      }
    } catch (err) {
      console.error('Error creating candlestick series:', err);
    }
  }, [klines, interval, symbol]);

  return (
    <Box
      ref={chartContainerRef}
      sx={{
        width: '100%',
        height: `${height}px`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        backgroundColor: '#1E1E1E',
      }}
    >
      {loading && (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <CircularProgress />
        </Box>
      )}
      
      {error && (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'error.main' }}>
          Error loading chart data: {error.message}
        </Box>
      )}
    </Box>
  );
};

export default ChartComponent;
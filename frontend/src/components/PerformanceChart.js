import React, { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Box from '@mui/material/Box';

const PerformanceChart = ({ hourlyPnl, hourlyTrades }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!hourlyPnl || !hourlyTrades || !chartRef.current) return;

    // Уничтожаем предыдущий экземпляр графика, если существует
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Данные для графика
    const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    
    const data = {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'PnL (USDT)',
          data: hourlyPnl,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          yAxisID: 'y',
        },
        {
          type: 'bar',
          label: 'Trades',
          data: hourlyTrades,
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          yAxisID: 'y1',
        }
      ]
    };

    // Конфигурация графика
    const config = {
      data,
      options: {
        responsive: true,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'PnL (USDT)'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: {
              drawOnChartArea: false,
            },
            title: {
              display: true,
              text: 'Number of Trades'
            }
          },
        }
      },
    };

    // Создание нового экземпляра графика
    chartInstance.current = new Chart(chartRef.current, config);

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [hourlyPnl, hourlyTrades]);

  return (
    <Card>
      <CardHeader title="Hourly Performance" />
      <CardContent>
        <Box sx={{ height: 300 }}>
          <canvas ref={chartRef} />
        </Box>
      </CardContent>
    </Card>
  );
};

export default PerformanceChart;
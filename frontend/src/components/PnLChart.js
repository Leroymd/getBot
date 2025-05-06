// frontend/src/components/PnLChart.js
import React from 'react';
import { Box, Typography } from '@mui/material';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Регистрируем компоненты Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const PnLChart = ({ data }) => {
  if (!data || !Array.isArray(data)) {
    return (
      <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="textSecondary">
          Нет данных для отображения
        </Typography>
      </Box>
    );
  }

  // Подготавливаем метки времени (часов)
  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  
  // Определяем цвета в зависимости от значения PnL
  const backgroundColor = data.map(value => 
    value > 0 ? 'rgba(76, 175, 80, 0.6)' : 'rgba(244, 67, 54, 0.6)'
  );
  
  const borderColor = data.map(value => 
    value > 0 ? 'rgba(76, 175, 80, 1)' : 'rgba(244, 67, 54, 1)'
  );

  const chartData = {
    labels,
    datasets: [
      {
        label: 'PnL по часам',
        data,
        backgroundColor,
        borderColor,
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)', // Более светлые линии сетки для темной темы
        },
      },
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)', // Более светлые линии сетки для темной темы
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.raw;
            return `PnL: ${value.toFixed(2)} USDT`;
          }
        }
      }
    },
  };

  return (
    <Box sx={{ height: 300 }}>
      <Bar data={chartData} options={options} />
    </Box>
  );
};

export default PnLChart;
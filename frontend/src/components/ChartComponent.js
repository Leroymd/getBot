// Исправленная версия ChartComponent.js - убрали неиспользуемый импорт useState
import React, { useEffect, useRef } from 'react';
import { getKlines } from '../services/marketService';
import { CircularProgress, Box, Typography } from '@mui/material';

const ChartComponent = ({ symbol, interval = '1m', height = 500 }) => {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    if (!symbol) return;

    // Создание контейнера для графика, если он ещё не существует
    if (!chartContainerRef.current.querySelector('iframe')) {
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = `${height}px`;
      iframe.style.border = 'none';
      iframe.style.margin = '0';
      iframe.style.padding = '0';
      
      chartContainerRef.current.innerHTML = '';
      chartContainerRef.current.appendChild(iframe);

      // Инициализация графика TradingView
      const script = document.createElement('script');
      script.innerHTML = `
        const chart = new TradingView.widget({
          symbol: "${symbol}",
          interval: "${interval}",
          container_id: "${chartContainerRef.current.id}",
          library_path: "/charting_library/",
          locale: "ru",
          theme: "dark",
          timezone: "Etc/UTC",
          autosize: true,
          fullscreen: false,
          debug: false,
          allow_symbol_change: true,
          enabled_features: ["use_localstorage_for_settings"],
          disabled_features: ["header_symbol_search", "header_compare", "compare_symbol", "display_market_status", "go_to_date", "border_around_the_chart", "timeframes_toolbar"],
          client_id: 'bitget_bot',
          user_id: 'user',
          loading_screen: { backgroundColor: "#1e1e1e" },
          overrides: {
            "paneProperties.background": "#1e1e1e",
            "paneProperties.vertGridProperties.color": "#292929",
            "paneProperties.horzGridProperties.color": "#292929",
            "scalesProperties.textColor": "#AAA"
          }
        });
        window.tvWidget = chart;
      `;
      
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(`
        <html>
          <head>
            <script src="/charting_library/charting_library.min.js"></script>
            <style>
              body { margin: 0; padding: 0; background: #1e1e1e; }
              .chart-placeholder { 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                height: 100%; 
                color: #AAA; 
                font-family: sans-serif; 
              }
            </style>
          </head>
          <body>
            <div id="${chartContainerRef.current.id}" style="width: 100%; height: 100%;"></div>
          </body>
        </html>
      `);
      iframe.contentWindow.document.close();
      
      // Добавляем скрипт после загрузки iframe
      iframe.onload = () => {
        iframe.contentWindow.document.body.appendChild(script);
        chartInstanceRef.current = iframe.contentWindow.tvWidget;
      };
    } else if (chartInstanceRef.current) {
      // Обновляем символ на существующем графике
      chartInstanceRef.current.setSymbol(symbol, interval);
    }
    
    // Загружаем данные свечей через API
    const fetchKlines = async () => {
      try {
        const response = await getKlines(symbol, interval);
        // Здесь можно обработать данные, если нужно передать их в график
        console.log(`Loaded ${response.data?.length || 0} candles for ${symbol}`);
      } catch (error) {
        console.error(`Error loading klines for ${symbol}:`, error);
      }
    };
    
    fetchKlines();
    
    // Очистка при размонтировании компонента
    return () => {
      if (chartContainerRef.current) {
        // Если нужно очистить график при изменении символа, можно добавить код здесь
      }
    };
  }, [symbol, interval, height]);

  return (
    <Box sx={{ width: '100%', height: `${height}px`, position: 'relative' }}>
      <div 
        ref={chartContainerRef}
        id={`tv_chart_container_${symbol}`}
        className="tradingview-chart"
        style={{ width: '100%', height: '100%' }}
      >
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%' 
          }}
        >
          <CircularProgress size={40} />
          <Typography variant="body1" sx={{ ml: 2 }}>
            Загрузка графика...
          </Typography>
        </Box>
      </div>
    </Box>
  );
};

export default ChartComponent;
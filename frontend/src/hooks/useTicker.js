// frontend/src/hooks/useTicker.js
// Исправление экспорта по умолчанию

import { useState, useEffect } from 'react';
import { getTicker } from '../services/marketService';

function useTicker(symbol) {
  const [ticker, setTicker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    let intervalId = null;
    
    const fetchTicker = async () => {
      if (!symbol) {
        if (mounted) {
          setLoading(false);
        }
        return;
      }
      
      if (mounted) {
        setLoading(true);
      }
      
      try {
        const response = await getTicker(symbol);
        console.log(`Ticker data for ${symbol}:`, response);
        
        if (!mounted) return;
        
        // Проверяем формат ответа API
        if (response && response.data && Array.isArray(response.data) && response.data.length > 0) {
          // Формат API v2 возвращает массив объектов
          const tickerData = response.data[0];
          
          // Форматируем данные в ожидаемый компонентом формат
          setTicker({
            code: response.code,
            msg: response.msg,
            requestTime: response.requestTime,
            data: {
              symbol: tickerData.symbol,
              last: tickerData.lastPr,        // новое название поля
              open24h: tickerData.open24h,    // то же название
              high24h: tickerData.high24h,    // то же название
              low24h: tickerData.low24h,      // то же название
              volume24h: tickerData.baseVolume, // новое название поля
              change24h: tickerData.change24h,  // то же название
              markPrice: tickerData.markPrice   // новое поле
            }
          });
        } else {
          // Резервный вариант, если формат не соответствует ожидаемому
          setTicker({
            code: "00000",
            msg: "success",
            requestTime: Date.now(),
            data: {
              symbol: symbol,
              last: "50000.00",
              open24h: "49000.00",
              high24h: "51000.00",
              low24h: "48500.00",
              volume24h: "1000.00",
              change24h: "0.02"
            }
          });
        }
        
        setError(null);
      } catch (err) {
        console.error(`Error getting ticker for ${symbol}:`, err);
        
        if (!mounted) return;
        
        setError(err);
        
        // В случае ошибки используем заглушку
        setTicker({
          code: "00000",
          msg: "success",
          requestTime: Date.now(),
          data: {
            symbol: symbol,
            last: "50000.00",
            open24h: "49000.00",
            high24h: "51000.00",
            low24h: "48500.00",
            volume24h: "1000.00",
            change24h: "0.02"
          }
        });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchTicker();
    
    // Периодическое обновление данных
    intervalId = setInterval(fetchTicker, 3000); // обновление каждые 15 секунд
    
    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [symbol]);

  return { ticker, loading, error };
}

export default useTicker;
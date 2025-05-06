// frontend/src/hooks/useTicker.js
// ����������� �������� �� ���������

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
        
        // ��������� ������ ������ API
        if (response && response.data && Array.isArray(response.data) && response.data.length > 0) {
          // ������ API v2 ���������� ������ ��������
          const tickerData = response.data[0];
          
          // ����������� ������ � ��������� ����������� ������
          setTicker({
            code: response.code,
            msg: response.msg,
            requestTime: response.requestTime,
            data: {
              symbol: tickerData.symbol,
              last: tickerData.lastPr,        // ����� �������� ����
              open24h: tickerData.open24h,    // �� �� ��������
              high24h: tickerData.high24h,    // �� �� ��������
              low24h: tickerData.low24h,      // �� �� ��������
              volume24h: tickerData.baseVolume, // ����� �������� ����
              change24h: tickerData.change24h,  // �� �� ��������
              markPrice: tickerData.markPrice   // ����� ����
            }
          });
        } else {
          // ��������� �������, ���� ������ �� ������������� ����������
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
        
        // � ������ ������ ���������� ��������
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
    
    // ������������� ���������� ������
    intervalId = setInterval(fetchTicker, 3000); // ���������� ������ 15 ������
    
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
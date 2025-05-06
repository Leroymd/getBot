// frontend/src/hooks/useAccountBalance.js
import { useState, useEffect } from 'react';
import { getAccountBalance } from '../services/accountService';

function useAccountBalance() {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true);
        const response = await getAccountBalance();
        
        // Проверяем структуру ответа API
        if (response && response.data) {
          // Новая структура ответа API BitGet
          setBalance(response);
        } else {
          throw new Error('Invalid response format');
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching account balance:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
    
    // Обновляем баланс каждые 30 секунд
    const interval = setInterval(fetchBalance, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return { balance, loading, error };
}

export default useAccountBalance;
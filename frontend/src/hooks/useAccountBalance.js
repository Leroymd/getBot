import { useState, useEffect } from 'react';
import { getAccountBalance } from '../services/accountService';

const useAccountBalance = () => {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchBalance = async () => {
      try {
        setLoading(true);
        const data = await getAccountBalance();
        
        if (isMounted) {
          console.log('Account balance data:', data);
          setBalance(data);
          setError(null);
        }
      } catch (err) {
        console.error('Error getting account balance:', err);
        if (isMounted) {
          setError(err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchBalance();

    // Обновление каждые 15 секунд для более оперативного отображения баланса
    const interval = setInterval(fetchBalance, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { balance, loading, error };
};

export default useAccountBalance;
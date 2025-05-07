// backend/services/PairFilter.js

class PairFilter {
  constructor() {
    this.defaultOptions = {
      minVolume: 1000000,     // Минимальный объем 24ч в USDT
      minTradeCount: 1000,    // Минимальное количество сделок за 24ч
      maxSpread: 0.5,         // Максимальный спред в %
      minLiquidity: 0.5,      // Минимальная ликвидность (0-1)
      minPriceChange: 0,      // Минимальное изменение цены в %
      maxPriceChange: 100,    // Максимальное изменение цены в %
      filterByBase: [],       // Фильтр по базовой валюте
      excludeBases: [],       // Исключить базовые валюты
      excludeStablecoins: false, // Исключить стейблкоины
      marketCap: 0,           // Минимальная рыночная капитализация
      minScore: 0,            // Минимальный скор
      maxCoinAge: 0,          // Максимальный возраст монеты в днях (0 - без ограничений)
    };
  }

  // Фильтрация пар по заданным критериям
  filterPairs(pairs, options = {}, callback) {
    try {
      const filterOptions = { ...this.defaultOptions, ...options };
      console.log(`Filtering ${pairs.length} pairs with options:`, filterOptions);
      
      const filteredPairs = pairs.filter(pair => {
        // Проверяем, что пара имеет все необходимые данные
        if (!pair || !pair.symbol) {
          console.warn('Invalid pair data:', pair);
          return false;
        }
        
        // Фильтр по минимальному объему
        if (filterOptions.minVolume > 0) {
          const volume = pair.volume24h || 0;
          if (volume < filterOptions.minVolume) {
            return false;
          }
        }
        
        // Фильтр по количеству сделок
        if (filterOptions.minTradeCount > 0 && pair.tradeCount) {
          if (pair.tradeCount < filterOptions.minTradeCount) {
            return false;
          }
        }
        
        // Фильтр по спреду
        if (filterOptions.maxSpread > 0 && pair.spread) {
          if (pair.spread > filterOptions.maxSpread) {
            return false;
          }
        }
        
        // Фильтр по изменению цены
        if (pair.priceChange24h) {
          const absPriceChange = Math.abs(pair.priceChange24h);
          if (absPriceChange < filterOptions.minPriceChange || 
              absPriceChange > filterOptions.maxPriceChange) {
            return false;
          }
        }
        
        // Фильтр по базовой валюте
        if (filterOptions.filterByBase.length > 0) {
          if (!filterOptions.filterByBase.includes(pair.baseCoin)) {
            return false;
          }
        }
        
        // Исключение по базовой валюте
        if (filterOptions.excludeBases.length > 0) {
          if (filterOptions.excludeBases.includes(pair.baseCoin)) {
            return false;
          }
        }
        
        // Исключение стейблкоинов
        if (filterOptions.excludeStablecoins) {
          const stablecoins = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'UST', 'USTC'];
          if (stablecoins.includes(pair.baseCoin)) {
            return false;
          }
        }
        
        // Фильтр по рыночной капитализации
        if (filterOptions.marketCap > 0 && pair.marketCap) {
          if (pair.marketCap < filterOptions.marketCap) {
            return false;
          }
        }
        
        // Фильтр по скору
        if (filterOptions.minScore > 0 && pair.score) {
          if (pair.score < filterOptions.minScore) {
            return false;
          }
        }
        
        // Фильтр по возрасту монеты
        if (filterOptions.maxCoinAge > 0 && pair.coinAge) {
          if (pair.coinAge > filterOptions.maxCoinAge) {
            return false;
          }
        }
        
        // Если прошли все фильтры, включаем пару в результаты
        return true;
      });
      
      callback(null, filteredPairs);
    } catch (error) {
      callback(error);
    }
  }

  // Сортировка пар по различным критериям
  sortPairs(pairs, sortBy = 'score', sortDir = 'desc', callback) {
    try {
      if (pairs.length === 0) return callback(null, []);
      
      const availableSortFields = [
        'score', 'volume24h', 'priceChange24h', 'volatility', 
        'trendStrength', 'spread', 'marketCap'
      ];
      
      // Проверяем наличие поля сортировки
      if (!availableSortFields.includes(sortBy)) {
        sortBy = 'score'; // По умолчанию сортируем по скору
      }
      
      // Сортировка по указанному полю
      const sortedPairs = [...pairs].sort((a, b) => {
        // Получаем значения для сравнения
        const valueA = a[sortBy] || 0;
        const valueB = b[sortBy] || 0;
        
        // Сортировка по убыванию (desc) или возрастанию (asc)
        if (sortDir === 'asc') {
          return valueA - valueB;
        } else {
          return valueB - valueA;
        }
      });
      
      callback(null, sortedPairs);
    } catch (error) {
      callback(error);
    }
  }

  // Группировка пар по базовой валюте
  groupPairsByBase(pairs, callback) {
    try {
      const grouped = {};
      
      pairs.forEach(pair => {
        if (!pair.baseCoin) return;
        
        if (!grouped[pair.baseCoin]) {
          grouped[pair.baseCoin] = [];
        }
        
        grouped[pair.baseCoin].push(pair);
      });
      
      callback(null, grouped);
    } catch (error) {
      callback(error);
    }
  }

  // Выбор лучших пар из каждой группы
  selectTopPairsFromGroups(groupedPairs, topCount = 1, callback) {
    try {
      const result = [];
      
      Object.values(groupedPairs).forEach(pairsGroup => {
        // Сортируем группу по скору
        this.sortPairs(pairsGroup, 'score', 'desc', (err, sorted) => {
          if (err) {
            console.error('Error sorting group:', err);
            return;
          }
          
          // Добавляем top N пар из каждой группы
          result.push(...sorted.slice(0, topCount));
        });
      });
      
      // Сортируем общий результат по скору
      this.sortPairs(result, 'score', 'desc', (err, finalResult) => {
        if (err) {
          return callback(err);
        }
        callback(null, finalResult);
      });
    } catch (error) {
      callback(error);
    }
  }
}

module.exports = PairFilter;
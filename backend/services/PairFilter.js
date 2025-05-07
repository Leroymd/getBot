// backend/services/PairFilter.js

class PairFilter {
  constructor() {
    this.defaultOptions = {
      minVolume: 50000,       // Уменьшаем с 1000000 до 50000 USDT
      minTradeCount: 100,     // Уменьшаем с 1000 до 100
      maxSpread: 1.0,         // Увеличиваем с 0.5% до 1.0%
      minLiquidity: 0.3,      // Уменьшаем с 0.5 до 0.3
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

  // Улучшенная функция filterPairs, обеспечивающая обработку ошибок
  filterPairs(pairs, options = {}, callback) {
    try {
      const filterOptions = { ...this.defaultOptions, ...options };
      console.log(`Filtering ${pairs ? pairs.length : 0} pairs with options:`, filterOptions);
      
      // Проверка на пустые массивы
      if (!pairs || !Array.isArray(pairs) || pairs.length === 0) {
        console.warn('Empty or invalid pairs array provided to filterPairs');
        return callback(null, []);
      }
      
      const filteredPairs = pairs.filter(pair => {
        // Проверка структуры объекта pair
        if (!pair || typeof pair !== 'object') {
          console.warn('Invalid pair data (not an object):', pair);
          return false;
        }
        
        // Проверка наличия ключевого поля (symbol)
        if (!pair.symbol) {
          console.warn('Invalid pair data (no symbol):', pair);
          return false;
        }
        
        // Фильтр по минимальному объему - КЛЮЧЕВОЙ ФИЛЬТР
        if (filterOptions.minVolume > 0) {
          const volume = parseFloat(pair.volume24h || 0);
          if (isNaN(volume) || volume < filterOptions.minVolume) {
            // console.debug(`${pair.symbol} отфильтрован по объему: ${volume} < ${filterOptions.minVolume}`);
            return false;
          }
        }
        
        // Фильтр по количеству сделок
        if (filterOptions.minTradeCount > 0 && pair.tradeCount) {
          const tradeCount = parseInt(pair.tradeCount || 0);
          if (isNaN(tradeCount) || tradeCount < filterOptions.minTradeCount) {
            return false;
          }
        }
        
        // Фильтр по спреду
        if (filterOptions.maxSpread > 0 && pair.spread) {
          const spread = parseFloat(pair.spread || 0);
          if (isNaN(spread) || spread > filterOptions.maxSpread) {
            return false;
          }
        }
        
        // Фильтр по изменению цены
        if (pair.priceChange24h) {
          const priceChange = parseFloat(pair.priceChange24h || 0);
          if (!isNaN(priceChange)) {
            const absPriceChange = Math.abs(priceChange);
            if (absPriceChange < filterOptions.minPriceChange || 
                absPriceChange > filterOptions.maxPriceChange) {
              return false;
            }
          }
        }
        
        // Фильтр по базовой валюте
        if (filterOptions.filterByBase && filterOptions.filterByBase.length > 0) {
          if (!pair.baseCoin || !filterOptions.filterByBase.includes(pair.baseCoin)) {
            return false;
          }
        }
        
        // Исключение по базовой валюте
        if (filterOptions.excludeBases && filterOptions.excludeBases.length > 0) {
          if (pair.baseCoin && filterOptions.excludeBases.includes(pair.baseCoin)) {
            return false;
          }
        }
        
        // Исключение стейблкоинов
        if (filterOptions.excludeStablecoins) {
          const stablecoins = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'UST', 'USTC'];
          if (pair.baseCoin && stablecoins.includes(pair.baseCoin)) {
            return false;
          }
        }
        
        // Фильтр по рыночной капитализации
        if (filterOptions.marketCap > 0 && pair.marketCap) {
          const marketCap = parseFloat(pair.marketCap || 0);
          if (isNaN(marketCap) || marketCap < filterOptions.marketCap) {
            return false;
          }
        }
        
        // Фильтр по скору
        if (filterOptions.minScore > 0 && pair.score) {
          const score = parseFloat(pair.score || 0);
          if (isNaN(score) || score < filterOptions.minScore) {
            return false;
          }
        }
        
        // Если прошли все фильтры, включаем пару в результаты
        return true;
      });
      
      console.log(`After filtering: ${filteredPairs.length} pairs passed filters`);
      callback(null, filteredPairs);
    } catch (error) {
      console.error('Error in filterPairs:', error);
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
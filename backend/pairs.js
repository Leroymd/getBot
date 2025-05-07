// scan-pairs.js - Скрипт для сканирования пар с сигналами
// Импортируем необходимые модули
const BitgetAPI = require('./services/BitgetAPI');
const MarketAnalyzer = require('./services/MarketAnalyzer');

// Настройки фильтрации
const FILTER_CONFIG = {
  //minVolume: 100000,       // Минимальный объем в USDT
  //maxSpread: 0.5,           // Максимальный спред в %
  //minPriceChange: 1.0,      // Минимальное изменение цены в %
  //maxPriceChange: 10.0,     // Максимальное изменение цены в %
  //excludeStablecoins: true, // Исключать стейблкоины
  //timeframe: '5m'           // Таймфрейм для анализа
};

// Создаем экземпляр BitgetAPI
const api = new BitgetAPI();

// Вспомогательная функция для задержки
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Получение всех доступных символов с биржи
 */
async function getAvailableSymbols() {
  try {
    console.log('Получение списка символов...');
    const response = await api.getSymbols();
    
    if (!response || !response.data || !Array.isArray(response.data)) {
      throw new Error('Не удалось получить список символов');
    }
    
    // Фильтруем только USDT-фьючерсы
    const symbols = response.data
      .filter(item => item && item.symbol && item.symbol.endsWith('USDT'))
      .map(item => ({
        symbol: item.symbol,
        baseCoin: item.baseCoin,
        quoteCoin: item.quoteCoin
      }));
    
    console.log(`Найдено ${symbols.length} символов с USDT`);
    return symbols;
  } catch (error) {
    console.error(`Ошибка при получении символов: ${error.message}`);
    throw error;
  }
}

/**
 * Получение и фильтрация пар по объему и другим критериям
 */
async function filterSymbolsByMarketData(symbols) {
  console.log('Получение и фильтрация рыночных данных...');
  const filteredSymbols = [];
  const batchSize = 20; // Размер пакета для запросов
  
  // Обрабатываем пары пакетами
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    console.log(`Обработка пакета ${Math.floor(i/batchSize) + 1}/${Math.ceil(symbols.length/batchSize)}`);
    
    const batchPromises = batch.map(async (item) => {
      try {
        // Получаем тикер
        const ticker = await api.getTicker(item.symbol);
        
        if (!ticker || !ticker.data || !ticker.data[0]) {
          return null;
        }
        
        // Извлекаем необходимые данные
        const tickerData = ticker.data[0];
        const lastPrice = parseFloat(tickerData.last || 0);
        const volume = parseFloat(tickerData.baseVolume || 0) * lastPrice;
        const high24h = parseFloat(tickerData.high24h || 0);
        const low24h = parseFloat(tickerData.low24h || 0);
        const spread = high24h > 0 ? (high24h - low24h) / high24h * 100 : 0;
        const priceChange24h = Math.abs(parseFloat(tickerData.change24h || 0) * 100);
        
        // Проверка на стейблкоины
        if (FILTER_CONFIG.excludeStablecoins) {
          const stablecoins = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'UST', 'USTC'];
          if (stablecoins.includes(item.baseCoin)) {
            return null;
          }
        }
        
        // Применяем фильтры
        if (volume < FILTER_CONFIG.minVolume) {
          return null;
        }
        
        if (spread > FILTER_CONFIG.maxSpread) {
          return null;
        }
        
        if (priceChange24h < FILTER_CONFIG.minPriceChange || 
            priceChange24h > FILTER_CONFIG.maxPriceChange) {
          return null;
        }
        
        // Возвращаем пару с дополнительными данными
        return {
          ...item,
          lastPrice,
          volume,
          high24h,
          low24h,
          spread,
          priceChange24h,
          priceChangeDirection: parseFloat(tickerData.change24h || 0) >= 0 ? 'up' : 'down'
        };
      } catch (error) {
        console.warn(`Ошибка при обработке ${item.symbol}: ${error.message}`);
        return null;
      }
    });
    
    // Ждем завершения всех запросов в пакете
    const batchResults = await Promise.all(batchPromises);
    
    // Добавляем валидные результаты
    filteredSymbols.push(...batchResults.filter(item => item !== null));
    
    // Задержка перед следующим пакетом
    await sleep(500);
  }
  
  console.log(`Отфильтровано ${filteredSymbols.length} символов по критериям объема и спреда`);
  
  // Сортируем по объему (сначала наибольший)
  filteredSymbols.sort((a, b) => b.volume - a.volume);
  
  return filteredSymbols;
}

/**
 * Анализ пар на наличие сигналов
 */
async function analyzeSymbolsForSignals(symbols) {
  console.log('Поиск сигналов для отфильтрованных пар...');
  
  // Ограничиваем количество пар для детального анализа
  const topSymbols = symbols.slice(0, 30); // Анализируем только топ-30 пар по объему
  const signalsResults = [];
  
  for (const symbol of topSymbols) {
    try {
      console.log(`Анализ ${symbol.symbol}...`);
      
      // Создаем анализатор рынка
      const analyzer = new MarketAnalyzer(
        symbol.symbol, 
        {
          autoSwitching: {
            volatilityThreshold: 1.5,
            volumeThreshold: 2.0,
            trendStrengthThreshold: 0.6
          }
        }, 
        api
      );
      
      // Получаем сигналы
      const signals = await new Promise((resolve, reject) => {
        analyzer.findTradingSignals(FILTER_CONFIG.timeframe, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      // Если есть сигналы, добавляем в результаты
      if (signals && signals.signals && signals.signals.length > 0) {
        signalsResults.push({
          ...symbol,
          analysis: signals
        });
        
        console.log(`Найдены сигналы для ${symbol.symbol}: ${signals.signals.map(s => `${s.type} (${s.strength})`).join(', ')}`);
      } else {
        console.log(`Для ${symbol.symbol} не найдено сигналов`);
      }
    } catch (error) {
      console.warn(`Ошибка при анализе ${symbol.symbol}: ${error.message}`);
    }
    
    // Задержка между запросами
    await sleep(300);
  }
  
  return signalsResults;
}

/**
 * Вывод результатов
 */
function printResults(results) {
  console.log('\n======= РЕЗУЛЬТАТЫ СКАНИРОВАНИЯ =======');
  console.log(`Найдено ${results.length} пар с сигналами\n`);
  
  // Сортируем по силе сигнала и объему
  results.sort((a, b) => {
    // Получаем максимальную силу сигнала для каждой пары
    const getMaxStrength = (pair) => {
      return Math.max(...pair.analysis.signals.map(s => {
        return s.strength === 'STRONG' ? 3 : (s.strength === 'MODERATE' ? 2 : 1);
      }));
    };
    
    const strengthA = getMaxStrength(a);
    const strengthB = getMaxStrength(b);
    
    // Сортируем по силе сигнала (по убыванию)
    if (strengthA !== strengthB) {
      return strengthB - strengthA;
    }
    
    // При равной силе сортируем по объему (по убыванию)
    return b.volume - a.volume;
  });
  
  // Выводим информацию о каждой паре
  results.forEach((pair, index) => {
    console.log(`${index + 1}. ${pair.symbol}`);
    console.log(`   Цена: ${pair.lastPrice.toFixed(pair.lastPrice < 1 ? 6 : 2)}`);
    console.log(`   Объем 24ч: ${(pair.volume / 1000000).toFixed(2)}M USDT`);
    console.log(`   Изменение цены 24ч: ${pair.priceChange24h.toFixed(2)}% (${pair.priceChangeDirection === 'up' ? '↑' : '↓'})`);
    console.log(`   Спред: ${pair.spread.toFixed(2)}%`);
    console.log(`   Тип рынка: ${pair.analysis.marketType || 'N/A'}`);
    console.log(`   Рекомендуемая стратегия: ${pair.analysis.marketConditions?.recommendedStrategy || 'N/A'}`);
    
    console.log(`   Сигналы:`);
    pair.analysis.signals.forEach(signal => {
      console.log(`     - ${signal.type} (${signal.strength}): ${signal.confidence.toFixed(2)}`);
      console.log(`       Причины: ${signal.reasons.join(', ')}`);
      
      if (signal.entryStrategy) {
        console.log(`       Цена входа: ${signal.entryStrategy.entryPrice.toFixed(pair.lastPrice < 1 ? 6 : 2)}`);
        console.log(`       Стоп-лосс: ${signal.entryStrategy.stopLoss.toFixed(pair.lastPrice < 1 ? 6 : 2)}`);
        console.log(`       Тейк-профит: ${signal.entryStrategy.takeProfit.toFixed(pair.lastPrice < 1 ? 6 : 2)}`);
        console.log(`       Соотношение риск/прибыль: ${signal.entryStrategy.riskRewardRatio}`);
      }
    });
    
    if (pair.analysis.indicators) {
      console.log(`   Индикаторы:`);
      console.log(`     - RSI: ${pair.analysis.indicators.rsi.toFixed(2)}`);
      console.log(`     - MACD: ${pair.analysis.indicators.macd}`);
    }
    
    console.log('\n');
  });
  
  // Выводим краткий список рекомендуемых пар
  if (results.length > 0) {
    console.log('Топ-5 рекомендуемых пар:');
    results.slice(0, 5).forEach((pair, index) => {
      const signalTypes = pair.analysis.signals.map(s => `${s.type} (${s.strength})`).join(', ');
      console.log(`${index + 1}. ${pair.symbol}: ${signalTypes}`);
    });
  } else {
    console.log('Не найдено пар, соответствующих критериям');
  }
  
  console.log('\n========================================');
}

/**
 * Основная функция сканирования
 */
async function scanPairs() {
  try {
    console.log('Начинаем сканирование пар...');
    
    // Шаг 1: Получаем все доступные символы
    const allSymbols = await getAvailableSymbols();
    
    // Шаг 2: Фильтруем по объему и другим критериям
    const filteredSymbols = await filterSymbolsByMarketData(allSymbols);
    
    // Шаг 3: Анализируем на наличие сигналов
    const pairsWithSignals = await analyzeSymbolsForSignals(filteredSymbols);
    
    // Шаг 4: Выводим результаты
    printResults(pairsWithSignals);
    
    return {
      totalSymbols: allSymbols.length,
      filteredSymbols: filteredSymbols.length,
      signalsFound: pairsWithSignals.length,
      pairs: pairsWithSignals
    };
  } catch (error) {
    console.error(`Критическая ошибка: ${error.message}`);
    throw error;
  }
}

// Запускаем сканирование
console.log('BitGet Trading Bot - Сканер торговых пар');
console.log('=======================================');
scanPairs()
  .then(result => {
    console.log(`Сканирование завершено. Проанализировано ${result.totalSymbols} пар, найдено ${result.signalsFound} сигналов.`);
  })
  .catch(error => {
    console.error('Ошибка при сканировании:', error);
  });

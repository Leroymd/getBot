export const formatCandlestickData = (klines) => {
  // Проверяем наличие данных
  if (!klines || !klines.data || !Array.isArray(klines.data)) {
    console.error('Invalid klines data:', klines);
    return [];
  }
  
  // Возвращаемые данные API BitGet v2 имеют следующий формат:
  // [timestamp, open, high, low, close, baseVolume, quoteVolume]
  return klines.data.map(candle => {
    if (!Array.isArray(candle) || candle.length < 5) {
      console.error('Invalid candle data:', candle);
      return null;
    }
    
    // Преобразуем данные в формат для library-charts
    return {
      time: parseInt(candle[0]) / 1000, // конвертировать в секунды для lightweight-charts
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5] || 0)
    };
  }).filter(candle => candle !== null); // Удаление невалидных свечей
};
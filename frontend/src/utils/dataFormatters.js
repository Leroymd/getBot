export const formatCandlestickData = (klines) => {
  // ��������� ������� ������
  if (!klines || !klines.data || !Array.isArray(klines.data)) {
    console.error('Invalid klines data:', klines);
    return [];
  }
  
  // ������������ ������ API BitGet v2 ����� ��������� ������:
  // [timestamp, open, high, low, close, baseVolume, quoteVolume]
  return klines.data.map(candle => {
    if (!Array.isArray(candle) || candle.length < 5) {
      console.error('Invalid candle data:', candle);
      return null;
    }
    
    // ����������� ������ � ������ ��� library-charts
    return {
      time: parseInt(candle[0]) / 1000, // �������������� � ������� ��� lightweight-charts
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5] || 0)
    };
  }).filter(candle => candle !== null); // �������� ���������� ������
};
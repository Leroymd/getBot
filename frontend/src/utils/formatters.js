export const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString();
};

export const formatCurrency = (value) => {
  if (value === undefined || value === null) return '-';
  return parseFloat(value).toFixed(2);
};

export const formatPercentage = (value) => {
  if (value === undefined || value === null) return '-';
  return parseFloat(value).toFixed(2) + '%';
};

export const formatPrice = (price, decimals = 2) => {
  if (!price) return '-';
  return parseFloat(price).toFixed(decimals);
};

export const formatProfitLoss = (pnl) => {
  if (pnl === undefined || pnl === null) return '-';
  const value = parseFloat(pnl);
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
};
import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import { TrendingUp, TrendingDown, ShowChart, AccountBalance } from '@mui/icons-material';
import { formatCurrency, formatPercentage } from '../utils/formatters';

const StatItem = ({ title, value, icon, color }) => {
  return (
    <Grid item xs={6} sm={3}>
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Grid container spacing={1} alignItems="center">
            <Grid item>{React.cloneElement(icon, { color })}</Grid>
            <Grid item>
              <Typography variant="subtitle2" color="textSecondary">
                {title}
              </Typography>
            </Grid>
          </Grid>
          <Typography variant="h5" component="div" sx={{ mt: 1, color: `${color}.main` }}>
            {value}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  );
};

const StatsCard = ({ stats }) => {
  if (!stats) {
    return null;
  }

  const {
    currentBalance,
    initialBalance,
    totalPnl,
    winRate,
    totalTrades,
    maxDrawdown,
    returnPercentage
  } = stats;

  const pnlColor = totalPnl >= 0 ? 'success' : 'error';
  const returnsColor = returnPercentage >= 0 ? 'success' : 'error';

  return (
    <Grid container spacing={2}>
      <StatItem
        title="Current Balance"
        value={formatCurrency(currentBalance)}
        icon={<AccountBalance />}
        color="primary"
      />
      <StatItem
        title="Total PnL"
        value={formatCurrency(totalPnl)}
        icon={totalPnl >= 0 ? <TrendingUp /> : <TrendingDown />}
        color={pnlColor}
      />
      <StatItem
        title="Return"
        value={formatPercentage(returnPercentage)}
        icon={<ShowChart />}
        color={returnsColor}
      />
      <StatItem
        title="Win Rate"
        value={formatPercentage(winRate)}
        icon={<ShowChart />}
        color="info"
      />
      <StatItem
        title="Total Trades"
        value={totalTrades}
        icon={<ShowChart />}
        color="secondary"
      />
      <StatItem
        title="Max Drawdown"
        value={formatPercentage(maxDrawdown)}
        icon={<TrendingDown />}
        color="warning"
      />
      <StatItem
        title="Initial Balance"
        value={formatCurrency(initialBalance)}
        icon={<AccountBalance />}
        color="default"
      />
      <StatItem
        title="Today's Trades"
        value={stats.tradesToday || 0}
        icon={<ShowChart />}
        color="secondary"
      />
    </Grid>
  );
};

export default StatsCard;
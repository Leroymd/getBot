// frontend/src/components/PositionCard.js
import React from 'react';
import { Paper, Typography, Grid, Chip } from '@mui/material';
import { formatCurrency } from '../utils/formatters';

const PositionCard = ({ position }) => {
  if (!position) return null;
  
  const { direction, entryPrice, duration, strategy } = position;
  
  // Определяем цвет для направления
  const directionColor = direction === 'LONG' ? 'success' : 'error';
  
  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Открытая позиция
      </Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={6} md={3}>
          <Typography variant="subtitle2" color="textSecondary">
            Направление:
          </Typography>
          <Chip 
            label={direction} 
            color={directionColor}
            size="small"
            sx={{ mt: 0.5 }}
          />
        </Grid>
        
        <Grid item xs={6} md={3}>
          <Typography variant="subtitle2" color="textSecondary">
            Цена входа:
          </Typography>
          <Typography variant="body1">
            {formatCurrency(entryPrice)}
          </Typography>
        </Grid>
        
        <Grid item xs={6} md={3}>
          <Typography variant="subtitle2" color="textSecondary">
            Длительность:
          </Typography>
          <Typography variant="body1">
            {duration} мин
          </Typography>
        </Grid>
        
        <Grid item xs={6} md={3}>
          <Typography variant="subtitle2" color="textSecondary">
            Стратегия:
          </Typography>
          <Chip 
            label={strategy} 
            color="primary"
            size="small"
            sx={{ mt: 0.5 }}
          />
        </Grid>
      </Grid>
    </Paper>
  );
};

export default PositionCard;
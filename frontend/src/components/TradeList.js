// frontend/src/components/TradeList.js
import React, { useState, useEffect } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  CircularProgress,
  Typography
} from '@mui/material';
import { formatDate, formatCurrency, formatProfitLoss } from '../utils/formatters';
import api from '../services/api';

const TradeList = ({ symbol }) => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Получение истории сделок
  useEffect(() => {
    const fetchTrades = async () => {
      try {
        setLoading(true);
        // Заглушка для получения сделок (в реальности здесь будет запрос к API)
        // В идеале нужно создать отдельный маршрут API для получения истории сделок
        
        // Установим пустой массив для trades, чтобы избежать ошибки slice
        setTrades([]);
        setError(null);
      } catch (err) {
        console.error('Error fetching trades:', err);
        setError(err.message || 'Ошибка при загрузке истории сделок');
        // Гарантируем, что trades всегда массив
        setTrades([]);
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      fetchTrades();
    }
  }, [symbol]);

  // Обработка изменения страницы
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // Обработка изменения количества строк на странице
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Получаем цвет чипа в зависимости от причины закрытия
  const getCloseReasonColor = (reason) => {
    switch (reason) {
      case 'TAKE_PROFIT':
        return 'success';
      case 'STOP_LOSS':
        return 'error';
      case 'TRAILING_STOP':
        return 'warning';
      case 'MAX_DURATION':
        return 'info';
      case 'MANUAL':
        return 'default';
      default:
        return 'default';
    }
  };

  // Если загрузка данных
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={24} />
        <Typography sx={{ ml: 1 }}>
          Загрузка истории сделок...
        </Typography>
      </Box>
    );
  }

  // Если ошибка
  if (error) {
    return (
      <Typography color="error" align="center">
        Ошибка: {error}
      </Typography>
    );
  }

  // Если нет сделок или trades не массив
  if (!Array.isArray(trades) || trades.length === 0) {
    return (
      <Typography align="center" color="textSecondary">
        История сделок пуста
      </Typography>
    );
  }

  // Обеспечиваем, что trades - это массив перед вызовом slice
  const displayedTrades = Array.isArray(trades) ? 
    trades.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) : 
    [];

  return (
    <Box>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Направление</TableCell>
              <TableCell>Цена входа</TableCell>
              <TableCell>Цена выхода</TableCell>
              <TableCell>Время входа</TableCell>
              <TableCell>Время выхода</TableCell>
              <TableCell>Объем</TableCell>
              <TableCell>PnL</TableCell>
              <TableCell>Причина закрытия</TableCell>
              <TableCell>Стратегия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedTrades.map((trade, index) => (
              <TableRow
                key={trade._id || `trade-${index}`}
                sx={{
                  '&:last-child td, &:last-child th': { border: 0 },
                  backgroundColor: trade.profitLoss > 0 ? 'rgba(76, 175, 80, 0.08)' : trade.profitLoss < 0 ? 'rgba(244, 67, 54, 0.08)' : 'inherit',
                }}
              >
                <TableCell>{trade._id ? trade._id.substring(0, 8) + '...' : '-'}</TableCell>
                <TableCell>
                  <Chip
                    label={trade.direction || '-'}
                    color={trade.direction === 'LONG' ? 'success' : 'error'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{formatCurrency(trade.entryPrice) || '-'}</TableCell>
                <TableCell>{trade.exitPrice ? formatCurrency(trade.exitPrice) : '-'}</TableCell>
                <TableCell>{formatDate(trade.entryTime) || '-'}</TableCell>
                <TableCell>{trade.exitTime ? formatDate(trade.exitTime) : '-'}</TableCell>
                <TableCell>{trade.quantity || '-'}</TableCell>
                <TableCell
                  sx={{
                    color: trade.profitLoss > 0 ? 'success.main' : trade.profitLoss < 0 ? 'error.main' : 'inherit',
                  }}
                >
                  {formatProfitLoss(trade.profitLoss) || '-'}
                </TableCell>
                <TableCell>
                  {trade.closeReason && (
                    <Chip
                      label={trade.closeReason}
                      color={getCloseReasonColor(trade.closeReason)}
                      size="small"
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={trade.strategy || 'DCA'}
                    color="primary"
                    size="small"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={Array.isArray(trades) ? trades.length : 0}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Box>
  );
};

export default TradeList;
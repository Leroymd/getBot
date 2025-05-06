import React, { useState } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import Box from '@mui/material/Box';
import { formatDate, formatCurrency } from '../utils/formatters';

const TradeHistoryTable = ({ trades = [], loading }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Определение цвета для PnL
  const getPnLColor = (pnl) => {
    if (pnl > 0) return 'success.main';
    if (pnl < 0) return 'error.main';
    return 'text.primary';
  };

  // Определение статуса сделки
  const getStatusChip = (status) => {
    switch (status) {
      case 'OPEN':
        return <Chip label="Open" color="primary" size="small" />;
      case 'CLOSED':
        return <Chip label="Closed" color="default" size="small" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  // Определение иконки для направления сделки
  const getDirectionIcon = (direction) => {
    return direction === 'LONG' ? 
      <ArrowUpwardIcon color="success" fontSize="small" /> : 
      <ArrowDownwardIcon color="error" fontSize="small" />;
  };

  // Определение метки для причины закрытия
  const getCloseReasonLabel = (reason) => {
    switch (reason) {
      case 'TAKE_PROFIT':
        return 'Take Profit';
      case 'STOP_LOSS':
        return 'Stop Loss';
      case 'TRAILING_STOP':
        return 'Trailing Stop';
      case 'MAX_DURATION':
        return 'Max Duration';
      case 'MANUAL':
        return 'Manual';
      case 'PNL_STAGNANT':
        return 'PnL Stagnant';
      default:
        return reason || '-';
    }
  };

  // Пустое состояние
  if (trades.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="textSecondary">
          {loading ? 'Loading trade history...' : 'No trades found.'}
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Symbol</TableCell>
              <TableCell>Direction</TableCell>
              <TableCell>Entry Time</TableCell>
              <TableCell>Exit Time</TableCell>
              <TableCell>Entry Price</TableCell>
              <TableCell>Exit Price</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>PnL</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>DCA Count</TableCell>
              <TableCell>Close Reason</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {trades
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((trade) => (
                <TableRow key={trade._id || trade.id} hover>
                  <TableCell>{trade.symbol}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {getDirectionIcon(trade.direction)}
                      {trade.direction}
                    </Box>
                  </TableCell>
                  <TableCell>{formatDate(trade.entryTime)}</TableCell>
                  <TableCell>{trade.exitTime ? formatDate(trade.exitTime) : '-'}</TableCell>
                  <TableCell>{formatCurrency(trade.entryPrice)}</TableCell>
                  <TableCell>{trade.exitPrice ? formatCurrency(trade.exitPrice) : '-'}</TableCell>
                  <TableCell>{trade.quantity ? trade.quantity.toFixed(6) : '-'}</TableCell>
                  <TableCell>
                    <Typography color={getPnLColor(trade.profitLoss)}>
                      {trade.profitLoss ? formatCurrency(trade.profitLoss) : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>{getStatusChip(trade.status)}</TableCell>
                  <TableCell>{trade.dcaCount || 0}</TableCell>
                  <TableCell>{getCloseReasonLabel(trade.closeReason)}</TableCell>
                </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={trades.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
};

export default TradeHistoryTable;
import React, { useState } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';

const TradeHistory = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filter, setFilter] = useState({
    symbol: 'all',
    status: 'all',
    direction: 'all'
  });

  // Данные для истории сделок
  const trades = [
    { id: 1, symbol: 'BTCUSDT', direction: 'LONG', entryPrice: 82345.67, exitPrice: 83210.45, profit: 125.67, time: '2025-05-01 14:23:45', status: 'CLOSED' },
    { id: 2, symbol: 'ETHUSDT', direction: 'SHORT', entryPrice: 5987.34, exitPrice: 5845.21, profit: 87.45, time: '2025-05-01 13:56:12', status: 'CLOSED' },
    { id: 3, symbol: 'SOLUSDT', direction: 'LONG', entryPrice: 302.56, exitPrice: 298.73, profit: -24.56, time: '2025-05-01 12:34:56', status: 'CLOSED' },
    { id: 4, symbol: 'BTCUSDT', direction: 'LONG', entryPrice: 83567.89, exitPrice: null, profit: null, time: '2025-05-01 15:12:45', status: 'OPEN' },
    { id: 5, symbol: 'AVAXUSDT', direction: 'SHORT', entryPrice: 87.45, exitPrice: 85.67, profit: 45.23, time: '2025-05-01 11:23:45', status: 'CLOSED' }
  ];

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (e) => {
    setFilter({ ...filter, [e.target.name]: e.target.value });
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Trade History
      </Typography>
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Symbol</InputLabel>
              <Select
                name="symbol"
                value={filter.symbol}
                onChange={handleFilterChange}
                label="Symbol"
              >
                <MenuItem value="all">All Symbols</MenuItem>
                <MenuItem value="BTCUSDT">BTCUSDT</MenuItem>
                <MenuItem value="ETHUSDT">ETHUSDT</MenuItem>
                <MenuItem value="SOLUSDT">SOLUSDT</MenuItem>
                <MenuItem value="AVAXUSDT">AVAXUSDT</MenuItem>
                <MenuItem value="BNBUSDT">BNBUSDT</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={filter.status}
                onChange={handleFilterChange}
                label="Status"
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="OPEN">Open</MenuItem>
                <MenuItem value="CLOSED">Closed</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Direction</InputLabel>
              <Select
                name="direction"
                value={filter.direction}
                onChange={handleFilterChange}
                label="Direction"
              >
                <MenuItem value="all">All Directions</MenuItem>
                <MenuItem value="LONG">Long</MenuItem>
                <MenuItem value="SHORT">Short</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained">
              Apply Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>
      
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Symbol</TableCell>
                <TableCell>Direction</TableCell>
                <TableCell>Entry Price</TableCell>
                <TableCell>Exit Price</TableCell>
                <TableCell>Profit/Loss</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {trades
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((trade) => (
                  <TableRow key={trade.id} hover>
                    <TableCell>{trade.id}</TableCell>
                    <TableCell>{trade.symbol}</TableCell>
                    <TableCell>
                      <Chip 
                        label={trade.direction} 
                        color={trade.direction === 'LONG' ? 'success' : 'error'} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>{trade.entryPrice}</TableCell>
                    <TableCell>{trade.exitPrice || '-'}</TableCell>
                    <TableCell 
                      sx={{ 
                        color: trade.profit > 0 ? 'success.main' : 
                               trade.profit < 0 ? 'error.main' : 'inherit' 
                      }}
                    >
                      {trade.profit ? `${trade.profit > 0 ? '+' : ''}${trade.profit} USDT` : '-'}
                    </TableCell>
                    <TableCell>{trade.time}</TableCell>
                    <TableCell>
                      <Chip 
                        label={trade.status} 
                        color={trade.status === 'OPEN' ? 'primary' : 'default'} 
                        size="small" 
                      />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={trades.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Paper>
    </Box>
  );
};

export default TradeHistory;
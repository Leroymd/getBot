// frontend/src/pages/Dashboard.js
// ѕолна€ верси€ с исправлени€ми дл€ перезапуска бота

import React, { useState, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { useNavigate } from 'react-router-dom';

// Import components
import StatsCard from '../components/StatsCard';
import StrategyStats from '../components/StrategyStats';
import PnLChart from '../components/PnLChart';
import PositionCard from '../components/PositionCard';
import BotConfigForm from '../components/BotConfigForm';

// Import services and utilities
import { 
  getBotStatus, 
  startBot, 
  stopBot, 
  analyzeMarket, 
  scanPairs,
  getBotConfig
} from '../services/botService';
import { formatCurrency, formatPercentage } from '../utils/formatters';

// Signal Card Component
const SignalCard = ({ signal, onLaunch, onViewDetails }) => {
  const { 
    symbol, 
    recommendedStrategy, 
    confidence, 
    marketType, 
    volatility 
  } = signal;

  // Color for market type
  const getMarketTypeColor = (type) => {
    switch (type) {
      case 'TRENDING': return 'primary';
      case 'VOLATILE': return 'error';
      case 'RANGING': return 'success';
      default: return 'default';
    }
  };

  return (
    <Card 
      variant="outlined" 
      sx={{ 
        height: '100%',
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: 'background.paper',
        '&:hover': {
          boxShadow: 3,
          transition: 'box-shadow 0.3s ease-in-out'
        }
      }}
    >
      <CardContent sx={{ flexGrow: 1, pt: 1, pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" component="div">
            {symbol}
          </Typography>
          <Chip 
            label={marketType} 
            color={getMarketTypeColor(marketType)}
            size="small"
          />
        </Box>
        
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Strategy: {recommendedStrategy}
        </Typography>
        
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Confidence: {formatPercentage(confidence * 100)}
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={confidence * 100} 
            sx={{ mt: 0.5 }}
            color={confidence >= 0.8 ? "success" : confidence >= 0.7 ? "primary" : "warning"}
          />
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Volatility: {formatPercentage(volatility)}
        </Typography>
      </CardContent>
      
      <CardActions sx={{ justifyContent: 'space-between', pt: 0 }}>
        <Button 
          size="small" 
          startIcon={<ShowChartIcon />}
          onClick={() => onViewDetails(symbol)}
        >
          Details
        </Button>
        <Button 
          size="small" 
          color="primary" 
          variant="contained" 
          startIcon={<PlayArrowIcon />}
          onClick={() => onLaunch(signal)}
        >
          Launch
        </Button>
      </CardActions>
    </Card>
  );
};

// Bot Status Card Component
const BotStatusCard = ({ bot, onStop, onSettings, onRestart }) => {
  const { 
    symbol, 
    running, 
    stats, 
    uptime 
  } = bot;
  
  // Format uptime
  const formatUptime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m ${seconds % 60}s`;
    }
  };

  // Calculate card color based on profitability
  const getBorderColor = () => {
    if (!stats || !stats.returnPercentage) return 'grey.500';
    return stats.returnPercentage >= 0 ? 'success.main' : 'error.main';
  };

  return (
    <Card 
      variant="outlined" 
      sx={{ 
        height: '100%',
        display: 'flex', 
        flexDirection: 'column',
        borderColor: running ? getBorderColor() : 'grey.500',
        borderWidth: running ? 2 : 1,
        opacity: running ? 1 : 0.7,
        backgroundColor: 'background.paper'
      }}
    >
      <CardContent sx={{ flexGrow: 1, pt: 1, pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" component="div">
            {symbol}
          </Typography>
          <Chip 
            label={running ? "Active" : "Stopped"}
            color={running ? "success" : "default"}
            size="small"
            icon={running ? <CheckCircleIcon /> : undefined}
          />
        </Box>

        {running && stats && (
          <>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Profit:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography 
                  variant="body2" 
                  color={stats.totalPnl >= 0 ? "success.main" : "error.main"}
                >
                  {formatCurrency(stats.totalPnl)}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Return:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography 
                  variant="body2" 
                  color={stats.returnPercentage >= 0 ? "success.main" : "error.main"}
                >
                  {formatPercentage(stats.returnPercentage)}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Win Rate:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  {formatPercentage(stats.winRate)}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Strategy:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  {stats.activeStrategy}
                </Typography>
              </Grid>
            </Grid>
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Uptime: {formatUptime(uptime)}
            </Typography>
          </>
        )}
        
        {!running && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Bot is not running
          </Typography>
        )}
      </CardContent>
      
      <CardActions sx={{ justifyContent: 'space-between', pt: 0 }}>
        {running ? (
          <>
            <Button 
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => onRestart(symbol)}
            >
              Restart
            </Button>
            <Box>
              <Button 
                size="small"
                startIcon={<SettingsIcon />}
                onClick={() => onSettings(symbol)}
                sx={{ mr: 1 }}
              >
                Settings
              </Button>
              <Button 
                size="small" 
                color="error" 
                variant="contained" 
                startIcon={<StopIcon />}
                onClick={() => onStop(symbol)}
              >
                Stop
              </Button>
            </Box>
          </>
        ) : (
          <>
            <Button 
              size="small"
              startIcon={<SettingsIcon />}
              onClick={() => onSettings(symbol)}
            >
              Settings
            </Button>
            <Button 
              size="small" 
              color="primary" 
              variant="contained" 
              startIcon={<PlayArrowIcon />}
              onClick={() => onSettings(symbol)}
            >
              Launch
            </Button>
          </>
        )}
      </CardActions>
    </Card>
  );
};

// Main Dashboard Component
const Dashboard = () => {
  const navigate = useNavigate();
  const [activeBots, setActiveBots] = useState({});
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState("launch"); // launch or settings
  const [dialogData, setDialogData] = useState(null);
  
  // Fetch active bots on page load
  useEffect(() => {
    fetchActiveBots();
    scanAllPairs();
  }, []);

  // Periodically update data
  useEffect(() => {
    const timer = setInterval(() => {
      fetchActiveBots();
    }, 30000); // Update every 30 seconds
    
    return () => clearInterval(timer);
  }, []);
  
  // Fetch status of all bots
  const fetchActiveBots = async () => {
    try {
      setLoading(true);
      const response = await getBotStatus();
      setActiveBots(response);
      setError(null);
    } catch (err) {
      console.error('Error fetching bot status:', err);
      setError('Failed to fetch bot status: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Scan all trading pairs
  const scanAllPairs = async () => {
    try {
      setScanning(true);
      const result = await scanPairs();
      if (result && Array.isArray(result)) {
        // Filter pairs with confidence >= 70%
        const filteredSignals = result
          .filter(signal => signal.confidence >= 0.7)
          .sort((a, b) => b.confidence - a.confidence) // Sort by confidence (descending)
          .slice(0, 8); // Take top 8 pairs
        
        setSignals(filteredSignals);
      }
      setError(null);
    } catch (err) {
      console.error('Error scanning pairs:', err);
      setError('Failed to scan trading pairs: ' + (err.message || 'Unknown error'));
    } finally {
      setScanning(false);
    }
  };

  // Launch bot
  const handleLaunchBot = (signal) => {
    setDialogType("launch");
    setDialogData(signal);
    setSelectedSymbol(signal.symbol);
    setDialogOpen(true);
  };

  // Stop bot
  const handleStopBot = async (symbol) => {
    try {
      await stopBot(symbol);
      
      // Update active bots list
      fetchActiveBots();
      
      // Show success notification
      setError({
        type: 'success',
        message: `Bot for ${symbol} has been stopped successfully`
      });
      
      // Hide notification after 3 seconds
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      console.error('Error stopping bot:', err);
      setError('Failed to stop bot: ' + (err.message || 'Unknown error'));
    }
  };

  // Bot settings
  const handleBotSettings = (symbol) => {
    setDialogType("settings");
    setSelectedSymbol(symbol);
    setDialogData({ symbol });
    setDialogOpen(true);
  };

  // Restart bot handler
  const handleRestartBot = async (symbol) => {
    try {
      setLoading(true);
      
      // Get current bot configuration
      const response = await getBotConfig(symbol);
      let config = response;
      
      // If no configuration found, use default
      if (!config) {
        config = {
          activeStrategy: 'AUTO',
          common: {
            enabled: true,
            leverage: 10,
            initialBalance: 100,
            reinvestment: 100
          },
          dca: {
            maxDCAOrders: 5,
            dcaPriceStep: 1.5,
            dcaMultiplier: 1.5,
            maxTradeDuration: 240,
            trailingStop: 0.5
          },
          scalping: {
            timeframe: '1m',
            profitTarget: 0.5,
            stopLoss: 0.3,
            maxTradeDuration: 30,
            minVolatility: 0.2,
            maxSpread: 0.1,
            useTrailingStop: true,
            trailingStopActivation: 0.2,
            trailingStopDistance: 0.1
          },
          autoSwitching: {
            enabled: true,
            volatilityThreshold: 1.5,
            volumeThreshold: 2.0,
            trendStrengthThreshold: 0.6
          }
        };
      }
      
      // Restart bot with forceRestart=true
      await startBot(symbol, config, true);
      
      // Update active bots list
      await fetchActiveBots();
      
      // Show success notification
      setError({
        type: 'success',
        message: `Bot for ${symbol} has been restarted successfully`
      });
      
      // Hide notification after 3 seconds
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      console.error('Error restarting bot:', err);
      setError('Failed to restart bot: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // View detailed information about pair
  const handleViewDetails = (symbol) => {
    navigate(`/trading?symbol=${symbol}`);
  };

  // Close dialog
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setDialogData(null);
  };

  // Submit bot configuration
  const handleSubmitConfig = async (config) => {
    try {
      // Close dialog
      setDialogOpen(false);
      
      // Check if this bot is already running
      const isRunning = activeBots[selectedSymbol]?.running;
      
      // Launch bot with new settings (with forceRestart if already running)
      await startBot(selectedSymbol, config, isRunning);
      
      // Update active bots list
      fetchActiveBots();
      
      // Show success notification
      setError({
        type: 'success',
        message: `Bot for ${selectedSymbol} has been ${isRunning ? 'restarted' : 'launched'} successfully`
      });
      
      // Hide notification after 3 seconds
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      console.error('Error launching bot:', err);
      setError('Failed to launch bot: ' + (err.message || 'Unknown error'));
    }
  };

  // Get array of active bots for display
  const activeBotsArray = Object.entries(activeBots).map(([symbol, data]) => ({
    symbol,
    ...data
  }));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Dashboard
        </Typography>
        <Box>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={scanAllPairs}
            disabled={scanning}
            startIcon={scanning ? <CircularProgress size={20} /> : <RefreshIcon />}
          >
            {scanning ? 'Scanning...' : 'Scan Pairs'}
          </Button>
        </Box>
      </Box>
      
      {error && (
        <Alert 
          severity={typeof error === 'object' && error.type === 'success' ? 'success' : 'error'} 
          sx={{ mb: 3 }}
        >
          {typeof error === 'object' ? error.message : error}
        </Alert>
      )}
      
      <Tabs 
        value={activeTab} 
        onChange={(e, newValue) => setActiveTab(newValue)} 
        sx={{ mb: 3 }}
      >
        <Tab label="Overview" />
        <Tab label="Signals" />
        <Tab label="Active Bots" />
      </Tabs>
      
      {/* Overview Tab */}
      {activeTab === 0 && (
        <Box>
          <Typography variant="h5" gutterBottom>
            Best Trading Signals
          </Typography>
          
          <Grid container spacing={2} sx={{ mb: 4 }}>
            {scanning ? (
              <Grid item xs={12}>
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <CircularProgress />
                  <Typography sx={{ mt: 2 }}>
                    Analyzing trading pairs...
                  </Typography>
                </Box>
              </Grid>
            ) : signals.length > 0 ? (
              signals.slice(0, 4).map((signal, index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <SignalCard 
                    signal={signal} 
                    onLaunch={handleLaunchBot}
                    onViewDetails={handleViewDetails}
                  />
                </Grid>
              ))
            ) : (
              <Grid item xs={12}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="textSecondary">
                    No signals found. Please run pair scanning.
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
          
          <Typography variant="h5" gutterBottom>
            Active Bots
          </Typography>
          
          <Grid container spacing={2} sx={{ mb: 4 }}>
            {loading ? (
              <Grid item xs={12}>
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <CircularProgress />
                  <Typography sx={{ mt: 2 }}>
                    Loading active bots...
                  </Typography>
                </Box>
              </Grid>
            ) : activeBotsArray.filter(bot => bot.running).length > 0 ? (
              activeBotsArray
                .filter(bot => bot.running)
                .slice(0, 4)
                .map((bot, index) => (
                  <Grid item xs={12} sm={6} md={3} key={index}>
                    <BotStatusCard 
                      bot={bot} 
                      onStop={handleStopBot}
                      onSettings={handleBotSettings}
                      onRestart={handleRestartBot}
                    />
                  </Grid>
                ))
            ) : (
              <Grid item xs={12}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="textSecondary">
                    No active bots. Launch a bot from the signals section.
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
          
          {/* If there's at least one active bot, show its stats */}
          {activeBotsArray.filter(bot => bot.running).length > 0 && (
            <Box>
              <Typography variant="h5" gutterBottom>
                Bot Statistics
                <Tooltip title="Click to view detailed statistics">
                  <IconButton 
                    size="small" 
                    onClick={() => setActiveTab(2)}
                    sx={{ ml: 1 }}
                  >
                    <ShowChartIcon />
                  </IconButton>
                </Tooltip>
              </Typography>
              
              {activeBotsArray
                .filter(bot => bot.running)
                .slice(0, 1)
                .map((bot, index) => (
                  <Box key={index}>
                    <Typography variant="h6" gutterBottom sx={{ ml: 1 }}>
                      {bot.symbol}
                    </Typography>
                    
                    {bot.stats && (
                      <>
                        <StatsCard stats={bot.stats} />
                        
                        <Grid container spacing={3} sx={{ mt: 2 }}>
                          <Grid item xs={12} md={6}>
                            <Typography variant="h6" gutterBottom>
                              Hourly PnL
                            </Typography>
                            <Paper sx={{ p: 2 }}>
                              <PnLChart data={bot.stats.hourlyPnl} />
                            </Paper>
                          </Grid>
                          
                          <Grid item xs={12} md={6}>
                            <StrategyStats stats={bot.stats} />
                          </Grid>
                        </Grid>
                        
                        {bot.stats.openPosition && (
                          <Box sx={{ mt: 3 }}>
                            <PositionCard position={bot.stats.openPosition} />
                          </Box>
                        )}
                      </>
                    )}
                  </Box>
                ))}
            </Box>
          )}
        </Box>
      )}
      
      {/* Signals Tab */}
      {activeTab === 1 && (
        <Box>
          <Grid container spacing={2}>
            {scanning ? (
              <Grid item xs={12}>
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <CircularProgress />
                  <Typography sx={{ mt: 2 }}>
                    Analyzing trading pairs...
                  </Typography>
                </Box>
              </Grid>
            ) : signals.length > 0 ? (
              signals.map((signal, index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <SignalCard 
                    signal={signal} 
                    onLaunch={handleLaunchBot}
                    onViewDetails={handleViewDetails}
                  />
                </Grid>
              ))
            ) : (
              <Grid item xs={12}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="textSecondary">
                    No signals found. Please run pair scanning.
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Box>
      )}
      
      {/* Active Bots Tab */}
      {activeTab === 2 && (
        <Box>
          <Grid container spacing={2}>
            {loading ? (
              <Grid item xs={12}>
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <CircularProgress />
                  <Typography sx={{ mt: 2 }}>
                    Loading active bots...
                  </Typography>
                </Box>
              </Grid>
            ) : activeBotsArray.length > 0 ? (
              <>
                {activeBotsArray.map((bot, index) => (
                  <Grid item xs={12} sm={6} md={3} key={index}>
                    <BotStatusCard 
                      bot={bot} 
                      onStop={handleStopBot}
                      onSettings={handleBotSettings}
                      onRestart={handleRestartBot}
                    />
                  </Grid>
                ))}
                
                {/* If a bot is selected, show its detailed stats */}
                {selectedSymbol && activeBotsArray.find(bot => bot.symbol === selectedSymbol) && (
                  <Grid item xs={12} sx={{ mt: 3 }}>
                    <Typography variant="h5" gutterBottom>
                      Detailed Statistics - {selectedSymbol}
                    </Typography>
                    
                    {activeBotsArray
                      .filter(bot => bot.symbol === selectedSymbol)
                      .map((bot, index) => (
                        <Box key={index}>
                          {bot.stats && (
                            <>
                              <StatsCard stats={bot.stats} />
                              
                              <Grid container spacing={3} sx={{ mt: 2 }}>
                                <Grid item xs={12} md={6}>
                                  <Typography variant="h6" gutterBottom>
                                    Hourly PnL
                                  </Typography>
                                  <Paper sx={{ p: 2 }}>
                                    <PnLChart data={bot.stats.hourlyPnl} />
                                  </Paper>
                                </Grid>
                                
                                <Grid item xs={12} md={6}>
                                  <StrategyStats stats={bot.stats} />
                                </Grid>
                              </Grid>
                              
                              {bot.stats.openPosition && (
                                <Box sx={{ mt: 3 }}>
                                  <PositionCard position={bot.stats.openPosition} />
                                </Box>
                              )}
                            </>
                          )}
                        </Box>
                      ))}
                  </Grid>
                )}
              </>
            ) : (
              <Grid item xs={12}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="textSecondary">
                    No active bots. Launch a bot from the signals section.
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Box>
      )}
      
      {/* Bot Launch/Settings Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {dialogType === "launch" 
            ? `Launch Bot for ${selectedSymbol}`
            : `Bot Settings for ${selectedSymbol}`}
        </DialogTitle>
        <DialogContent dividers>
          {dialogData && (
            <BotConfigForm 
              symbol={selectedSymbol}
              initialConfig={dialogData}
              onSubmit={handleSubmitConfig}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;
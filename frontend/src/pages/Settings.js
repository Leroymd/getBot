import React, { useState } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

const Settings = () => {
  const [tab, setTab] = useState(0);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    apiKey: '',
    secretKey: '',
    passphrase: '',
    demoMode: true,
    notifications: {
      email: '',
      enableEmailNotifications: false,
      notifyOnTrade: true,
      notifyOnError: true
    }
  });

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setSettings({
        ...settings,
        [parent]: {
          ...settings[parent],
          [child]: e.target.type === 'checkbox' ? checked : value
        }
      });
    } else {
      setSettings({
        ...settings,
        [name]: e.target.type === 'checkbox' ? checked : value
      });
    }
  };

  const handleSave = () => {
    console.log('Settings saved:', settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const TabPanel = ({ children, value, index }) => {
    return (
      <div role="tabpanel" hidden={value !== index}>
        {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
      </div>
    );
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      
      {saved && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Settings saved successfully!
        </Alert>
      )}
      
      <Paper sx={{ p: 3 }}>
        <Tabs value={tab} onChange={handleTabChange} aria-label="settings tabs">
          <Tab label="API Settings" />
          <Tab label="Notifications" />
          <Tab label="Backup & Restore" />
        </Tabs>
        
        <TabPanel value={tab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                name="apiKey"
                label="API Key"
                value={settings.apiKey}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                name="secretKey"
                label="Secret Key"
                type="password"
                value={settings.secretKey}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                name="passphrase"
                label="Passphrase"
                type="password"
                value={settings.passphrase}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    name="demoMode"
                    checked={settings.demoMode}
                    onChange={handleChange}
                  />
                }
                label="Use Demo Mode (Simulated Trading)"
              />
            </Grid>
          </Grid>
        </TabPanel>
        
        <TabPanel value={tab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    name="notifications.enableEmailNotifications"
                    checked={settings.notifications.enableEmailNotifications}
                    onChange={handleChange}
                  />
                }
                label="Enable Email Notifications"
              />
            </Grid>
            
            {settings.notifications.enableEmailNotifications && (
              <Grid item xs={12}>
                <TextField
                  name="notifications.email"
                  label="Email Address"
                  type="email"
                  value={settings.notifications.email}
                  onChange={handleChange}
                  fullWidth
                />
              </Grid>
            )}
            
            <Grid item xs={12}>
              <Typography variant="subtitle1">Notification Triggers</Typography>
              <FormControlLabel
                control={
                  <Switch
                    name="notifications.notifyOnTrade"
                    checked={settings.notifications.notifyOnTrade}
                    onChange={handleChange}
                  />
                }
                label="Notify on Trade Execution"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    name="notifications.notifyOnError"
                    checked={settings.notifications.notifyOnError}
                    onChange={handleChange}
                  />
                }
                label="Notify on Bot Errors"
              />
            </Grid>
          </Grid>
        </TabPanel>
        
        <TabPanel value={tab} index={2}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Backup Data
            </Typography>
            <Button variant="contained" color="primary">
              Export All Data
            </Button>
          </Box>
          
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Restore Data
            </Typography>
            <Button variant="outlined" color="primary" component="label">
              Choose Backup File
              <input type="file" hidden />
            </Button>
          </Box>
        </TabPanel>
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button variant="contained" color="primary" onClick={handleSave}>
            Save Settings
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default Settings;
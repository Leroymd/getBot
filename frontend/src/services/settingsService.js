import api from './api';

export const getSettings = async () => {
  try {
    return await api.get('/settings');
  } catch (error) {
    console.error('Error getting settings:', error);
    // Временные данные
    return {
      apiKey: '',
      secretKey: '',
      passphrase: '',
      demoMode: true,
      notifications: {
        enableEmail: false,
        email: '',
        onTrade: true,
        onError: true
      }
    };
  }
};

export const updateSettings = async (settings) => {
  try {
    return await api.post('/settings', settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return settings;
  }
};
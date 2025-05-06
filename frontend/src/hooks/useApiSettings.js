import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../services/settingsService';

const useApiSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const data = await getSettings();
        setSettings(data);
        setError(null);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const saveSettings = async (newSettings) => {
    try {
      setLoading(true);
      const data = await updateSettings(newSettings);
      setSettings(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { settings, loading, error, saveSettings };
};

export default useApiSettings;
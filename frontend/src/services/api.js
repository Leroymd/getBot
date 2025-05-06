// frontend/src/services/api.js
import axios from 'axios';

// Создаем инстанс axios с базовым URL
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 30000 // 30 секунд
});

// Перехватчик запросов для добавления заголовков
api.interceptors.request.use(
  (config) => {
    // Можно добавить токены авторизации или другие заголовки
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Перехватчик ответов для обработки ошибок
api.interceptors.response.use(
  (response) => {
    // Извлекаем данные из ответа
    return response.data;
  },
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default api;
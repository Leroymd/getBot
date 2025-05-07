// frontend/src/services/api.js
import axios from 'axios';

// Создаем инстанс axios с базовым URL и настройками
const api = axios.create({
  baseURL: 'http://localhost:5000/api', // Убедитесь, что это совпадает с адресом вашего бэкенда
  headers: {
    'Content-Type': 'application/json',
  },
  // Настройки для CORS
  withCredentials: true // Разрешаем отправку куки между доменами
});

// Интерцептор для обработки запросов
api.interceptors.request.use(
  (config) => {
    // Можно добавить токен авторизации или другие заголовки
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Интерцептор для обработки ответов
api.interceptors.response.use(
  (response) => {
    // Возвращаем данные из ответа
    return response.data;
  },
  (error) => {
    // Обработка ошибок
    console.error('API Error:', error);

    // Если ошибка связана с CORS, добавляем информативное сообщение
    if (error.message === 'Network Error') {
      console.error('Possible CORS issue. Check server CORS settings.');
    }
    
    // Возвращаем reject промиса с ошибкой для дальнейшей обработки
    return Promise.reject(error);
  }
);

export default api;
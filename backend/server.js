// backend/server.js
// Обновленный файл server.js с подключением к MongoDB

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./api/routes');
const connectDB = require('./database/db');

// Инициализация app
const app = express();
const PORT = process.env.PORT || 5000;

// Настройка CORS для разрешения запросов с фронтенда
const corsOptions = {
  origin: 'http://localhost:3000', // Разрешаем запросы только с нашего фронтенда
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Разрешаем отправку куки и заголовков авторизации
};

// Применяем middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('dev')); // Логирование запросов

// Подключаем маршруты API
app.use('/api', routes);

// Middleware для обработки ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'SERVER_ERROR'
  });
});

// Функция запуска сервера
const startServer = async () => {
  try {
    // Подключаемся к MongoDB
    await connectDB();
    
    // Запускаем сервер
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}/api`);
      console.log(`CORS enabled for origin: ${corsOptions.origin}`);
    });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    
    // Если не удалось подключиться к базе данных, но мы в режиме разработки,
    // все равно запускаем сервер с заглушками для методов базы данных
    if (process.env.NODE_ENV === 'development') {
      console.warn('Starting server without database connection in development mode');
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT} (WITHOUT DATABASE CONNECTION)`);
        console.log(`API available at http://localhost:${PORT}/api`);
        console.log(`CORS enabled for origin: ${corsOptions.origin}`);
      });
    }
  }
};

// Запускаем сервер
startServer();
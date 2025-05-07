// backend/database/db.js
// Создайте этот файл, если его еще нет

const mongoose = require('mongoose');
const config = require('../config');

// Опции подключения
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Таймаут выбора сервера: 5 секунд
  socketTimeoutMS: 45000, // Таймаут сокета: 45 секунд
  family: 4 // Использовать IPv4, пропустить попытки IPv6
};

// Функция подключения к базе данных
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.dbUri, options);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    // Устанавливаем заглушку для методов findOne, чтобы избежать таймаутов
    if (process.env.NODE_ENV === 'development') {
      setupFallbackMethods();
    }
    return null;
  }
};

// Настройка заглушек для работы без базы данных (только для разработки)
const setupFallbackMethods = () => {
  console.warn('Setting up fallback methods for database operations (development mode only)');
  
  // Оригинальная функция Model.findOne
  const originalFindOne = mongoose.Model.findOne;
  
  // Переопределяем findOne для возврата null вместо ожидания таймаута
  mongoose.Model.findOne = function mockFindOne() {
    console.warn(`[DB FALLBACK] findOne called on ${this.modelName} without database connection`);
    return Promise.resolve(null);
  };
  
  // Сохраняем оригинальную функцию для возможности отката
  mongoose.Model._originalFindOne = originalFindOne;
};

// Обработчик события отключения от базы данных
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Обработчик события ошибки
mongoose.connection.on('error', (err) => {
  console.error(`MongoDB connection error: ${err.message}`);
});

// Экспортируем подключение
module.exports = connectDB;
// backend/config/index.js
require('dotenv').config(); // Подключаем .env файл

// Выводим информацию о настройках API для отладки
console.log('=== BitGet API Configuration ===');
console.log('API Key:', process.env.BITGET_API_KEY ? 
  `${process.env.BITGET_API_KEY.substring(0, 4)}...` : 'Not set');
console.log('Secret Key:', process.env.BITGET_SECRET_KEY ? 
  'Set (hidden)' : 'Not set');
console.log('Passphrase:', process.env.BITGET_PASSPHRASE ? 
  'Set (hidden)' : 'Not set');
console.log('Demo Mode:', process.env.BITGET_DEMO === 'true' ? 
  'Enabled' : 'Disabled');
console.log('================================');

// Конфигурация MongoDB URL
const getMongoURI = () => {
  // Читаем из .env файла
  const mongoURI = process.env.MONGODB_URI;
  
  // Если URI есть в .env, используем его
  if (mongoURI) {
    return mongoURI;
  }
  
  // Иначе возвращаем локальный URI с именем базы данных
  return 'mongodb://localhost:27017/bitget-bot';
};

// Проверяем, работаем ли мы в режиме без базы данных
const isDbLessMode = () => {
  return process.env.DB_LESS_MODE === 'true';
};

module.exports = {
  port: process.env.PORT || 5000,
  dbUri: getMongoURI(),
  dbLessMode: isDbLessMode(),
  bitget: {
    apiUrl: 'https://api.bitget.com',
    apiKey: process.env.BITGET_API_KEY || '',
    secretKey: process.env.BITGET_SECRET_KEY || '',
    passphrase: process.env.BITGET_PASSPHRASE || '',
    demo: process.env.BITGET_DEMO === 'true'
  }
};
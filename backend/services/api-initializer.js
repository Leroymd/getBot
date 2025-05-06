// api-initializer.js
const BitgetAPI = require('./BitgetAPI');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Загрузка переменных окружения из .env файла
dotenv.config();

// Путь к файлу ключей (если используется)
const KEYS_FILE = path.join(__dirname, '..', '.env');

/**
 * Проверяет наличие и валидность ключей API
 * @returns {Promise<boolean>} Результат проверки
 */
async function validateApiKeys() {
  console.log('🔑 Проверка API ключей...');
  
  try {
    // Проверка наличия ключей в переменных окружения
    if (!process.env.API_KEY || !process.env.SECRET_KEY || !process.env.PASSPHRASE) {
      console.error('❌ API ключи не настроены в переменных окружения');
      console.error('📋 Необходимо указать API_KEY, SECRET_KEY и PASSPHRASE в файле .env');
      
      // Проверка наличия файла .env
      if (!fs.existsSync(KEYS_FILE)) {
        console.error('❌ Файл .env не найден!');
        
        // Создаем шаблон файла .env
        const envTemplate = `# API ключи для биржи BitGet
API_KEY=your_api_key_here
SECRET_KEY=your_secret_key_here
PASSPHRASE=your_passphrase_here
BITGET_DEMO=false

# Настройки сервера
PORT=5000
NODE_ENV=development

# Telegram Bot (опционально)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Другие настройки
`;
        
        // Записываем шаблон в файл
        fs.writeFileSync(KEYS_FILE, envTemplate, 'utf8');
        console.log('📝 Создан шаблон файла .env. Пожалуйста, заполните его вашими ключами API.');
      }
      
      return false;
    }
    
    // Создание экземпляра API и проверка ключей
    const api = new BitgetAPI();
    const isValid = await api.validateKeys(false);
    
    if (!isValid) {
      console.error('❌ Проверка API ключей не удалась!');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Ошибка при проверке API ключей:', error.message);
    return false;
  }
}

/**
 * Инициализирует API и проверяет ключи
 * @param {boolean} requireValidKeys - Требовать валидные ключи для продолжения
 * @returns {Promise<Object>} Объект с результатом инициализации
 */
async function initializeAPI(requireValidKeys = true) {
  try {
    // Проверка валидности ключей
    const keysValid = await validateApiKeys();
    
    if (!keysValid && requireValidKeys) {
      throw new Error('API ключи недействительны или отсутствуют. Невозможно продолжить.');
    }
    
    // Создание экземпляра API
    const api = new BitgetAPI();
    
    return {
      success: true,
      api,
      keysValid
    };
  } catch (error) {
    console.error('❌ Ошибка инициализации API:', error.message);
    
    return {
      success: false,
      error: error.message,
      keysValid: false
    };
  }
}

module.exports = {
  validateApiKeys,
  initializeAPI
};
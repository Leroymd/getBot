// backend/api/models/BotConfig.js
const mongoose = require('mongoose');

const botConfigSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true
  },
  config: {
    timeframe: String,
    leverage: Number,
    initialBalance: Number,
    trailingStop: Number,
    maxDCAOrders: Number,
    dcaPriceStep: Number,
    dcaMultiplier: Number,
    maxTradeDuration: Number,
    reinvestment: Number,
    enabled: Boolean
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Обновление даты при изменении
botConfigSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('BotConfig', botConfigSchema);


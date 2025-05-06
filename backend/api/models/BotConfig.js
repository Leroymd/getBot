// backend/api/models/BotConfig.js
const mongoose = require('mongoose');

const botConfigSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true
  },
  activeStrategy: {
    type: String,
    enum: ['DCA', 'SCALPING', 'AUTO'],
    default: 'AUTO'
  },
  common: {
    enabled: {
      type: Boolean,
      default: true
    },
    leverage: {
      type: Number,
      default: 10
    },
    initialBalance: {
      type: Number,
      default: 100
    },
    reinvestment: {
      type: Number,
      default: 100
    }
  },
  dca: {
    maxDCAOrders: {
      type: Number,
      default: 5
    },
    dcaPriceStep: {
      type: Number,
      default: 1.5
    },
    dcaMultiplier: {
      type: Number,
      default: 1.5
    },
    maxTradeDuration: {
      type: Number,
      default: 240 // в минутах, 4 часа
    },
    trailingStop: {
      type: Number,
      default: 0.5
    }
  },
  scalping: {
    timeframe: {
      type: String,
      default: '1m'
    },
    profitTarget: {
      type: Number,
      default: 0.5
    },
    stopLoss: {
      type: Number,
      default: 0.3
    },
    maxTradeDuration: {
      type: Number,
      default: 30 // в минутах
    },
    minVolatility: {
      type: Number,
      default: 0.2
    },
    maxSpread: {
      type: Number,
      default: 0.1
    },
    useTrailingStop: {
      type: Boolean,
      default: true
    },
    trailingStopActivation: {
      type: Number,
      default: 0.2
    },
    trailingStopDistance: {
      type: Number,
      default: 0.1
    }
  },
  autoSwitching: {
    enabled: {
      type: Boolean,
      default: true
    },
    volatilityThreshold: {
      type: Number,
      default: 1.5 // в процентах
    },
    volumeThreshold: {
      type: Number,
      default: 2.0 // множитель от среднего объема
    },
    trendStrengthThreshold: {
      type: Number,
      default: 0.6 // от 0 до 1
    }
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
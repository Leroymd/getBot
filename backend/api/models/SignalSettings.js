// backend/models/SignalSettings.js
const mongoose = require('mongoose');

const signalSettingsSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true
  },
  
  // Общие настройки сигналов
  general: {
    // Чувствительность к сигналам (0-100%)
    sensitivity: {
      type: Number,
      default: 50,
      min: 0,
      max: 100
    },
    
    // Фильтр по волатильности
    minVolatility: {
      type: Number,
      default: 0.2,
      min: 0
    },
    
    maxVolatility: {
      type: Number,
      default: 5.0,
      min: 0
    },
    
    // Минимальный объем для торговли
    minVolume: {
      type: Number,
      default: 10000,
      min: 0
    },
    
    // Подтверждение сигнала (количество подтверждающих индикаторов)
    confirmationRequired: {
      type: Number,
      default: 2,
      min: 1
    }
  },
  
  // Индикаторы технического анализа
  indicators: {
    // Настройки RSI
    rsi: {
      enabled: {
        type: Boolean,
        default: true
      },
      period: {
        type: Number,
        default: 14,
        min: 1
      },
      overbought: {
        type: Number,
        default: 70,
        min: 50,
        max: 100
      },
      oversold: {
        type: Number,
        default: 30,
        min: 0,
        max: 50
      },
      weight: {
        type: Number,
        default: 1.0,
        min: 0.1,
        max: 10
      }
    },
    
    // Настройки MACD
    macd: {
      enabled: {
        type: Boolean,
        default: true
      },
      fastPeriod: {
        type: Number,
        default: 12,
        min: 1
      },
      slowPeriod: {
        type: Number,
        default: 26,
        min: 1
      },
      signalPeriod: {
        type: Number,
        default: 9,
        min: 1
      },
      weight: {
        type: Number,
        default: 1.0,
        min: 0.1,
        max: 10
      }
    },
    
    // Настройки полос Боллинджера
    bollinger: {
      enabled: {
        type: Boolean,
        default: true
      },
      period: {
        type: Number,
        default: 20,
        min: 1
      },
      deviation: {
        type: Number,
        default: 2.0,
        min: 0.1
      },
      weight: {
        type: Number,
        default: 1.0,
        min: 0.1,
        max: 10
      }
    },
    
    // Настройки скользящих средних
    ma: {
      enabled: {
        type: Boolean,
        default: true
      },
      fastPeriod: {
        type: Number,
        default: 10,
        min: 1
      },
      slowPeriod: {
        type: Number,
        default: 50,
        min: 1
      },
      type: {
        type: String,
        enum: ['SMA', 'EMA', 'WMA'],
        default: 'EMA'
      },
      weight: {
        type: Number,
        default: 1.0,
        min: 0.1,
        max: 10
      }
    }
  },
  
  // Условия для входа в позицию
  entryConditions: {
    // Использовать тренд для определения направления входа
    useTrendDetection: {
      type: Boolean,
      default: true
    },
    
    // Минимальная сила тренда (0-1)
    minTrendStrength: {
      type: Number,
      default: 0.3,
      min: 0,
      max: 1
    },
    
    // Торговать против тренда
    allowCounterTrend: {
      type: Boolean,
      default: false
    },
    
    // Требовать подтверждения от объема
    requireVolumeConfirmation: {
      type: Boolean,
      default: true
    },
    
    // Требуемый коэффициент соотношения объема
    minVolumeRatio: {
      type: Number,
      default: 1.2,
      min: 0
    },
    
    // Разрешить торговлю во время новостей
    allowDuringNews: {
      type: Boolean,
      default: false
    }
  },
  
  // Условия для выхода из позиции
  exitConditions: {
    // Использовать трейлинг-стоп
    useTrailingStop: {
      type: Boolean,
      default: true
    },
    
    // Процент активации трейлинг-стопа (от вход. цены)
    trailingStopActivation: {
      type: Number,
      default: 0.5,
      min: 0
    },
    
    // Дистанция трейлинг-стопа (%)
    trailingStopDistance: {
      type: Number,
      default: 0.3,
      min: 0
    },
    
    // Максимальная длительность сделки (минуты)
    maxTradeDuration: {
      type: Number,
      default: 240,
      min: 1
    },
    
    // Закрывать при разворотном сигнале
    closeOnReversalSignal: {
      type: Boolean,
      default: true
    },
    
    // Закрывать при ослаблении тренда
    closeOnWeakTrend: {
      type: Boolean,
      default: false
    },
    
    // Минимальная прибыль для закрытия (%)
    minProfitToClose: {
      type: Number,
      default: 0.5,
      min: 0
    }
  },
  
  // Стратегия-специфичные настройки
  strategySpecific: {
    // Настройки для DCA-стратегии
    dca: {
      // Шаг цены для DCA-ордеров (%)
      priceStep: {
        type: Number,
        default: 1.5,
        min: 0.1
      },
      
      // Множитель размера ордера
      sizeMultiplier: {
        type: Number,
        default: 1.5,
        min: 1
      },
      
      // Максимальное количество DCA-ордеров
      maxOrders: {
        type: Number,
        default: 5,
        min: 1
      },
      
      // Использовать прогрессивный шаг цены
      useProgressiveStep: {
        type: Boolean,
        default: false
      }
    },
    
    // Настройки для скальпинг-стратегии
    scalping: {
      // Целевая прибыль (%)
      profitTarget: {
        type: Number,
        default: 0.5,
        min: 0.1
      },
      
      // Стоп-лосс (%)
      stopLoss: {
        type: Number,
        default: 0.3,
        min: 0.1
      },
      
      // Максимальный спред для входа (%)
      maxSpread: {
        type: Number,
        default: 0.1,
        min: 0
      },
      
      // Требовать разгонный импульс цены
      requireMomentum: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // Фильтры рыночных условий
  marketFilters: {
    // Запрет торговли в сильной волатильности
    avoidHighVolatility: {
      type: Boolean,
      default: true
    },
    
    // Запрет торговли при низкой ликвидности
    avoidLowLiquidity: {
      type: Boolean,
      default: true
    },
    
    // Предпочтение для определенных типов рынка
    preferredMarketTypes: {
      type: [String],
      enum: ['TRENDING', 'RANGING', 'VOLATILE'],
      default: ['TRENDING', 'RANGING']
    },
    
    // Учитывать общий тренд рынка (BTC)
    considerMarketTrend: {
      type: Boolean,
      default: true
    }
  },
  
  // Мониторинг производительности сигналов
  performance: {
    // Включить адаптивные настройки
    enableAdaptiveSettings: {
      type: Boolean,
      default: false
    },
    
    // Период для анализа производительности (дни)
    analysisPeriod: {
      type: Number,
      default: 7,
      min: 1
    },
    
    // Минимальное количество сделок для адаптации
    minTradesForAdaptation: {
      type: Number,
      default: 10,
      min: 5
    },
    
    // Максимальное изменение параметров (%)
    maxParameterChange: {
      type: Number,
      default: 20,
      min: 5,
      max: 50
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
signalSettingsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const SignalSettings = mongoose.model('SignalSettings', signalSettingsSchema);

module.exports = SignalSettings;
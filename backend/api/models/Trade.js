// backend/api/models/Trade.js
const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true
  },
  botId: {
    type: String,
    required: true
  },
  direction: {
    type: String,
    enum: ['LONG', 'SHORT'],
    required: true
  },
  entryPrice: {
    type: Number,
    required: true
  },
  exitPrice: {
    type: Number
  },
  quantity: {
    type: Number,
    required: true
  },
  entryTime: {
    type: Date,
    default: Date.now
  },
  exitTime: {
    type: Date
  },
  profitLoss: {
    type: Number
  },
  status: {
    type: String,
    enum: ['OPEN', 'CLOSED'],
    default: 'OPEN'
  },
  dcaCount: {
    type: Number,
    default: 0
  },
  strategy: {
    type: String,
    enum: ['DCA', 'SCALPING'],
    default: 'DCA'
  },
  closeReason: {
    type: String,
    enum: ['TAKE_PROFIT', 'STOP_LOSS', 'TRAILING_STOP', 'MAX_DURATION', 'MANUAL', 'PNL_STAGNANT']
  },
  takeProfitPrice: {
    type: Number
  },
  stopLossPrice: {
    type: Number
  },
  marketConditions: {
    type: Object
  }
});

module.exports = mongoose.model('Trade', tradeSchema);
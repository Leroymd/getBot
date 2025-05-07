// backend/api/models/PairScanResult.js

const mongoose = require('mongoose');

const pairScanHistorySchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  volume: {
    type: Number,
    required: true
  },
  volatility: {
    type: Number,
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  recommendedStrategy: {
    type: String,
    enum: ['DCA', 'SCALPING', 'AUTO'],
    default: 'DCA'
  }
});

const pairScanResultSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true
  },
  baseCoin: {
    type: String,
    required: true
  },
  quoteCoin: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  priceChange24h: {
    type: Number,
    required: true
  },
  volume24h: {
    type: Number,
    required: true
  },
  spread: {
    type: Number,
    required: true
  },
  volatility: {
    type: Number,
    required: true
  },
  trendStrength: {
    type: Number,
    required: true
  },
  marketType: {
    type: String,
    enum: ['TRENDING', 'VOLATILE', 'RANGING', 'UNKNOWN'],
    default: 'UNKNOWN'
  },
  recommendedStrategy: {
    type: String,
    enum: ['DCA', 'SCALPING', 'AUTO'],
    default: 'DCA'
  },
  score: {
    type: Number,
    required: true
  },
  firstScanTime: {
    type: Date,
    default: Date.now
  },
  lastScanTime: {
    type: Date,
    default: Date.now
  },
  history: [pairScanHistorySchema],
});

module.exports = mongoose.model('PairScanResult', pairScanResultSchema);
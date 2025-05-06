// backend/server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const apiRoutes = require('./api/routes');
const config = require('./config');
const morgan = require('morgan'); // ��������� ����������� �������� (����������: npm install morgan)

const app = express();

// Middleware ��� ����������� ��������
app.use(morgan('dev'));

// Middleware ��� CORS � ��������� JSON
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware ��� ����������� ������ API
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function (data) {
    // �������� ������ � ��������
    if (res.statusCode >= 400) {
      console.error(`Error response ${res.statusCode}:`, data);
    }
    originalSend.call(this, data);
  };
  next();
});

// API ��������
app.use('/api', apiRoutes);

// ��������� ������
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// ����������� � ���� ������
mongoose.connect(config.dbUri)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('Could not connect to MongoDB', err);
    process.exit(1); // ����� ��� ������ ����������� � ���� ������
  });

// �������� ������� API ������ BitGet
if (!config.bitget.apiKey || !config.bitget.secretKey || !config.bitget.passphrase) {
  console.warn('WARNING: BitGet API keys are not set. API functionality will be limited. Check your environment variables.');
}

// ������ �������
const PORT = config.port || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`BitGet API Version: ${config.bitget.apiVersion}`);
  console.log(`Demo mode: ${config.bitget.demo ? 'Enabled' : 'Disabled'}`);
});

// ���������� ���������� ������ ��� ��������� ��������
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

function gracefulShutdown() {
  console.log('Shutting down gracefully...');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
}
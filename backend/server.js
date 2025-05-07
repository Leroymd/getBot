// backend/server.js
// ����������� ���� server.js � ������������ � MongoDB

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./api/routes');
const connectDB = require('./database/db');

// ������������� app
const app = express();
const PORT = process.env.PORT || 5000;

// ��������� CORS ��� ���������� �������� � ���������
const corsOptions = {
  origin: 'http://localhost:3000', // ��������� ������� ������ � ������ ���������
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // ��������� �������� ���� � ���������� �����������
};

// ��������� middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('dev')); // ����������� ��������

// ���������� �������� API
app.use('/api', routes);

// Middleware ��� ��������� ������
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'SERVER_ERROR'
  });
});

// ������� ������� �������
const startServer = async () => {
  try {
    // ������������ � MongoDB
    await connectDB();
    
    // ��������� ������
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}/api`);
      console.log(`CORS enabled for origin: ${corsOptions.origin}`);
    });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    
    // ���� �� ������� ������������ � ���� ������, �� �� � ������ ����������,
    // ��� ����� ��������� ������ � ���������� ��� ������� ���� ������
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

// ��������� ������
startServer();
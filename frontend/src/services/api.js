// frontend/src/services/api.js
import axios from 'axios';

// ������� ������� axios � ������� URL
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 30000 // 30 ������
});

// ����������� �������� ��� ���������� ����������
api.interceptors.request.use(
  (config) => {
    // ����� �������� ������ ����������� ��� ������ ���������
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ����������� ������� ��� ��������� ������
api.interceptors.response.use(
  (response) => {
    // ��������� ������ �� ������
    return response.data;
  },
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default api;
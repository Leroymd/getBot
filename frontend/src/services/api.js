// frontend/src/services/api.js
import axios from 'axios';

// ������� ������� axios � ������� URL � �����������
const api = axios.create({
  baseURL: 'http://localhost:5000/api', // ���������, ��� ��� ��������� � ������� ������ �������
  headers: {
    'Content-Type': 'application/json',
  },
  // ��������� ��� CORS
  withCredentials: true // ��������� �������� ���� ����� ��������
});

// ����������� ��� ��������� ��������
api.interceptors.request.use(
  (config) => {
    // ����� �������� ����� ����������� ��� ������ ���������
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ����������� ��� ��������� �������
api.interceptors.response.use(
  (response) => {
    // ���������� ������ �� ������
    return response.data;
  },
  (error) => {
    // ��������� ������
    console.error('API Error:', error);

    // ���� ������ ������� � CORS, ��������� ������������� ���������
    if (error.message === 'Network Error') {
      console.error('Possible CORS issue. Check server CORS settings.');
    }
    
    // ���������� reject ������� � ������� ��� ���������� ���������
    return Promise.reject(error);
  }
);

export default api;
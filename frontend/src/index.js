import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Создаем переменную для хранения корня
let root;

// Получаем DOM-элемент, в который будем монтировать приложение
const rootElement = document.getElementById('root');

// Проверяем, есть ли уже созданный корень для этого элемента
// React 18 добавляет специальное свойство к элементу при создании корня
if (!rootElement._reactRootContainer) {
  // Если корня еще нет, создаем новый
  root = ReactDOM.createRoot(rootElement);
} else {
  // В противном случае используем существующий корень
  // Вместо создания нового
  console.log('Using existing root');
}

// Рендерим приложение
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
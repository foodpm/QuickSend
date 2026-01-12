import React from 'react';
import ReactDOM from 'react-dom/client';
import Admin from './src/pages/Admin.tsx';
import './tailwind.css';
import './src/i18n';
import './script.js';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <Admin />
    </React.StrictMode>
  );
}

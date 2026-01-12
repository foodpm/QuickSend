import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './src/i18n';
import Home from './src/pages/Home.tsx';
import Admin from './src/pages/Admin.tsx';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Home from './src/pages/Home.tsx';

const App = () => {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  const base = path.startsWith('/dist') ? '/dist' : '';
  return (
    <BrowserRouter basename={base}>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

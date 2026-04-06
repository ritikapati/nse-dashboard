import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Heatmap from './Heatmap';
import Indexes from './Indexes';
import LandingPage from './LandingPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/stock-analysis" element={<Heatmap />} />
          <Route path="/index-analysis" element={<Indexes />} />
          <Route path="/heatmap" element={<Navigate to="/stock-analysis" replace />} />
          <Route path="/indexes" element={<Navigate to="/index-analysis" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

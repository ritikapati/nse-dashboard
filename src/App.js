import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './Dashboard';
import Heatmap from './Heatmap';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/heatmap" element={<Heatmap />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

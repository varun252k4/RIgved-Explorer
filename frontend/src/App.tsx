import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SearchPage from './pages/SearchPage';
import AIAssistant from './pages/AIAssistant/AIAssistant';
import AudioPlayerPage from './pages/AudioPlayerPage';
import './App.css';

const App: React.FC = () => {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/ai-assistant" element={<AIAssistant />} />   
          < Route path="/audio-player" element={<AudioPlayerPage />} />
          {/* Add more routes as we build more pages */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
import React, { useState, useEffect, useRef } from 'react';
import './AudioPlayerPage.css';
import Navbar from '../components/Navbar/Navbar';

interface Rik {
  rik_number: number;
  samhita_devanagari: string;
  padapatha_devanagari: string;
  transliteration: string;
}

interface SuktaView {
  mandala: number;
  sukta: number;
  audio_url: string;
  riks: Rik[];
}

interface Mandala {
  id: number;
  name: string;
  sukta_count: number;
}

const AudioPlayerPage: React.FC = () => {
  // State management
  const [mandalas, setMandalas] = useState<Mandala[]>([]);
  const [selectedMandala, setSelectedMandala] = useState<number>(1);
  const [selectedSukta, setSelectedSukta] = useState<number>(1);
  const [suktas, setSuktas] = useState<number[]>([]);
  const [suktaView, setSuktaView] = useState<SuktaView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentRikIndex, setCurrentRikIndex] = useState(0);
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch mandalas on component mount
  useEffect(() => {
    fetchMandalas();
  }, []);

  // Fetch suktas when mandala changes
  useEffect(() => {
    if (selectedMandala) {
      fetchSuktas(selectedMandala);
    }
  }, [selectedMandala]);

  // Enhanced background visualization
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawVisualization = () => {
      if (!canvas || !ctx) return;

      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      // Clear with enhanced gradient
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, 'rgba(255, 248, 240, 0.3)');
      gradient.addColorStop(0.5, 'rgba(255, 235, 215, 0.2)');
      gradient.addColorStop(1, 'rgba(255, 222, 190, 0.3)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Enhanced dynamic elements
      const time = Date.now() * 0.001;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Larger pulsing circles
      for (let i = 0; i < 12; i++) {
        const radius = 100 + Math.sin(time + i * 0.3) * 60;
        const alpha = 0.15 + Math.sin(time * 2 + i) * 0.1;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 153, 51, ${alpha})`;
        ctx.fill();
      }

      // Enhanced frequency waves
      const barCount = 80;
      const barWidth = canvas.width / barCount;
      
      for (let i = 0; i < barCount; i++) {
        const height = 40 + Math.sin(time * 5 + i * 0.2) * 35;
        const x = i * barWidth;
        const y = canvas.height - height;
        
        const barGradient = ctx.createLinearGradient(x, y, x, canvas.height);
        barGradient.addColorStop(0, `rgba(255, 153, 51, ${0.6 + Math.sin(time + i) * 0.3})`);
        barGradient.addColorStop(1, `rgba(255, 179, 102, ${0.4 + Math.sin(time * 2 + i) * 0.2})`);
        
        ctx.fillStyle = barGradient;
        ctx.fillRect(x, y, barWidth - 1, height);
      }

      // Add floating particles
      for (let i = 0; i < 20; i++) {
        const x = (Math.sin(time * 0.5 + i) * canvas.width / 2) + centerX;
        const y = (Math.cos(time * 0.7 + i) * canvas.height / 2) + centerY;
        const size = Math.sin(time + i) * 4 + 6;
        
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 215, 0, ${0.3 + Math.sin(time + i) * 0.2})`;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(drawVisualization);
    };

    drawVisualization();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Handle verse transitions based on audio time
  useEffect(() => {
    if (!audioRef.current || !suktaView) return;

    const handleTimeUpdate = () => {
      const time = audioRef.current!.currentTime;
      setCurrentTime(time);

      if (duration > 0 && suktaView.riks.length > 0) {
        const timePerVerse = duration / suktaView.riks.length;
        const newIndex = Math.floor(time / timePerVerse);
        
        if (newIndex !== currentRikIndex) {
          setCurrentRikIndex(newIndex);
        }
      }
    };

    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    return () => audioRef.current?.removeEventListener('timeupdate', handleTimeUpdate);
  }, [duration, suktaView, currentRikIndex]);

  const fetchMandalas = async () => {
    try {
      const response = await fetch('/mandalas');
      if (!response.ok) throw new Error('Failed to fetch mandalas');
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setMandalas(data);
      } else {
        // Fallback data
        setMandalas([
          { id: 1, name: 'Mandala 1', sukta_count: 191 },
          { id: 2, name: 'Mandala 2', sukta_count: 43 },
          { id: 3, name: 'Mandala 3', sukta_count: 62 },
          { id: 4, name: 'Mandala 4', sukta_count: 58 },
          { id: 5, name: 'Mandala 5', sukta_count: 87 },
          { id: 6, name: 'Mandala 6', sukta_count: 75 },
          { id: 7, name: 'Mandala 7', sukta_count: 104 },
          { id: 8, name: 'Mandala 8', sukta_count: 103 },
          { id: 9, name: 'Mandala 9', sukta_count: 114 },
          { id: 10, name: 'Mandala 10', sukta_count: 191 }
        ]);
      }
    } catch (err) {
      console.error('Error fetching mandalas:', err);
      // Set fallback mandalas
      setMandalas([
        { id: 1, name: 'Mandala 1', sukta_count: 191 },
        { id: 2, name: 'Mandala 2', sukta_count: 43 },
        { id: 3, name: 'Mandala 3', sukta_count: 62 },
        { id: 4, name: 'Mandala 4', sukta_count: 58 },
        { id: 5, name: 'Mandala 5', sukta_count: 87 },
        { id: 6, name: 'Mandala 6', sukta_count: 75 },
        { id: 7, name: 'Mandala 7', sukta_count: 104 },
        { id: 8, name: 'Mandala 8', sukta_count: 103 },
        { id: 9, name: 'Mandala 9', sukta_count: 114 },
        { id: 10, name: 'Mandala 10', sukta_count: 191 }
      ]);
    }
  };

  const fetchSuktas = async (mandalaId: number) => {
    try {
      const response = await fetch(`/mandala/${mandalaId}/suktas`);
      if (!response.ok) throw new Error('Failed to fetch suktas');
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setSuktas(data);
      } else {
        const defaultSuktas = Array.from({ length: 50 }, (_, i) => i + 1);
        setSuktas(defaultSuktas);
      }
      
      setSelectedSukta(1);
    } catch (err) {
      console.error('Error fetching suktas:', err);
      const defaultSuktas = Array.from({ length: 50 }, (_, i) => i + 1);
      setSuktas(defaultSuktas);
    }
  };

  const loadSukta = async () => {
    if (!selectedMandala || !selectedSukta) return;

    setLoading(true);
    setError(null);
    setIsPlaying(false);
    setCurrentRikIndex(0);
    setCurrentTime(0);
    setAudioLoading(true);

    try {
      const response = await fetch(`/mandala/${selectedMandala}/sukta/${selectedSukta}/view`);
      if (!response.ok) throw new Error('Failed to load sukta');
      const data: SuktaView = await response.json();
      setSuktaView(data);
      
      // Reset audio and wait for it to load
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    } catch (err) {
      setError('Failed to load sukta details');
      console.error('Error loading sukta:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = async () => {
    if (!audioRef.current || !suktaView) {
      setError('Audio not loaded properly');
      return;
    }

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // Check if audio is ready to play
        if (audioRef.current.readyState < 3) {
          setAudioLoading(true);
          // Wait for audio to load
          await new Promise((resolve) => {
            audioRef.current!.addEventListener('canplaythrough', resolve, { once: true });
          });
        }
        await audioRef.current.play();
        setIsPlaying(true);
        setAudioLoading(false);
      }
    } catch (err) {
      console.error('Error playing audio:', err);
      setError('Failed to play audio. Please try again.');
      setAudioLoading(false);
    }
  };

  const handleAudioLoad = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsAudioLoaded(true);
      setAudioLoading(false);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current || !suktaView) return;

    const time = audioRef.current.currentTime;
    setCurrentTime(time);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current || !duration) return;

    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleRikClick = (index: number) => {
    if (!audioRef.current || !suktaView || !duration) return;

    const progress = index / suktaView.riks.length;
    const newTime = progress * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setCurrentRikIndex(index);
    
    if (!isPlaying) {
      handlePlayPause();
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Safe text formatting function
  const formatRikText = (text: string | undefined) => {
    if (!text || typeof text !== 'string') {
      return [<div key="0" className="rik-line">Verse text not available</div>];
    }
    
    return text.split('|').map((line, index) => (
      <div key={index} className="rik-line">
        {line.trim()}
      </div>
    ));
  };

  const getCurrentRik = () => {
    if (!suktaView || !suktaView.riks[currentRikIndex]) {
      return null;
    }
    return suktaView.riks[currentRikIndex];
  };

  return (
    <div className="audio-player-page">
      <Navbar />
      {/* Enhanced Background Visualization */}
      <canvas 
        ref={canvasRef} 
        className="background-visualization"
      />

      {/* Header */}
      <div className="search-header">
        <h1>Rigveda Audio Experience</h1>
        <p>Immerse yourself in the sacred sounds with synchronized visual journey</p>
      </div>

      <div className="search-container">
        {/* Selection Section */}
        <div className="search-section">
          <div className="selection-controls">
            <div className="select-group">
              <label>Mandala:</label>
              <select 
                value={selectedMandala} 
                onChange={(e) => setSelectedMandala(Number(e.target.value))}
                className="option-select"
              >
                {mandalas.map(mandala => (
                  <option key={mandala.id} value={mandala.id}>
                    Mandala {mandala.id} ({mandala.sukta_count} Suktas)
                  </option>
                ))}
              </select>
            </div>

            <div className="select-group">
              <label>Sukta:</label>
              <select 
                value={selectedSukta} 
                onChange={(e) => setSelectedSukta(Number(e.target.value))}
                className="option-select"
              >
                {suktas.map(sukta => (
                  <option key={sukta} value={sukta}>
                    Sukta {sukta}
                  </option>
                ))}
              </select>
            </div>

            <button 
              onClick={loadSukta}
              disabled={loading}
              className="search-button"
            >
              {loading ? (
                <div className="button-spinner"></div>
              ) : (
                <>
                  <i className="fas fa-play"></i>
                  Load Sukta
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-triangle"></i>
            {error}
          </div>
        )}

        {/* Loading State */}
        {(loading || audioLoading) && (
          <div className="skeleton-loading">
            <div className="skeleton-verse">
              <div className="skeleton-line skeleton-line--large"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line skeleton-line--medium"></div>
              <div className="skeleton-line"></div>
            </div>
            <div className="skeleton-audio">
              <div className="skeleton-line skeleton-line--progress"></div>
              <div className="skeleton-controls">
                <div className="skeleton-button"></div>
                <div className="skeleton-button skeleton-button--large"></div>
                <div className="skeleton-button"></div>
              </div>
            </div>
            <p className="skeleton-text">Loading sacred verses and audio... Please wait</p>
          </div>
        )}

        {/* Main Verse Display - Single Current Verse */}
        {suktaView && !audioLoading && getCurrentRik() && (
          <div className="verse-display-container">
            <div className="current-verse-card">
              <div className="verse-header">
                <h3>Mandala {suktaView.mandala}, Sukta {suktaView.sukta}</h3>
                <span className="verse-counter">
                  Verse {currentRikIndex + 1} of {suktaView.riks.length}
                </span>
              </div>

              {/* Current Sanskrit Verse - Centered without boundaries */}
              <div className="sanskrit-verse active">
                <div className="sanskrit-text">
                  {formatRikText(getCurrentRik()?.samhita_devanagari)}
                </div>
              </div>

              {/* Translation and Details - Glassmorphic container below */}
              <div className="verse-details-glass">
                <div className="detail-section">
                  <h4>Transliteration</h4>
                  <div className="transliteration-text">
                    {formatRikText(getCurrentRik()?.transliteration)}
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Translation</h4>
                  <div className="translation-text">
                    {getCurrentRik()?.samhita_devanagari.split('|').map((line, idx) => (
                      <p key={idx} className="translation-line">
                        {line.trim()}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Padapatha</h4>
                  <div className="padapatha-text">
                    {getCurrentRik()?.padapatha_devanagari || 'Not available'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Instructions when no content loaded */}
        {!suktaView && !loading && (
          <div className="instructions-section">
            <div className="browse-instructions">
              <div className="instructions-icon">
                <i className="fas fa-music"></i>
              </div>
              <h3>Begin Your Sacred Journey</h3>
              <p>Select a Mandala and Sukta to start experiencing the divine verses</p>
              
              <div className="instruction-step">
                <div className="step-indicator">1</div>
                <div className="step-content">
                  <strong>Select Scriptures</strong>
                  <p>Choose from ancient Mandalas and their sacred Suktas</p>
                </div>
              </div>
              
              <div className="instruction-step">
                <div className="step-indicator">2</div>
                <div className="step-content">
                  <strong>Load Divine Sounds</strong>
                  <p>Load the audio and verses with a single click</p>
                </div>
              </div>
              
              <div className="instruction-step">
                <div className="step-indicator">3</div>
                <div className="step-content">
                  <strong>Immerse & Experience</strong>
                  <p>Watch verses highlight in perfect sync with sacred chants</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Glassmorphism Audio Player */}
      {suktaView && (
        <div className="glass-audio-player">
          <div className="player-content">
            {/* Sukta Info */}
            <div className="player-info">
              <h4>Mandala {suktaView.mandala}, Sukta {suktaView.sukta}</h4>
              <p>Verse {currentRikIndex + 1} of {suktaView.riks.length}</p>
            </div>

            {/* Audio Controls */}
            <div className="player-controls">
              <button 
                className="control-btn prev-btn"
                onClick={() => handleRikClick(Math.max(0, currentRikIndex - 1))}
                disabled={currentRikIndex === 0}
              >
                <i className="fas fa-step-backward"></i>
              </button>

              <button 
                className="control-btn play-pause-btn"
                onClick={handlePlayPause}
                disabled={audioLoading}
              >
                {audioLoading ? (
                  <div className="button-spinner-small"></div>
                ) : isPlaying ? (
                  <i className="fas fa-pause"></i>
                ) : (
                  <i className="fas fa-play"></i>
                )}
              </button>

              <button 
                className="control-btn next-btn"
                onClick={() => handleRikClick(Math.min(suktaView.riks.length - 1, currentRikIndex + 1))}
                disabled={currentRikIndex === suktaView.riks.length - 1}
              >
                <i className="fas fa-step-forward"></i>
              </button>
            </div>

            {/* Progress Bar */}
            <div className="player-progress">
              <span className="time-current">{formatTime(currentTime)}</span>
              
              <div 
                className="progress-bar-glass"
                ref={progressRef}
                onClick={handleProgressClick}
              >
                <div 
                  className="progress-fill-glass"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                >
                  <div className="progress-glow"></div>
                </div>
              </div>
              
              <span className="time-total">{formatTime(duration)}</span>
            </div>

            {/* Volume Control */}
            <div className="player-volume">
              <i className="fas fa-volume-up"></i>
              <div className="volume-slider">
                <div className="volume-level"></div>
              </div>
            </div>
          </div>

          {/* Hidden Audio Element */}
          <audio
            ref={audioRef}
            src={suktaView.audio_url}
            onLoadedData={handleAudioLoad}
            onCanPlayThrough={handleAudioLoad}
            onError={() => {
              setError('Failed to load audio file');
              setAudioLoading(false);
            }}
            preload="auto"
          />
        </div>
      )}
    </div>
  );
};

export default AudioPlayerPage;
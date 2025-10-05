import React, { useEffect, useState } from 'react';
import './VerseCards.css';

interface Verse {
  devanagari: string;
  translation?: string;
  mandala: number;
  sukta: number;
  rik_number: number;
}

const VerseCards: React.FC = () => {
  const [dailyVerse, setDailyVerse] = useState<Verse | null>(null);
  const [randomVerse, setRandomVerse] = useState<Verse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = "http://localhost:8000"; // change this if deployed

const formatVerseText = (text?: string): React.ReactNode => {
  if (!text) return null;

  // Step 1: Remove surrounding quotes, whitespace, and invisible characters
  text = text.replace(/^[\s"“”‘’«»\u200B\u00A0]+|[\s"“”‘’«»\u200B\u00A0]+$/g, "");

  // Step 2: Replace danda and double danda with a consistent split marker "|"
  text = text.replace(/॥/g, "॥|").replace(/।/g, "।|");

  // Step 3: Also split by newlines in case verses come multi-line
  let parts = text.split(/\||\n/).map(p => p.trim()).filter(Boolean);

  // Step 4: Render each part on a separate line
  return parts.map((line, idx) => (
    <div key={idx} style={{ margin: "2px 0", lineHeight: "1.4", textAlign: "center" }}>
      {line}
    </div>
  ));
};

// Fetch Daily Verse
const fetchDailyVerse = async () => {
  try {
    const res = await fetch(`${API_BASE}/daily-verse`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDailyVerse(data);
    } catch (err) {
      console.error("Error fetching daily verse:", err);
      setError("Failed to load daily verse.");
    }
  };

  // Fetch Random Verse (correct list params)
  const fetchRandomVerse = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/random?fields=translation&fields=devanagari`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRandomVerse(data);
    } catch (err) {
      console.error("Error fetching random verse:", err);
      setError("Failed to load random verse.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyVerse();
    fetchRandomVerse();
  }, []);

  return (
    <section className="verse-cards" id="verses">
      <div className="section-title">
        <h2>Daily Inspiration</h2>
        <p>Discover new wisdom each day with our curated verses from the Rigveda</p>
      </div>

      <div className="cards-container">
        {/* --- Daily Verse --- */}
        <div className="verse-card">
          <div className="card-header">
            <h3>Daily Verse</h3>
            <p>Verse for Today</p>
          </div>
          <div className="card-body">
            {dailyVerse ? (
              <>
                <div className="verse-text">“{formatVerseText(dailyVerse?.devanagari)}”</div>
                {dailyVerse.translation && (
                  <div className="verse-translation">“{dailyVerse.translation}”</div>
                )}
                <div className="verse-details">
                  <span>Mandala {dailyVerse.mandala}, Sukta {dailyVerse.sukta}</span>
                  <span>Rik {dailyVerse.rik_number}</span>
                </div>
              </>
            ) : (
              <div className="loading-text">Loading daily verse...</div>
            )}
          </div>
          <div className="card-footer">
            <span><i className="fas fa-calendar-day"></i> {new Date().toLocaleDateString()}</span>
            <button className="refresh-btn" onClick={fetchDailyVerse}>Refresh</button>
          </div>
        </div>

        {/* --- Random Verse --- */}
        <div className="verse-card">
          <div className="card-header">
            <h3>Random Verse</h3>
            <p>Discover Something New</p>
          </div>
          <div className="card-body">
            {loading ? (
              <div className="loading-text">Loading...</div>
            ) : randomVerse ? (
              <>
                <div className="verse-text">“{formatVerseText(randomVerse?.devanagari)}”</div>
                {randomVerse.translation && (
                  <div className="verse-translation">“{randomVerse.translation}”</div>
                )}
                <div className="verse-details">
                  <span>Mandala {randomVerse.mandala}, Sukta {randomVerse.sukta}</span>
                  <span>Rik {randomVerse.rik_number}</span>
                </div>
              </>
            ) : (
              <div className="loading-text">Click “New Verse” to explore!</div>
            )}
          </div>
          <div className="card-footer">
            <span><i className="fas fa-random"></i> Random Selection</span>
            <button className="refresh-btn" onClick={fetchRandomVerse}>
              {loading ? "Loading..." : "New Verse"}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
    </section>
  );
};

export default VerseCards;

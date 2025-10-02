import React, { useState } from 'react';
import './VerseCards.css';

interface Verse {
  text: string;
  mandala: number;
  sukta: number;
  rik: number;
}

const VerseCards: React.FC = () => {
  const [randomVerse, setRandomVerse] = useState<Verse>({
    text: "I invoke Agni, the divine priest of the sacrifice, the bestower of blessings, the radiant, the mighty.",
    mandala: 3,
    sukta: 5,
    rik: 12
  });

  const verses: Verse[] = [
    {
      text: "Let noble thoughts come to us from every side, from the earth and heavens, from mountains and oceans.",
      mandala: 1,
      sukta: 89,
      rik: 1
    },
    {
      text: "The One who is the maker of all, who is supreme in power, and who encompasses all beings - may He grant us wisdom.",
      mandala: 10,
      sukta: 121,
      rik: 10
    },
    {
      text: "O Dawn, shine upon us with your radiant light, bringing us wealth and driving away darkness.",
      mandala: 1,
      sukta: 113,
      rik: 16
    },
    {
      text: "The waters that flow, they are the ones that bring us life; they are the ones that cleanse and purify.",
      mandala: 7,
      sukta: 49,
      rik: 3
    }
  ];

  const handleNewVerse = () => {
    const randomIndex = Math.floor(Math.random() * verses.length);
    setRandomVerse(verses[randomIndex]);
  };

  return (
    <section className="verse-cards" id="verses">
      <div className="section-title">
        <h2>Daily Inspiration</h2>
        <p>Discover new wisdom each day with our curated verses from the Rigveda</p>
      </div>
      <div className="cards-container">
        <div className="verse-card">
          <div className="card-header">
            <h3>Daily Verse</h3>
            <p>Verse for Today</p>
          </div>
          <div className="card-body">
            <div className="verse-text">
              "Truth is one; the wise call it by various names. It is the One that the sages speak of in many ways."
            </div>
            <div className="verse-details">
              <span>Mandala 1, Sukta 164</span>
              <span>Rik 46</span>
            </div>
          </div>
          <div className="card-footer">
            <span><i className="fas fa-calendar-day"></i> {new Date().toLocaleDateString()}</span>
            <button className="refresh-btn">Save</button>
          </div>
        </div>
        <div className="verse-card">
          <div className="card-header">
            <h3>Random Verse</h3>
            <p>Discover Something New</p>
          </div>
          <div className="card-body">
            <div className="verse-text">
              "{randomVerse.text}"
            </div>
            <div className="verse-details">
              <span>Mandala {randomVerse.mandala}, Sukta {randomVerse.sukta}</span>
              <span>Rik {randomVerse.rik}</span>
            </div>
          </div>
          <div className="card-footer">
            <span><i className="fas fa-random"></i> Random Selection</span>
            <button className="refresh-btn" onClick={handleNewVerse}>New Verse</button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VerseCards;
import React from 'react';
import Om2D from './Om2D';
import BackgroundRipple from './BackgroundRipple'; // Import the new component
import './Hero.css';

const Hero: React.FC = () => {
  return (
    <section className="hero" id="home">
      <BackgroundRipple /> {/* Add the ripple background */}
      <div className="hero-content">
        <Om2D />
        <h1>Discover the Ancient Wisdom of the <span>Rigveda</span></h1>
        <p>Explore the oldest sacred text of Hinduism with our comprehensive digital platform. Access all 10 Mandalas, 1,028 Suktas, and over 10,600 Riks with translations and interpretations.</p>
        <button className="cta-button">Begin Your Journey</button>
      </div>
    </section>
  );
};

export default Hero;
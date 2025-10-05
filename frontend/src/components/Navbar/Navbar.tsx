import React, { useEffect, useState } from 'react';
import './Navbar.css';

const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 50;
      setScrolled(isScrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="logo">
        <i className="fas fa-om"></i>
        <span>Rigveda Explorer</span>
      </div>
      <ul className="nav-links">
        <li><a href="/">Home</a></li>
        <li><a href="/audio-player">Audio Player</a></li>
        <li><a href="/search">Explore Rigveda</a></li>
        <li><a href="/ai-assistant">AI Assistant</a></li>
      </ul>
      <button className="cta-button">Explore Now</button>
    </nav>
  );
};

export default Navbar;
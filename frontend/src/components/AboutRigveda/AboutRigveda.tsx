import React from 'react';
import './AboutRigveda.css';

const AboutRigveda: React.FC = () => {
  return (
    <section className="about-rigveda" id="about">
      <div className="section-title">
        <h2>About the Rigveda</h2>
        <p>Understanding the world's oldest religious text still in use</p>
      </div>
      <div className="about-content">
        <div className="about-text">
          <h3>The Foundation of Hindu Philosophy</h3>
          <p>The Rigveda is an ancient Indian collection of Vedic Sanskrit hymns. It is one of the four sacred canonical texts of Hinduism known as the Vedas.</p>
          <p>Composed between 1500 and 1200 BCE, it consists of 1,028 hymns (sūktas) dedicated to various deities, organized into ten books (maṇḍalas).</p>
          <p>The Rigveda's verses are recited at Hindu rituals and ceremonies, and it is a foundational text of Hinduism that has influenced religious and philosophical thought for millennia.</p>
          <button className="cta-button">Learn More</button>
        </div>
        <div className="about-image">
          <img src="https://images.unsplash.com/photo-1589994965851-a8f479c573a9?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80" alt="Ancient Sanskrit Manuscript" />
        </div>
      </div>
    </section>
  );
};

export default AboutRigveda;
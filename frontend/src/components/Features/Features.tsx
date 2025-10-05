import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Features.css';
import { link } from 'fs';

const Features: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    { icon: 'fas fa-book-open', title: 'Complete Text Access', description: 'Browse all 10 Mandalas with original Sanskrit text, transliteration, and English translations for each Rik.', link: '/search' },
    { icon: 'fas fa-search', title: 'Advanced Search', description: "Search across translations, deities, or specific verses to find exactly what you're looking for.", link: '/search' },
    { icon: 'fas fa-headphones', title: 'Audio Pronunciations', description: 'Listen to authentic pronunciations of Sanskrit verses to enhance your understanding.', link: '/audio-player' },
    { icon: 'fas fa-robot', title: 'AI Assistant', description: 'Get answers to your questions about Rigvedic concepts, deities, and philosophical ideas.', link: '/ai-assistant' },
    { icon: 'fas fa-download', title: 'Export & Share', description: 'Download verses as PDFs or share them with others to spread the ancient wisdom.',link: "/" }
  ];

  return (
    <section className="features" id="features">
      <div className="section-title">
        <h2>Features</h2>
        <p>Our platform offers comprehensive tools to explore and understand the Rigveda like never before</p>
      </div>
      <div className="features-grid">
        {features.map((feature, index) => (
          <div
            key={index}
            className="feature-card"
            onClick={() => navigate(feature.link)}
            style={{ cursor: 'pointer' }}
          >
            <div className="feature-icon">
              <i className={feature.icon}></i>
            </div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Features;

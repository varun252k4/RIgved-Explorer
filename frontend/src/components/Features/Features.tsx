import React from 'react';
import './Features.css';

const Features: React.FC = () => {
  const features = [
    {
      icon: 'fas fa-book-open',
      title: 'Complete Text Access',
      description: 'Browse all 10 Mandalas with original Sanskrit text, transliteration, and English translations for each Rik.'
    },
    {
      icon: 'fas fa-search',
      title: 'Advanced Search',
      description: 'Search across translations, deities, or specific verses to find exactly what you\'re looking for.'
    },
    {
      icon: 'fas fa-bookmark',
      title: 'Bookmark Verses',
      description: 'Save your favorite verses for quick access and create personalized collections of wisdom.'
    },
    {
      icon: 'fas fa-headphones',
      title: 'Audio Pronunciations',
      description: 'Listen to authentic pronunciations of Sanskrit verses to enhance your understanding.'
    },
    {
      icon: 'fas fa-robot',
      title: 'AI Assistant',
      description: 'Get answers to your questions about Rigvedic concepts, deities, and philosophical ideas.'
    },
    {
      icon: 'fas fa-download',
      title: 'Export & Share',
      description: 'Download verses as PDFs or share them with others to spread the ancient wisdom.'
    }
  ];

  return (
    <section className="features" id="features">
      <div className="section-title">
        <h2>Powerful Features</h2>
        <p>Our platform offers comprehensive tools to explore and understand the Rigveda like never before</p>
      </div>
      <div className="features-grid">
        {features.map((feature, index) => (
          <div key={index} className="feature-card">
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
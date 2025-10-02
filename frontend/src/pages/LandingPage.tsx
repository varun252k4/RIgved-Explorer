import React from 'react';
import Navbar from '../components/Navbar/Navbar';
import Hero from '../components/Hero/Hero';
import Features from '../components/Features/Features';
import VerseCards from '../components/VerseCards/VerseCards';
import AboutRigveda from '../components/AboutRigveda/AboutRigveda';
import Footer from '../components/Footer/Footer';

const LandingPage: React.FC = () => {
  return (
    <div className="landing-page">
      <Navbar />
      <Hero />
      <Features />
      <VerseCards />
      <AboutRigveda />
      <Footer />
    </div>
  );
};

export default LandingPage;
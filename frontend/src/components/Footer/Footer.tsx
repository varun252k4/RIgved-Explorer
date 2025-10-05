import React from 'react';
import './Footer.css';

const Footer: React.FC = () => {
  return (
    <footer className="footer" id="contact">
      <div className="footer-content">
        <div className="footer-column">
          <h3>Rigveda Explorer</h3>
          <p>Bringing the ancient wisdom of the Rigveda to the digital age with authenticity and accessibility.</p>
          <div className="social-links">
            <a href="#"><i className="fab fa-facebook-f"></i></a>
            <a href="#"><i className="fab fa-twitter"></i></a>
            <a href="#"><i className="fab fa-instagram"></i></a>
            <a href="#"><i className="fab fa-youtube"></i></a>
          </div>
        </div>
        <div className="footer-column">
          <h3>Quick Links</h3>
          <ul className="footer-links">
            <li><a href="#home">Home</a></li>
            <li><a href="#features">Features</a></li>
            <li><a href="#verses">Daily Verses</a></li>
            <li><a href="#about">About Rigveda</a></li>
            <li><a href="#">Mandalas</a></li>
          </ul>
        </div>
        {/* <div className="footer-column">
          <h3>Resources</h3>
          <ul className="footer-links">
            <li><a href="#">Sanskrit Learning</a></li>
            <li><a href="#">Vedic Philosophy</a></li>
            <li><a href="#">Research Papers</a></li>
            <li><a href="#">Audio Library</a></li>
            <li><a href="#">PDF Downloads</a></li>
          </ul>
        </div> */}
        <div className="footer-column">
          <h3>Contact Us</h3>
          <ul className="footer-links">
            <li><i className="fas fa-envelope"></i> varun.252k4@gmail.com</li>
            <li><i className="fas fa-phone"></i> +91 912345678</li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Rigveda Explorer. All rights reserved. | Designed with <i className="fas fa-heart" style={{color: '#FF9933'}}></i> for preserving ancient wisdom</p>
      </div>
    </footer>
  );
};

export default Footer;
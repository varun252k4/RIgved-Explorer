import React, { useEffect, useState } from 'react';
import { ReactComponent as OmSVG } from './om.svg';
import './Om2D.css';

const Om2D: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="om-2d-container">
      <div className={`om-symbol ${isVisible ? 'animate' : ''}`}>
        <OmSVG />
      </div>
    </div>
  );
};

export default Om2D;

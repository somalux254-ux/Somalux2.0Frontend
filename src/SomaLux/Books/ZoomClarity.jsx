import React from 'react';

const ZoomClarity = ({ children, scale, defaultScale }) => {
  const isZoomed = scale > defaultScale + 0.001;

  return (
    <div className={`zoom-clarity ${isZoomed ? 'zoom-clarity--active' : ''}`} data-zoomed={isZoomed}>
      {children}
    </div>
  );
};

export default ZoomClarity;

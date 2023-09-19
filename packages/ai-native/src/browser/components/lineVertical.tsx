import React from 'react';

const lineStyles = {
  borderLeft: '1px solid #666',
  height: '100%',
  width: '1px',
  display: 'block',
};

const horizontalStyles = {
  backgroundColor: 'rgba(255,255,255,0.08)',
  width: '100%',
  height: '1px',
  minHeight: '1px',
};

export const LineVertical = () => <span style={lineStyles}></span>;

export const HorizontalVertical = () => <span style={horizontalStyles}></span>;

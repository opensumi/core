import React from 'react';

const lineStyles = {
  backgroundColor: '#666',
  height: '100%',
  width: '1px',
  minWidth: '1px',
};

const horizontalStyles = {
  backgroundColor: 'rgba(255,255,255,0.08)',
  width: '100%',
  height: '1px',
  minHeight: '1px',
};

export const LineVertical = () => <span style={lineStyles}></span>;

export const HorizontalVertical = () => <span style={horizontalStyles}></span>;

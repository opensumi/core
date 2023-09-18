import React from 'react';

const lineStyles = {
  borderLeft: '1px solid #666',
  height: '100%',
  width: '1px',
  display: 'block',
};

const horizontalStyles = {
  borderLeft: '1px solid #666',
  width: '100%',
  height: '1px',
  display: 'block',
};

export const LineVertical = () => <span style={lineStyles}></span>;

export const HorizontalVertical = () => <span style={horizontalStyles}></span>;

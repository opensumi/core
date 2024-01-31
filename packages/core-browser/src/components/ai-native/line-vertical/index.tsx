import React from 'react';

const lineStyles = {
  backgroundColor: 'var(--editorGroup-border)',
  height: '100%',
  width: '1px',
  minWidth: '1px',
};

const horizontalStyles = {
  backgroundColor: 'var(--editorGroup-border)',
  width: '100%',
  height: '1px',
  minHeight: '1px',
};

export const LineVertical = (style?: React.CSSProperties) => <span style={{ ...lineStyles, ...style }}></span>;

export const HorizontalVertical = (style?: React.CSSProperties) => (
  <span style={{ ...horizontalStyles, ...style }}></span>
);

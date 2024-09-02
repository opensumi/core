import React from 'react';
import ReactIs from 'react-is';

import { ErrorBoundary } from '../react-providers';

import { View } from './layout.interface';

export const renderView = (view?: View) => (
  <>
    {view && ReactIs.isValidElementType(view.component) ? (
      <ErrorBoundary>{view.component && React.createElement(view.component, view.initialProps)}</ErrorBoundary>
    ) : null}
  </>
);

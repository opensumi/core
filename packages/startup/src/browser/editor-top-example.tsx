import React from 'react';

import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser';

export const ExampleEditorTopWidget: ReactEditorComponent<any> = ({ resource }) => (
  <div
    style={{
      border: '1px solid var(--foreground)',
      padding: '5px 10px',
    }}
  >
    Example Top Widget for File Uri: {resource.uri.toString()}
  </div>
);

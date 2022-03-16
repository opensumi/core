import React from 'react';

import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser';

export const ExampleEditorBottomWidget: ReactEditorComponent<any> = ({ resource }) => (
  <div
    style={{
      border: '1px solid var(--foreground)',
      padding: '5px 10px',
    }}
  >
    Example Bottom Widget for File Uri: {resource.uri.toString()}
  </div>
);

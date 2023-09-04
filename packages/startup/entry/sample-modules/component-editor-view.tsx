import React from 'react';

import { Domain, Schemes } from '@opensumi/ide-core-common';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  EditorComponentRenderMode,
  ReactEditorComponent,
} from '@opensumi/ide-editor/lib/browser';

export const ComponentEditorView: ReactEditorComponent = () => {
  React.useEffect(
    () => () => {
      // eslint-disable-next-line no-console
      console.log(1);
    },
    [],
  );
  return <div></div>;
};

@Domain(BrowserEditorContribution)
export class ComponentsContribution implements BrowserEditorContribution {
  registerEditorComponent(registry: EditorComponentRegistry) {
    registry.registerEditorComponent({
      scheme: Schemes.file,
      uid: 'bdb-components',
      component: ComponentEditorView,
      renderMode: EditorComponentRenderMode.ONE_PER_RESOURCE,
    });
    registry.registerEditorComponentResolver(Schemes.file, (resource, results) => {
      if (resource.uri.path.ext === '.cmp') {
        results.push({
          type: 'component',
          componentId: 'bdb-components',
        });
      }
    });
  }
}

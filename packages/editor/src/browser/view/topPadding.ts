import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { IEditor } from '../../common';
import { IEditorFeatureContribution } from '../types';

export class EditorTopPaddingContribution implements IEditorFeatureContribution {
  contribute(editor: IEditor) {
    return editor.monacoEditor.onDidChangeModel(() => {
      editor.monacoEditor.changeViewZones((accessor: monaco.editor.IViewZoneChangeAccessor) => {
        accessor.addZone({
          afterLineNumber: 0,
          domNode: document.createElement('div'),
          heightInPx: 8,
        });
      });
    });
  }
}

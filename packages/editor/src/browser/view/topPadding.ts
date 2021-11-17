import * as monaco from '@ide-framework/monaco-editor-core/esm/vs/editor/editor.api';
import { IEditorFeatureContribution } from '../types';
import { IEditor } from '../../common';

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

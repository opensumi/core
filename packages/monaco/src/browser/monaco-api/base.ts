import { Position } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/position';
import * as standaloneEnums from '@opensumi/monaco-editor-core/esm/vs/editor/common/standalone/standaloneEnums';
import { Range, Selection } from '@opensumi/monaco-editor-core/esm/vs/editor/editor.main';

export function createMonacoBaseAPI() {
  return Object.freeze({
    // class
    Range,
    Position,
    Selection,

    // enum
    SelectionDirection: standaloneEnums.SelectionDirection,
  });
}

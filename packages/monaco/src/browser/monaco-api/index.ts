import {
  EditorAutoIndentStrategy,
  EditorOptions,
  WrappingIndent,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';

import { createMonacoEditorApi } from './editor';
import { createMonacoLanguageApi } from './languages';

EditorOptions.wrappingIndent.defaultValue = WrappingIndent.None;
EditorOptions.glyphMargin.defaultValue = false;
EditorOptions.autoIndent.defaultValue = EditorAutoIndentStrategy.Advanced;
EditorOptions.overviewRulerLanes.defaultValue = 2;

export const monaco = Object.freeze({
  editor: createMonacoEditorApi(),
  languages: createMonacoLanguageApi(),
});

export const monacoApi = monaco;

export { URI } from '@opensumi/monaco-editor-core/esm/vs/base/common/uri';
export {
  ResourceEdit,
  IBulkEditResult,
} from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/bulkEditService';

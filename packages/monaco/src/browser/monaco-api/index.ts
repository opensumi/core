import { createMonacoBaseAPI } from './base';
import { createMonacoEditorApi } from './editor';
import { createMonacoLanguageApi } from './languages';
import { createStaticServiceApi } from './services';

export { URI } from '@opensumi/monaco-editor-core/esm/vs/base/common/uri';
export {
  IBulkEditResult,
  ResourceEdit,
} from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/bulkEditService';

export { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
export { ISelection, Selection } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/selection';

export const monaco = Object.freeze({
  ...createMonacoBaseAPI(),
  editor: createMonacoEditorApi(),
  languages: createMonacoLanguageApi(),
  services: createStaticServiceApi(),
});

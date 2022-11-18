import type { ICodeEditor } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import type { IEditor } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';
import type { IEditorModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';

export interface IMergeEditorEditor extends IEditor {
  getOursEditor(): ICodeEditor;
  getResultEditor(): ICodeEditor;
  getTheirsEditor(): ICodeEditor;
  open(oursTextModel: IEditorModel, resultTextModel: IEditorModel, theirsTextModel: IEditorModel): Promise<void>;
  compare(): Promise<void>;
}

import { Injector } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';
import {
  ObservableCodeEditor,
  observableCodeEditor,
} from '@opensumi/monaco-editor-core/esm/vs/editor/browser/observableCodeEditor';

import { CodeEditsResultValue } from '../index';

export abstract class BaseCodeEditsView extends Disposable {
  protected editorObs: ObservableCodeEditor;

  public modelId: string;

  constructor(protected readonly monacoEditor: ICodeEditor, protected readonly injector: Injector) {
    super();

    this.editorObs = observableCodeEditor(this.monacoEditor);
    this.mount();

    this.addDispose({ dispose: () => this.hide() });
  }

  protected mount(): void {}

  abstract render(completionModel: CodeEditsResultValue): void;
  abstract hide(): void;
  abstract accept(): void;
  abstract discard(): void;
}

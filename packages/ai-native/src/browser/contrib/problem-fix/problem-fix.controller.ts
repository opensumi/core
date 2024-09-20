import { IDisposable } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { IEditorContribution } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';

import { BaseAIMonacoEditorController } from '../../contrib/base';

import { ProblemFixHandler } from './problem-fix.handler';

/**
 * @internal
 */
export class ProblemFixController extends BaseAIMonacoEditorController implements IEditorContribution {
  public static readonly ID = 'editor.contrib.ai.problem.fix';

  public static get(editor: ICodeEditor): ProblemFixController | null {
    return editor.getContribution(ProblemFixController.ID);
  }

  private problemFixHandler: ProblemFixHandler;
  mount(): IDisposable {
    this.problemFixHandler = this.injector.get(ProblemFixHandler);
    this.problemFixHandler.mountEditor(this.monacoEditor);
    this.problemFixHandler.load();

    return this.problemFixHandler;
  }
}

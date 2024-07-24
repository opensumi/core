import { Autowired, Injectable } from '@opensumi/di';
import {
  CancellationTokenSource,
  Disposable,
  Event,
  IDisposable,
  IntelligentCompletionsRegistryToken,
} from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor';
import { CursorChangeReason, ICursorSelectionChangedEvent } from '@opensumi/ide-monaco';
import { TextEditorSelectionSource } from '@opensumi/monaco-editor-core/esm/vs/platform/editor/common/editor';

import { MultiLineDiffComputer } from './diff-computer';
import { IntelligentCompletionsRegistry } from './intelligent-completions.feature.registry';
import { MultiLineDecorationModel } from './multi-line.decoration';

@Injectable()
export class IntelligentCompletionsHandler extends Disposable {
  @Autowired(IntelligentCompletionsRegistryToken)
  private intelligentCompletionsRegistry: IntelligentCompletionsRegistry;

  private cancelIndicator = new CancellationTokenSource();

  private cancelToken() {
    this.cancelIndicator.cancel();
    this.cancelIndicator = new CancellationTokenSource();
  }

  private multiLineDiffComputer: MultiLineDiffComputer = new MultiLineDiffComputer();
  private multiLineDecorationModel: MultiLineDecorationModel;

  private editor: IEditor;

  private async update() {
    const provider = this.intelligentCompletionsRegistry.getProvider();
    if (!provider) {
      return;
    }

    const { monacoEditor } = this.editor;

    const position = monacoEditor.getPosition()!;
    const model = monacoEditor.getModel();

    const intelligentCompletionModel = await provider(monacoEditor, position, this.cancelIndicator.token);

    const { items } = intelligentCompletionModel;

    const { belowRadius, aboveRadius, content } = items[0];

    const originalContent = model?.getValueInRange({
      startLineNumber: position.lineNumber - (aboveRadius || 0),
      startColumn: 1,
      endLineNumber: position.lineNumber + (belowRadius || 0),
      endColumn: model.getLineMaxColumn(position.lineNumber + (belowRadius || 0)),
    });

    let diffComputerResult = this.multiLineDiffComputer.diff(originalContent!, content);

    // console.log('intelligentCompletionModel:>>> intelligentCompletionDiffComputerResult \n ', diffComputerResult);
    // console.log('intelligentCompletionModel:>>> intelligentCompletionDiffComputerResult: >> provider content: \n ', content);
    if (diffComputerResult) {
      diffComputerResult = diffComputerResult.map((result) => {
        if (result.removed) {
          result.added = undefined;
          result.removed = undefined;
        }
        return result;
      });

      const inlineModifications = this.multiLineDecorationModel.applyInlineDecorations(
        monacoEditor,
        diffComputerResult,
        position.lineNumber,
        position,
      );

      if (inlineModifications) {
        this.multiLineDecorationModel.updateLineModificationDecorations(inlineModifications);
      } else {
        this.multiLineDecorationModel.clearDecorations();
      }
      // console.log('intelligentCompletionModel:>>> decorationModel 。 decorationModel \n ', inlineModifications);
    }
  }

  public registerFeature(editor: IEditor): IDisposable {
    this.editor = editor;
    const { monacoEditor } = editor;

    this.multiLineDecorationModel = new MultiLineDecorationModel(monacoEditor);

    const stop = () => {
      this.cancelToken();
      this.multiLineDecorationModel.clearDecorations();
    };

    /**
     * 触发时机与 inline completion 保持一致
     */
    this.addDispose([
      monacoEditor.onDidType(() => {
        this.update();
      }),

      Event.any<any>(
        monacoEditor.onDidChangeModel,
        monacoEditor.onDidBlurEditorWidget,
      )(() => {
        stop();
      }),

      monacoEditor.onDidChangeCursorSelection((event: ICursorSelectionChangedEvent) => {
        if (event.reason === CursorChangeReason.Explicit || event.source === TextEditorSelectionSource.PROGRAMMATIC) {
          stop();
        }
      }),
    ]);

    return this;
  }
}

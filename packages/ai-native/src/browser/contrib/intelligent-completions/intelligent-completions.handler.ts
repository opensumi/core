import { Autowired, Injectable } from '@opensumi/di';
import {
  CancellationTokenSource,
  Disposable,
  IDisposable,
  IntelligentCompletionsRegistryToken,
} from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor';
import { Position, Range } from '@opensumi/ide-monaco';

import { CompletionsInlineDecorationModel } from './completions-inline.decoration';
import { IntelligentCompletionDiffComputer } from './diff-computer';
import { IntelligentCompletionsRegistry } from './intelligent-completions.feature.registry';

@Injectable()
export class IntelligentCompletionsHandler extends Disposable {
  @Autowired(IntelligentCompletionsRegistryToken)
  private intelligentCompletionsRegistry: IntelligentCompletionsRegistry;

  private cancelIndicator = new CancellationTokenSource();

  private cancelToken() {
    this.cancelIndicator.cancel();
    this.cancelIndicator = new CancellationTokenSource();
  }

  private intelligentCompletionDiffComputer: IntelligentCompletionDiffComputer =
    new IntelligentCompletionDiffComputer();
  private completionsInlineDecorationModel: CompletionsInlineDecorationModel;

  private editor: IEditor;

  private async update() {
    const provider = this.intelligentCompletionsRegistry.getProvider();
    if (!provider) {
      return;
    }

    const { monacoEditor } = this.editor;

    const position = monacoEditor.getPosition()!;
    const model = monacoEditor.getModel();

    // @ts-ignore
    const intelligentCompletionModel = await provider(monacoEditor, position, {}, this.cancelIndicator.token);

    const { items } = intelligentCompletionModel;

    const { belowRadius, aboveRadius, content } = items[0];

    const originalContent = model?.getValueInRange({
      startLineNumber: position.lineNumber - (aboveRadius || 0),
      startColumn: 1,
      endLineNumber: position.lineNumber + (belowRadius || 0),
      endColumn: model.getLineMaxColumn(position.lineNumber + (belowRadius || 0)),
    });

    let intelligentCompletionDiffComputerResult = this.intelligentCompletionDiffComputer.diff(
      originalContent!,
      content,
    );

    // console.log('intelligentCompletionModel:>>> intelligentCompletionDiffComputerResult \n ', intelligentCompletionDiffComputerResult);
    // console.log('intelligentCompletionModel:>>> intelligentCompletionDiffComputerResult: >> provider content: \n ', content);
    if (intelligentCompletionDiffComputerResult) {
      intelligentCompletionDiffComputerResult = intelligentCompletionDiffComputerResult.map((result) => {
        if (result.removed) {
          result.added = undefined;
          result.removed = undefined;
        }
        return result;
      });

      const inlineModifications = this.completionsInlineDecorationModel.applyInlineDecorations(
        monacoEditor,
        intelligentCompletionDiffComputerResult,
        position.lineNumber,
        position,
      );

      if (inlineModifications) {
        this.completionsInlineDecorationModel.updateLineModificationDecorations(inlineModifications);
      } else {
        this.completionsInlineDecorationModel.updateLineModificationDecorations([]);
      }
      // console.log('intelligentCompletionModel:>>> decorationModel 。 decorationModel \n ', inlineModifications);
    }
  }

  public registerFeature(editor: IEditor): IDisposable {
    this.editor = editor;
    const { monacoEditor } = editor;

    this.completionsInlineDecorationModel = new CompletionsInlineDecorationModel(monacoEditor);

    this.addDispose(
      monacoEditor.onDidChangeCursorPosition(() => {
        this.update();
      }),
    );

    return this;
  }
}

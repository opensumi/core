import { Autowired, Injectable } from '@opensumi/di';
import { Disposable, IDisposable, IntelligentCompletionsRegistryToken } from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor';

import { IntelligentCompletionDiffComputer } from './diff-computer';
import { IntelligentCompletionsRegistry } from './intelligent-completions.feature.registry';

@Injectable()
export class IntelligentCompletionsHandler extends Disposable {
  @Autowired(IntelligentCompletionsRegistryToken)
  private intelligentCompletionsRegistry: IntelligentCompletionsRegistry;

  private intelligentCompletionDiffComputer: IntelligentCompletionDiffComputer =
    new IntelligentCompletionDiffComputer();
  private editor: IEditor;

  private async update() {
    const provider = this.intelligentCompletionsRegistry.getProvider();
    if (!provider) {
      return;
    }

    const { monacoEditor } = this.editor;
    const model = monacoEditor.getModel();

    // @ts-ignore
    const intelligentCompletionModel = await provider();

    const { items } = intelligentCompletionModel;

    const { belowRadius, aboveRadius, content } = items[0];

    const position = monacoEditor.getPosition()!;
    const originalContent = model?.getValueInRange({
      startLineNumber: position.lineNumber - (aboveRadius || 0),
      startColumn: 1,
      endLineNumber: position.lineNumber + (belowRadius || 0),
      endColumn: model.getLineMaxColumn(position.lineNumber),
    });

    const intelligentCompletionDiffComputerResult = this.intelligentCompletionDiffComputer.diff(
      originalContent!,
      content,
    );

    // console.log('intelligentCompletionModel:>>> diffResult 。 intelligentCompletionDiffComputerResult \n ', intelligentCompletionDiffComputerResult);
  }

  public registerFeature(editor: IEditor): IDisposable {
    this.editor = editor;
    const { monacoEditor } = editor;

    this.addDispose(
      monacoEditor.onDidChangeCursorPosition(() => {
        this.update();
      }),
    );

    return this;
  }
}

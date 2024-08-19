import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  CancellationTokenSource,
  Disposable,
  IAICompletionOption,
  IDisposable,
  IntelligentCompletionsRegistryToken,
} from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor';
import { ICodeEditor, Position } from '@opensumi/ide-monaco';
import { EditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/editOperation';

import { AINativeContextKey } from '../../contextkey/ai-native.contextkey.service';

import { MultiLineDiffComputer } from './diff-computer';
import { IIntelligentCompletionsResult } from './intelligent-completions';
import { IntelligentCompletionsRegistry } from './intelligent-completions.feature.registry';
import { MultiLineDecorationModel } from './multi-line.decoration';

@Injectable()
export class IntelligentCompletionsHandler extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

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
  private aiNativeContextKey: AINativeContextKey;

  private get monacoEditor(): ICodeEditor {
    return this.editor.monacoEditor;
  }

  public async fetchProvider(bean: IAICompletionOption): Promise<IIntelligentCompletionsResult | undefined> {
    const provider = this.intelligentCompletionsRegistry.getProvider();
    if (!provider) {
      return;
    }

    const position = this.monacoEditor.getPosition()!;
    const intelligentCompletionModel = await provider(this.monacoEditor, position, bean, this.cancelIndicator.token);

    if (
      intelligentCompletionModel &&
      intelligentCompletionModel.enableMultiLine &&
      intelligentCompletionModel.items.length > 0
    ) {
      return this.applyInlineDecorations(intelligentCompletionModel);
    }

    return intelligentCompletionModel;
  }

  public applyInlineDecorations(completionModel: IIntelligentCompletionsResult) {
    const { items } = completionModel;

    const position = this.monacoEditor.getPosition()!;
    const model = this.monacoEditor.getModel();
    const { range, insertText } = items[0];

    // 如果只是开启了 enableMultiLine 而没有传递 range ，则不显示 multi line
    if (!range) {
      return completionModel;
    }

    const originalContent = model?.getValueInRange(range);

    const diffComputerResult = this.multiLineDiffComputer.diff(originalContent!, insertText.toString());

    if (diffComputerResult) {
      const inlineModifications = this.multiLineDecorationModel.applyInlineDecorations(
        this.monacoEditor,
        diffComputerResult,
        position.lineNumber,
        position,
      );

      if (inlineModifications) {
        this.aiNativeContextKey.multiLineCompletionsIsVisible.set(true);
        this.multiLineDecorationModel.updateLineModificationDecorations(inlineModifications);
      } else {
        this.aiNativeContextKey.multiLineCompletionsIsVisible.reset();
        this.multiLineDecorationModel.clearDecorations();
      }
    }
  }

  public hide() {
    this.cancelToken();
    this.aiNativeContextKey.multiLineCompletionsIsVisible.reset();
    this.multiLineDecorationModel.clearDecorations();
  }

  public accept() {
    const edits = this.multiLineDecorationModel.getEdits();

    this.editor.monacoEditor.pushUndoStop();
    this.editor.monacoEditor.executeEdits(
      'multiLineCompletions.accept',
      edits.map((edit) =>
        EditOperation.insert(
          Position.lift({ lineNumber: edit.range.startLineNumber, column: edit.range.startColumn }),
          edit.text,
        ),
      ),
    );

    this.hide();
  }

  public registerFeature(editor: IEditor): IDisposable {
    this.editor = editor;
    const { monacoEditor } = editor;

    this.multiLineDecorationModel = new MultiLineDecorationModel(monacoEditor);
    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [monacoEditor.contextKeyService]);
    return this;
  }
}

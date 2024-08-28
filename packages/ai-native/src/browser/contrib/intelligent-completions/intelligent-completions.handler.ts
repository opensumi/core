import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  CancellationTokenSource,
  Disposable,
  IAICompletionOption,
  IDisposable,
  IntelligentCompletionsRegistryToken,
} from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor';
import { ICodeEditor, IRange, ITextModel, Position } from '@opensumi/ide-monaco';
import { empty } from '@opensumi/ide-utils/lib/strings';
import { EditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/editOperation';

import { AINativeContextKey } from '../../contextkey/ai-native.contextkey.service';
import { RewriteWidget } from '../../widget/rewrite/rewrite-widget';

import { AdditionsDeletionsDecorationModel } from './additions-deletions.decoration';
import {
  IMultiLineDiffChangeResult,
  computeMultiLineDiffChanges,
  mergeMultiLineDiffChanges,
  wordChangesToLineChangesMap,
} from './diff-computer';
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

  private multiLineDecorationModel: MultiLineDecorationModel;
  private additionsDeletionsDecorationModel: AdditionsDeletionsDecorationModel;

  private editor: IEditor;
  private aiNativeContextKey: AINativeContextKey;

  private get monacoEditor(): ICodeEditor {
    return this.editor.monacoEditor;
  }

  private get model(): ITextModel {
    return this.monacoEditor.getModel()!;
  }

  private rewriteWidget: RewriteWidget;

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
    const insertTextString = insertText.toString();

    // 如果只是开启了 enableMultiLine 而没有传递 range ，则不显示 multi line
    if (!range) {
      return completionModel;
    }

    const originalContent = model?.getValueInRange(range);
    const eol = this.model.getEOL();

    const changes = computeMultiLineDiffChanges(
      originalContent!,
      insertTextString,
      this.monacoEditor,
      range.startLineNumber,
      eol,
    );

    if (!changes) {
      return;
    }

    const { singleLineCharChanges, charChanges, wordChanges, isOnlyAddingToEachWord } = changes;

    const startOffset = this.model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn });
    const endOffset = this.model.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn });
    const allText = this.model.getValue();
    // 这里是为了能在 rewrite widget 的 editor 当中完整的复用代码高亮与语法检测的能力
    const newValue = allText.substring(0, startOffset) + insertText + allText.substring(endOffset);

    // 限制 change 数量，超过这个数量直接显示智能重写
    const maxCharChanges = 20;
    const maxWordChanges = 20;

    if (
      position &&
      isOnlyAddingToEachWord &&
      charChanges.length <= maxCharChanges &&
      wordChanges.length <= maxWordChanges
    ) {
      const modificationsResult = this.multiLineDecorationModel.applyInlineDecorations(
        this.monacoEditor,
        mergeMultiLineDiffChanges(singleLineCharChanges, eol),
        position.lineNumber,
        position,
      );

      if (!modificationsResult) {
        this.aiNativeContextKey.multiLineCompletionsIsVisible.reset();
        this.multiLineDecorationModel.clearDecorations();
        this.showChangesOnTheRight(wordChanges, model, range, newValue);
      } else if (modificationsResult && modificationsResult.inlineMods) {
        this.aiNativeContextKey.multiLineCompletionsIsVisible.set(true);
        this.multiLineDecorationModel.updateLineModificationDecorations(modificationsResult.inlineMods);
      }
    } else {
      this.additionsDeletionsDecorationModel.updateDeletionsDecoration(wordChanges, range, eol);
      this.showChangesOnTheRight(wordChanges, model, range, newValue);
    }
  }

  private showChangesOnTheRight(
    wordChanges: IMultiLineDiffChangeResult[],
    model: ITextModel | null,
    range: IRange,
    newValue: string,
  ) {
    const lineChangesMap = wordChangesToLineChangesMap(wordChanges, range, model);

    this.rewriteWidget.hide();

    const cursorPosition = this.monacoEditor.getPosition();
    if (!cursorPosition) {
      return;
    }

    const allLineChanges = Object.values(lineChangesMap).map((lineChanges) => ({
      changes: lineChanges
        .map((change) => change.filter((item) => item.value.trim() !== empty))
        .filter((change) => change.length > 0),
    }));

    this.rewriteWidget.show({ position: cursorPosition });

    if (allLineChanges.every(({ changes }) => changes.every((change) => change.every(({ removed }) => removed)))) {
      // 处理全是删除的情况
      this.rewriteWidget.renderTextLineThrough(range, allLineChanges);
    } else {
      this.rewriteWidget.renderVirtualEditor(newValue, range, wordChanges);
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

    this.rewriteWidget = this.injector.get(RewriteWidget, [monacoEditor]);

    this.multiLineDecorationModel = new MultiLineDecorationModel(monacoEditor);
    this.additionsDeletionsDecorationModel = new AdditionsDeletionsDecorationModel(monacoEditor);
    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [monacoEditor.contextKeyService]);
    return this;
  }
}

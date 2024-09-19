import { Injectable, Injector, Optional } from '@opensumi/di';
import { MultiLineEditsIsVisible } from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import {
  CancellationTokenSource,
  Disposable,
  Event,
  IAICompletionOption,
  IDisposable,
  IntelligentCompletionsRegistryToken,
  runWhenIdle,
} from '@opensumi/ide-core-common';
import { ICodeEditor, ICursorPositionChangedEvent, IRange, ITextModel, Range } from '@opensumi/ide-monaco';
import { empty } from '@opensumi/ide-utils/lib/strings';
import { IEditorContribution } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';

import { AINativeContextKey } from '../../contextkey/ai-native.contextkey.service';
import { REWRITE_DECORATION_INLINE_ADD, RewriteWidget } from '../../widget/rewrite/rewrite-widget';

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
export class IntelligentCompletionsController extends Disposable implements IEditorContribution {
  public static readonly ID = 'editor.contrib.intelligent.completions';

  public static get(editor: ICodeEditor): IntelligentCompletionsController | null {
    return editor.getContribution<IntelligentCompletionsController>(IntelligentCompletionsController.ID);
  }

  constructor(@Optional() private readonly injector: Injector, @Optional() private readonly monacoEditor: ICodeEditor) {
    super();
    this.registerFeature(this.monacoEditor);
  }

  private get intelligentCompletionsRegistry(): IntelligentCompletionsRegistry {
    return this.injector.get(IntelligentCompletionsRegistryToken);
  }

  private cancelIndicator = new CancellationTokenSource();

  private cancelToken() {
    this.cancelIndicator.cancel();
    this.cancelIndicator = new CancellationTokenSource();
  }

  private multiLineDecorationModel: MultiLineDecorationModel;
  private additionsDeletionsDecorationModel: AdditionsDeletionsDecorationModel;

  private aiNativeContextKey: AINativeContextKey;

  private get model(): ITextModel {
    return this.monacoEditor.getModel()!;
  }

  private rewriteWidget: RewriteWidget | null;
  private whenMultiLineEditsVisibleDisposable: Disposable = new Disposable();

  private destroyRewriteWidget() {
    if (this.rewriteWidget) {
      this.rewriteWidget.dispose();
      this.rewriteWidget = null;
    }
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

  private applyInlineDecorations(completionModel: IIntelligentCompletionsResult) {
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

    // 限制 changes 数量，超过这个数量直接显示智能重写
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

      this.aiNativeContextKey.multiLineEditsIsVisible.reset();
      this.multiLineDecorationModel.clearDecorations();

      if (!modificationsResult) {
        this.renderRewriteWidget(wordChanges, model, range, insertTextString);
      } else if (modificationsResult && modificationsResult.inlineMods) {
        this.aiNativeContextKey.multiLineEditsIsVisible.set(true);
        this.multiLineDecorationModel.updateLineModificationDecorations(modificationsResult.inlineMods);
      }
    } else {
      this.additionsDeletionsDecorationModel.updateDeletionsDecoration(wordChanges, range, eol);
      this.renderRewriteWidget(wordChanges, model, range, insertTextString);
    }

    if (this.whenMultiLineEditsVisibleDisposable.disposed) {
      this.whenMultiLineEditsVisibleDisposable = new Disposable();
    }
    // 监听当前光标位置的变化，如果超出 range 区域则取消 multiLine edits
    this.whenMultiLineEditsVisibleDisposable.addDispose(
      this.monacoEditor.onDidChangeCursorPosition((event: ICursorPositionChangedEvent) => {
        const isVisible = this.aiNativeContextKey.multiLineEditsIsVisible.get();
        if (isVisible) {
          const position = event.position;
          if (position.lineNumber < range.startLineNumber || position.lineNumber > range.endLineNumber) {
            runWhenIdle(() => {
              this.hide();
            });
          }
        } else {
          this.whenMultiLineEditsVisibleDisposable.dispose();
        }
      }),
    );
  }

  private async renderRewriteWidget(
    wordChanges: IMultiLineDiffChangeResult[],
    model: ITextModel | null,
    range: IRange,
    insertTextString: string,
  ) {
    this.destroyRewriteWidget();

    const cursorPosition = this.monacoEditor.getPosition();
    if (!cursorPosition) {
      return;
    }

    this.rewriteWidget = this.injector.get(RewriteWidget, [this.monacoEditor]);

    const startOffset = this.model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn });
    const endOffset = this.model.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn });
    const allText = this.model.getValue();
    // 这里是为了能在 rewrite widget 的 editor 当中完整的复用代码高亮与语法检测的能力
    const newVirtualContent = allText.substring(0, startOffset) + insertTextString + allText.substring(endOffset);

    const lineChangesMap = wordChangesToLineChangesMap(wordChanges, range, model);

    await this.rewriteWidget.defered.promise;

    this.aiNativeContextKey.multiLineEditsIsVisible.set(true);

    const allLineChanges = Object.values(lineChangesMap).map((lineChanges) => ({
      changes: lineChanges
        .map((change) => change.filter((item) => item.value.trim() !== empty))
        .filter((change) => change.length > 0),
    }));

    this.rewriteWidget.setInsertText(insertTextString);
    this.rewriteWidget.show({ position: cursorPosition });
    this.rewriteWidget.setEditArea(range);

    if (allLineChanges.every(({ changes }) => changes.every((change) => change.every(({ removed }) => removed)))) {
      // 处理全是删除的情况
      this.rewriteWidget.renderTextLineThrough(allLineChanges);
    } else {
      this.rewriteWidget.renderVirtualEditor(newVirtualContent, wordChanges);
    }
  }

  public hide() {
    this.cancelToken();
    this.aiNativeContextKey.multiLineEditsIsVisible.reset();
    this.multiLineDecorationModel.clearDecorations();
    this.additionsDeletionsDecorationModel.clearDeletionsDecorations();
    this.destroyRewriteWidget();
  }

  public accept() {
    this.multiLineDecorationModel.accept();

    if (this.rewriteWidget) {
      this.rewriteWidget.accept();

      const virtualEditor = this.rewriteWidget.getVirtualEditor();
      // 采纳完之后将 virtualEditor 的 decorations 重新映射在 editor 上
      if (virtualEditor) {
        const editArea = this.rewriteWidget.getEditArea();
        const decorations = virtualEditor.getDecorationsInRange(Range.lift(editArea));
        const preAddedDecorations = decorations?.filter(
          (decoration) => decoration.options.description === REWRITE_DECORATION_INLINE_ADD,
        );
        if (preAddedDecorations) {
          this.additionsDeletionsDecorationModel.updateAdditionsDecoration(
            preAddedDecorations.map((decoration) => decoration.range),
          );
        }
      }
    }

    this.hide();
  }

  public registerFeature(monacoEditor: ICodeEditor): IDisposable {
    this.multiLineDecorationModel = new MultiLineDecorationModel(monacoEditor);
    this.additionsDeletionsDecorationModel = new AdditionsDeletionsDecorationModel(monacoEditor);
    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [monacoEditor.contextKeyService]);

    this.addDispose(
      Event.any<any>(
        monacoEditor.onDidChangeCursorPosition,
        monacoEditor.onDidChangeModelContent,
        monacoEditor.onDidBlurEditorWidget,
      )(() => {
        this.additionsDeletionsDecorationModel.clearAdditionsDecorations();
      }),
    );

    const multiLineEditsIsVisibleKey = new Set([MultiLineEditsIsVisible.raw]);
    this.addDispose(this.whenMultiLineEditsVisibleDisposable);
    this.addDispose(
      this.aiNativeContextKey.contextKeyService!.onDidChangeContext((e) => {
        if (e.payload.affectsSome(multiLineEditsIsVisibleKey)) {
          const isVisible = this.aiNativeContextKey.multiLineEditsIsVisible.get();
          if (!isVisible) {
            this.whenMultiLineEditsVisibleDisposable.dispose();
          }
        }
      }),
    );

    this.addDispose(
      Event.any<any>(
        monacoEditor.onDidChangeModel,
        monacoEditor.onDidChangeModelContent,
      )(() => {
        runWhenIdle(() => {
          this.hide();
        });
      }),
    );

    return this;
  }
}

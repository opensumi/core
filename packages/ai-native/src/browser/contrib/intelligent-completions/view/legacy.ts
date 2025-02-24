import { IRange, ITextModel, Range } from '@opensumi/ide-monaco';
import { Event } from '@opensumi/ide-utils';
import { empty } from '@opensumi/ide-utils/lib/strings';

import { REWRITE_DECORATION_INLINE_ADD, RewriteWidget } from '../../../widget/rewrite/rewrite-widget';
import { AdditionsDeletionsDecorationModel } from '../decoration/additions-deletions.decoration';
import { MultiLineDecorationModel } from '../decoration/multi-line.decoration';
import {
  IMultiLineDiffChangeResult,
  computeMultiLineDiffChanges,
  mergeMultiLineDiffChanges,
  wordChangesToLineChangesMap,
} from '../diff-computer';
import { CodeEditsResultValue } from '../index';

import { BaseCodeEditsView } from './base';

export class LegacyCodeEditsView extends BaseCodeEditsView {
  private get model() {
    return this.monacoEditor.getModel()!;
  }

  private multiLineDecorationModel: MultiLineDecorationModel = new MultiLineDecorationModel(this.monacoEditor);
  private additionsDeletionsDecorationModel: AdditionsDeletionsDecorationModel = new AdditionsDeletionsDecorationModel(
    this.monacoEditor,
  );
  private rewriteWidget: RewriteWidget | null;

  protected mount(): void {
    this.addDispose(
      Event.any<any>(
        this.monacoEditor.onDidChangeCursorPosition,
        this.monacoEditor.onDidChangeModelContent,
        this.monacoEditor.onDidBlurEditorWidget,
      )(() => {
        this.additionsDeletionsDecorationModel.clearAdditionsDecorations();
      }),
    );
  }

  private destroyRewriteWidget() {
    if (this.rewriteWidget) {
      this.rewriteWidget.dispose();
      this.rewriteWidget = null;
    }
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

  public render(completionModel: CodeEditsResultValue): void {
    const { items } = completionModel;
    const { range, insertText } = items[0];

    // code edits 必须提供 range
    if (!range) {
      return;
    }

    const position = this.monacoEditor.getPosition()!;
    const model = this.monacoEditor.getModel();
    const insertTextString = insertText.toString();
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
      range &&
      isOnlyAddingToEachWord &&
      charChanges.length <= maxCharChanges &&
      wordChanges.length <= maxWordChanges
    ) {
      const modificationsResult = this.multiLineDecorationModel.applyInlineDecorations(
        this.monacoEditor,
        mergeMultiLineDiffChanges(singleLineCharChanges, eol),
        range.startLineNumber,
        position,
      );

      this.multiLineDecorationModel.clearDecorations();

      if (!modificationsResult) {
        this.renderRewriteWidget(wordChanges, model, range, insertTextString);
      } else if (modificationsResult && modificationsResult.inlineMods) {
        this.multiLineDecorationModel.updateLineModificationDecorations(modificationsResult.inlineMods);
      }
    } else {
      this.additionsDeletionsDecorationModel.updateDeletionsDecoration(wordChanges, range, eol);
      this.renderRewriteWidget(wordChanges, model, range, insertTextString);
    }
  }

  public accept(): void {
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
  }

  public discard(): void {
    this.hide();
  }

  public hide(): void {
    this.multiLineDecorationModel.clearDecorations();
    this.additionsDeletionsDecorationModel.clearDeletionsDecorations();
    this.destroyRewriteWidget();
  }
}

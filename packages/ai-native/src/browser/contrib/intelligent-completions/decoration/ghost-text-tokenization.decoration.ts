import { DisposableStore, Event, isDefined } from '@opensumi/ide-core-common';
import { EditorOption, ICodeEditor, IModelDeltaDecoration, ITextModel, Range } from '@opensumi/ide-monaco';
import { IIdentifiedSingleEditOperation } from '@opensumi/ide-monaco/lib/common';
import {
  IObservable,
  IReader,
  autorun,
  autorunOpts,
  derived,
  derivedDisposable,
  observableFromEvent,
  observableSignalFromEvent,
  observableValue,
} from '@opensumi/ide-monaco/lib/common/observable';
import { Disposable, toDisposable } from '@opensumi/monaco-editor-core/esm/vs/base/common/lifecycle';
import { ILanguageSelection } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages/language';
import { InjectedTextCursorStops, PositionAffinity } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';
import { LineDecoration } from '@opensumi/monaco-editor-core/esm/vs/editor/common/viewLayout/lineDecorations';
import { InlineDecorationType } from '@opensumi/monaco-editor-core/esm/vs/editor/common/viewModel';
import { GhostTextReplacement } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/ghostText';
import { InlineCompletionWithUpdatedRange } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/inlineCompletionsSource';
import { SingleTextEdit } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/singleTextEdit';
import { ColumnRange } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/utils';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

import { renderLines } from '../../../widget/ghost-text-widget';
import { IGhostTextWidgetModelEnhanced } from '../index';
import styles from '../intelligent-completions.module.less';

import { GHOST_TEXT_DESCRIPTION } from './multi-line.decoration';

interface LineData {
  content: string;
  decorations: LineDecoration[];
}

export class GhostTextTokenization extends Disposable {
  private readonly isDisposed = observableValue(this, false);
  private readonly currentTextModel = observableFromEvent(this.editor.onDidChangeModel, () => this.editor.getModel());

  constructor(private readonly editor: ICodeEditor, private readonly model: IGhostTextWidgetModelEnhanced) {
    super();
    this._register(
      toDisposable(() => {
        this.isDisposed.set(true, undefined);
      }),
    );

    const disposable = new DisposableStore();
    const decorationsCollection = this.editor.createDecorationsCollection();

    disposable.add(
      autorunOpts(
        { debugName: () => `Apply tokenization decorations from ${this.decorations.debugName}` },
        (reader) => {
          const d = this.decorations.read(reader);
          decorationsCollection.set(d);
        },
      ),
    );
    disposable.add({
      dispose: () => {
        decorationsCollection.clear();
      },
    });

    this._register(disposable);
  }

  // 创建一个虚拟的 monaco editor model
  private readonly virtualModel = derivedDisposable(this, (reader) => {
    const textModel = this.currentTextModel.read(reader);
    if (!textModel) {
      return undefined;
    }

    const controllerModel = this.model.targetCompletionModel.read(reader);

    let replacement: IIdentifiedSingleEditOperation | undefined;

    /**
     * 这里会有两种情况，一种是下拉补全的代码提示，另一种是内联补全的代码提示，需要分别处理
     */
    const suggestItem = controllerModel!.selectedSuggestItem.read(reader);
    if (suggestItem) {
      const suggestCompletionEdit = suggestItem.toSingleTextEdit().removeCommonPrefix(textModel);
      const computeAugmentation = controllerModel!['_computeAugmentation'] as (
        suggestCompletion: SingleTextEdit,
        reader: IReader | undefined,
      ) =>
        | {
            completion: InlineCompletionWithUpdatedRange;
            edit: SingleTextEdit;
          }
        | undefined;

      const augmentation = computeAugmentation?.call(controllerModel, suggestCompletionEdit, reader);
      const isSuggestionPreviewEnabled = (controllerModel!['_suggestPreviewEnabled'] as IObservable<boolean>).read(
        reader,
      );
      if (!isSuggestionPreviewEnabled && !augmentation) {
        return undefined;
      }

      replacement = augmentation?.edit ?? suggestCompletionEdit;
    } else {
      const inlineCompletion = controllerModel!.selectedInlineCompletion.read(reader);
      if (!inlineCompletion) {
        return undefined;
      }
      replacement = inlineCompletion.toSingleTextEdit(reader);
    }

    if (!replacement) {
      return undefined;
    }

    const modelService = StandaloneServices.get(IModelService);
    const languageSelection: ILanguageSelection = { languageId: textModel.getLanguageId(), onDidChange: Event.None };

    const virtualModel = modelService.createModel('', languageSelection);
    virtualModel.setValue(textModel.getValue());

    /**
     * 将补全的所有内容填写在虚拟 model 中
     */
    virtualModel.pushEditOperations(null, [replacement], () => null);
    return virtualModel;
  }).recomputeInitiallyAndOnChange(this._store);

  private readonly uiState = derived(this, (reader) => {
    if (this.isDisposed.read(reader)) {
      return undefined;
    }

    const textModel = this.currentTextModel.read(reader);
    if (textModel !== this.model.targetTextModel.read(reader)) {
      return undefined;
    }

    const ghostText = this.model.ghostText.read(reader);
    if (!ghostText) {
      return undefined;
    }

    const replacedRange = ghostText instanceof GhostTextReplacement ? ghostText.columnRange : undefined;
    const inlineTexts: { column: number; text: string; preview: boolean }[] = [];
    const additionalLines: LineData[] = [];

    const addToAdditionalLines = (lines: readonly string[], className: string | undefined) => {
      if (additionalLines.length > 0) {
        const lastLine = additionalLines[additionalLines.length - 1];
        if (className) {
          lastLine.decorations.push(
            new LineDecoration(
              lastLine.content.length + 1,
              lastLine.content.length + 1 + lines[0].length,
              className,
              InlineDecorationType.Regular,
            ),
          );
        }
        lastLine.content += lines[0];

        lines = lines.slice(1);
      }
      for (const line of lines) {
        additionalLines.push({
          content: line,
          decorations: className
            ? [new LineDecoration(1, line.length + 1, className, InlineDecorationType.Regular)]
            : [],
        });
      }
    };

    const textBufferLine = textModel.getLineContent(ghostText.lineNumber);

    let hiddenTextStartColumn: number | undefined;
    let lastIdx = 0;
    for (const part of ghostText.parts) {
      let lines = part.lines;
      if (hiddenTextStartColumn === undefined) {
        inlineTexts.push({
          column: part.column,
          text: lines[0],
          preview: part.preview,
        });
        lines = lines.slice(1);
      } else {
        addToAdditionalLines([textBufferLine.substring(lastIdx, part.column - 1)], undefined);
      }

      if (lines.length > 0) {
        addToAdditionalLines(lines, GHOST_TEXT_DESCRIPTION);
        if (hiddenTextStartColumn === undefined && part.column <= textBufferLine.length) {
          hiddenTextStartColumn = part.column;
        }
      }

      lastIdx = part.column - 1;
    }
    if (hiddenTextStartColumn !== undefined) {
      addToAdditionalLines([textBufferLine.substring(lastIdx)], undefined);
    }

    const hiddenRange =
      hiddenTextStartColumn !== undefined
        ? new ColumnRange(hiddenTextStartColumn, textBufferLine.length + 1)
        : undefined;

    return {
      replacedRange,
      inlineTexts,
      additionalLines,
      hiddenRange,
      lineNumber: ghostText.lineNumber,
      additionalReservedLineCount: this.model.minReservedLineCount.read(reader),
      targetTextModel: textModel,
    };
  });

  private readonly decorations = derived(this, (reader) => {
    const uiState = this.uiState.read(reader);
    const virtualModel = this.virtualModel.read(reader);
    if (!uiState || !virtualModel) {
      return [];
    }

    const { replacedRange, hiddenRange, inlineTexts, lineNumber } = uiState;

    const decorations: IModelDeltaDecoration[] = [];

    if (replacedRange) {
      decorations.push({
        range: replacedRange.toRange(lineNumber),
        options: { inlineClassName: 'inline-completion-text-to-replace', description: 'GhostTextReplacement' },
      });
    }

    if (hiddenRange) {
      decorations.push({
        range: hiddenRange.toRange(lineNumber),
        options: { inlineClassName: 'ghost-text-hidden', description: 'ghost-text-hidden' },
      });
    }

    if (inlineTexts.length < 1) {
      return decorations;
    }

    /**
     * 强制更新对应行的 tokenization，此时就能从虚拟 model 中拿到对应的高亮样式类
     */
    virtualModel.tokenization.forceTokenization(lineNumber);
    const token = virtualModel.tokenization.getLineTokens(lineNumber);

    const dom = document.createElement('div');
    renderLines(
      dom,
      this.editor.getOption(EditorOption.tabIndex),
      [
        {
          content: inlineTexts[0].text,
          decorations: [],
          lineTokens: token,
        },
      ],
      this.editor.getOptions(),
    );

    /**
     * 这里主要是为了从虚拟 model 中拿到对应行的 className，然后转成 decorations 的 className
     */
    const findViewLineDOMs = Array.from(dom.querySelectorAll('.view-line > span > span'));

    findViewLineDOMs.forEach((dom, idx) => {
      const className = dom.className;
      const text = dom.textContent || '';
      decorations.push({
        range: Range.fromPositions({ lineNumber, column: inlineTexts[0].column }),
        options: {
          description: GHOST_TEXT_DESCRIPTION,
          after: {
            content: text,
            inlineClassName: styles.inline_completion_ghost_text_decoration + ' ' + className,
            cursorStops: InjectedTextCursorStops.Left,
          },
          showIfCollapsed: true,
        },
      });
    });

    return decorations;
  });

  private readonly additionalLinesWidget = this._register(
    new AdditionalLinesWidget(
      this.editor,
      derived((reader) => {
        const uiState = this.uiState.read(reader);
        const virtualModel = this.virtualModel.read(reader);
        if (!uiState || !virtualModel) {
          return undefined;
        }

        return {
          lineNumber: uiState.lineNumber,
          additionalLines: uiState.additionalLines,
          targetTextModel: uiState.targetTextModel,
          virtualModel,
        };
      }),
    ),
  );

  public ownsViewZone(viewZoneId: string): boolean {
    return this.additionalLinesWidget.viewZoneId === viewZoneId;
  }
}

export class AdditionalLinesWidget extends Disposable {
  private _viewZoneId: string | undefined = undefined;
  public get viewZoneId(): string | undefined {
    return this._viewZoneId;
  }

  private readonly editorOptionsChanged = observableSignalFromEvent(
    'editorOptionChanged',
    Event.filter(
      this.editor.onDidChangeConfiguration,
      (e) =>
        e.hasChanged(EditorOption.disableMonospaceOptimizations) ||
        e.hasChanged(EditorOption.stopRenderingLineAfter) ||
        e.hasChanged(EditorOption.renderWhitespace) ||
        e.hasChanged(EditorOption.renderControlCharacters) ||
        e.hasChanged(EditorOption.fontLigatures) ||
        e.hasChanged(EditorOption.fontInfo) ||
        e.hasChanged(EditorOption.lineHeight),
    ),
  );

  constructor(
    private readonly editor: ICodeEditor,
    private readonly lines: IObservable<
      | { targetTextModel: ITextModel; lineNumber: number; additionalLines: LineData[]; virtualModel: ITextModel }
      | undefined
    >,
  ) {
    super();

    this._register(
      autorun((reader) => {
        const lines = this.lines.read(reader);
        this.editorOptionsChanged.read(reader);

        if (lines) {
          this.updateLines(lines.lineNumber, lines.additionalLines, lines.virtualModel);
        } else {
          this.clear();
        }
      }),
    );
  }

  public override dispose(): void {
    super.dispose();
    this.clear();
  }

  private clear(): void {
    this.editor.changeViewZones((changeAccessor) => {
      if (this._viewZoneId) {
        changeAccessor.removeZone(this._viewZoneId);
        this._viewZoneId = undefined;
      }
    });
  }

  private updateLines(lineNumber: number, additionalLines: LineData[], virtualModel: ITextModel): void {
    const textModel = this.editor.getModel();
    if (!textModel) {
      return;
    }

    const { tabSize } = textModel.getOptions();

    this.editor.changeViewZones((changeAccessor) => {
      if (this._viewZoneId) {
        changeAccessor.removeZone(this._viewZoneId);
        this._viewZoneId = undefined;
      }

      if (additionalLines.length > 0) {
        const domNode = document.createElement('div');
        const lineDatas = additionalLines
          .map((text, index) => {
            const line = lineNumber + index + 1;
            virtualModel.tokenization.forceTokenization(line);

            return {
              content: text.content,
              decorations: text.decorations.map(
                (dec) =>
                  new LineDecoration(
                    dec.startColumn,
                    dec.endColumn,
                    styles.inline_completion_ghost_text_decoration,
                    dec.type,
                  ),
              ),
              lineTokens: virtualModel.tokenization.getLineTokens(line),
            };
          })
          .filter(isDefined);

        renderLines(domNode, tabSize, lineDatas, this.editor.getOptions());

        this._viewZoneId = changeAccessor.addZone({
          afterLineNumber: lineNumber,
          heightInLines: additionalLines.length,
          domNode,
          afterColumnAffinity: PositionAffinity.Right,
        });
      }
    });
  }
}

import { Injectable, Optional } from '@opensumi/di';
import { Disposable, Emitter, Event } from '@opensumi/ide-core-common';
import {
  IModelDecorationsChangeAccessor,
  TrackedRangeStickiness,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { ModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';
import { IModelDecorationsChangedEvent } from '@opensumi/monaco-editor-core/esm/vs/editor/common/textModelEvents';

import { ICodeEditor, IModelDeltaDecoration } from '../../../monaco-api/editor';
import { DECORATIONS_CLASSNAME, EditorViewType } from '../types';
import { BaseCodeEditor } from '../view/editors/baseCodeEditor';
import { GuidelineWidget } from '../view/guideline-widget';

import { InnerRange } from './inner-range';
import { LineRange } from './line-range';

export interface IDiffDecoration {
  id: string;
  readonly editorDecoration: IModelDeltaDecoration;
}

@Injectable({ multiple: false })
export class MergeEditorDecorations extends Disposable {
  private deltaDecoration: IDiffDecoration[] = [];
  private lineWidgetSet: Set<GuidelineWidget> = new Set();

  private readonly _onDidChangeLineWidget = new Emitter<void>();
  private readonly onDidChangeLineWidget: Event<void> = this._onDidChangeLineWidget.event;

  private readonly _onDidChangeDecorations = new Emitter<MergeEditorDecorations>();
  public readonly onDidChangeDecorations: Event<MergeEditorDecorations> = this._onDidChangeDecorations.event;

  private get editor(): ICodeEditor {
    return this.codeEditor.getEditor();
  }

  constructor(
    @Optional() private readonly codeEditor: BaseCodeEditor,
    @Optional() public readonly editorViewType: EditorViewType,
  ) {
    super();
    this.initListenEvent();
  }

  private initListenEvent(): void {
    this.addDispose(
      Event.any<IModelDecorationsChangedEvent | void>(
        this.editor.onDidChangeModelDecorations,
        this.onDidChangeLineWidget,
      )(() => {
        this.launchChange();
      }),
    );
  }

  public launchChange(): void {
    this._onDidChangeDecorations.fire(this);
  }

  public createLineDecoration(range: LineRange): IDiffDecoration[] {
    const begin = range.startLineNumber;
    const end = Math.max(range.startLineNumber, range.endLineNumberExclusive - 1);
    const length = end - begin + 1;

    const options = ModelDecorationOptions.register({
      description: range.id,
      className: DECORATIONS_CLASSNAME.combine(
        DECORATIONS_CLASSNAME.diff_line_background,
        DECORATIONS_CLASSNAME.range_type[range.type],
      ),
      isWholeLine: true,
      stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
    });

    return Array.from({ length }).map((_, idx) => {
      let borderClassName = ' ';
      const wrapClassName = ` ${DECORATIONS_CLASSNAME.conflict_wrap} `;

      if (length !== 1) {
        borderClassName +=
          idx === 0
            ? DECORATIONS_CLASSNAME.stretch_bottom
            : idx === length - 1
            ? DECORATIONS_CLASSNAME.stretch_top
            : DECORATIONS_CLASSNAME.combine(DECORATIONS_CLASSNAME.stretch_top, DECORATIONS_CLASSNAME.stretch_bottom);
      }

      if (range.isComplete) {
        borderClassName += wrapClassName;
      }

      const mergeOptions = {
        ...options,
        ...this.codeEditor.getMonacoDecorationOptions(options, range),
      };

      return {
        id: '',
        editorDecoration: {
          range: {
            startLineNumber: begin + idx,
            startColumn: 0,
            endLineNumber: begin + idx,
            endColumn: Number.MAX_SAFE_INTEGER,
          },
          options: {
            ...mergeOptions,
            className: (mergeOptions.className || '') + borderClassName,
            marginClassName: (mergeOptions.marginClassName || '') + borderClassName,
            linesDecorationsClassName: (mergeOptions.linesDecorationsClassName || '') + borderClassName,
          },
        },
      };
    });
  }

  public createInnerCharDecoration(range: InnerRange): IDiffDecoration {
    return {
      id: '',
      editorDecoration: {
        range,
        options: ModelDecorationOptions.register({
          description: range.toString(),
          className: DECORATIONS_CLASSNAME.combine(DECORATIONS_CLASSNAME.diff_inner_char_background, range.type),
          isWholeLine: false,
        }),
      },
    };
  }

  public createGuideLineWidget(range: LineRange): GuidelineWidget {
    const guidelineWidget = new GuidelineWidget(this.editor);
    guidelineWidget.create();
    if (range.isComplete) {
      guidelineWidget.addClassName(DECORATIONS_CLASSNAME.dashed);
    }
    guidelineWidget
      .addClassName(DECORATIONS_CLASSNAME.range_type[range.type])
      .showByLine(Math.max(0, Math.max(0, range.startLineNumber - 1)));
    return guidelineWidget;
  }

  private setDecorations(ranges: LineRange[], innerChanges: InnerRange[][]): void {
    this.editor.changeDecorations((accessor: IModelDecorationsChangeAccessor) => {
      const newDecorations: IDiffDecoration[] = [];

      for (const range of ranges) {
        if (range.isEmpty) {
          const guidelineWidget = this.createGuideLineWidget(range);
          this.lineWidgetSet.add(guidelineWidget);
          this._onDidChangeLineWidget.fire();
        } else {
          newDecorations.push(...this.createLineDecoration(range));
        }
      }

      for (const innerRange of innerChanges) {
        for (const range of innerRange) {
          if (!range.isEmpty()) {
            newDecorations.push(this.createInnerCharDecoration(range));
          }
        }
      }

      newDecorations.forEach((d) => {
        d.id = accessor.addDecoration(d.editorDecoration.range, d.editorDecoration.options);
      });
      this.deltaDecoration = newDecorations;
    });
  }

  private cleanUpLineWidget(widgets: Set<GuidelineWidget>): void {
    widgets.forEach((w) => {
      w.hide();
    });
    widgets.clear();
  }

  public clearDecorations(): this {
    this.editor.changeDecorations((accessor) => {
      for (const decoration of this.deltaDecoration) {
        accessor.removeDecoration(decoration.id);
      }

      this.deltaDecoration = [];
    });

    this.cleanUpLineWidget(this.lineWidgetSet);
    return this;
  }

  public updateDecorations(ranges: LineRange[], innerChanges: InnerRange[][]): this {
    this.clearDecorations();
    this.render(ranges, innerChanges);
    return this;
  }

  public getDecorations(): IDiffDecoration[] {
    return this.deltaDecoration;
  }

  public getLineWidgets(): GuidelineWidget[] {
    return Array.from(this.lineWidgetSet.keys());
  }

  public render(ranges: LineRange[], innerChanges: InnerRange[][]): void {
    this.setDecorations(ranges, innerChanges);
  }

  public dispose(): void {
    super.dispose();

    this.lineWidgetSet.forEach((w) => w.dispose());
  }
}

import { Injectable, Optional } from '@opensumi/di';
import { Disposable, Emitter, Event } from '@opensumi/ide-core-common';
import { IRange, Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { ModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';
import { IModelDecorationsChangedEvent } from '@opensumi/monaco-editor-core/esm/vs/editor/common/textModelEvents';

import { ICodeEditor, IModelDeltaDecoration } from '../../../monaco-api/editor';
import { EditorViewType, LineRangeType } from '../types';
import { BaseCodeEditor } from '../view/editors/baseCodeEditor';
import { GuidelineWidget } from '../view/guideline-widget';

import { LineRange } from './line-range';

export interface IRenderChangesInput {
  ranges: LineRange;
  type: LineRangeType;
}

export interface IRenderInnerChangesInput {
  ranges: Range[];
  type: LineRangeType;
}

export interface IDiffDecoration {
  id: string;
  readonly editorDecoration: IModelDeltaDecoration;
}

@Injectable({ multiple: false })
export class MergeEditorDecorations extends Disposable {
  private deltaDecoration: IDiffDecoration[] = [];
  private retainDecoration: IDiffDecoration[] = [];

  private lineWidgetSet: Set<GuidelineWidget> = new Set();
  private retainLineWidgetSet: Set<GuidelineWidget> = new Set();

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
        this._onDidChangeDecorations.fire(this);
      }),
    );
  }

  private createLineDecoration(range: LineRange, type: LineRangeType): IDiffDecoration {
    const options = ModelDecorationOptions.register({
      description: range.id,
      className: `merge-editor-diff-line-background ${type}`,
      isWholeLine: true,
    });

    return {
      id: '',
      editorDecoration: {
        range: {
          startLineNumber: range.startLineNumber,
          startColumn: 0,
          endLineNumber: range.endLineNumberExclusive - 1,
          endColumn: Number.MAX_SAFE_INTEGER,
        },
        options: {
          ...options,
          ...this.codeEditor.getMonacoDecorationOptions(options),
        },
      },
    };
  }

  private createInnerCharDecoration(range: Range, type: LineRangeType): IDiffDecoration {
    return {
      id: '',
      editorDecoration: {
        range,
        options: ModelDecorationOptions.register({
          description: range.toString(),
          className: `merge-editor-diff-inner-char-background ${type}`,
          isWholeLine: false,
        }),
      },
    };
  }

  private setDecorations(ranges: IRenderChangesInput[], innerChanges: IRenderInnerChangesInput[]): void {
    this.editor.changeDecorations((accessor) => {
      const newDecorations: IDiffDecoration[] = this.retainDecoration;
      this.retainLineWidgetSet.forEach((widget) => {
        widget.showByLine(widget.getRecordLine());
        this.lineWidgetSet.add(widget);
      });

      for (const range of ranges) {
        if (range.ranges.isEmpty) {
          const guidelineWidget = new GuidelineWidget(this.editor);
          guidelineWidget.create();
          guidelineWidget
            .setLineRangeType(range.type)
            .showByLine(Math.max(0, Math.max(0, range.ranges.startLineNumber - 1)));

          this.lineWidgetSet.add(guidelineWidget);
          this._onDidChangeLineWidget.fire();
        } else {
          newDecorations.push(this.createLineDecoration(range.ranges, range.type));
        }
      }

      for (const innerRange of innerChanges) {
        const { ranges, type } = innerRange;
        for (const range of ranges) {
          if (!range.isEmpty()) {
            newDecorations.push(this.createInnerCharDecoration(range, type));
          }
        }
      }

      accessor
        .deltaDecorations(
          this.deltaDecoration.map((d) => d.id),
          newDecorations.map((d) => d.editorDecoration),
        )
        .forEach((id, i) => (newDecorations[i].id = id));
      this.deltaDecoration = newDecorations;
    });
  }

  private cleanUpLineWidget(widgets: Set<GuidelineWidget>): void {
    widgets.forEach((w) => {
      w.hide();
    });
    widgets.clear();
  }

  public clearDecorations(): void {
    this.editor.changeDecorations((accessor) => {
      for (const decoration of this.deltaDecoration) {
        accessor.removeDecoration(decoration.id);
      }

      this.deltaDecoration = [];
    });

    this.cleanUpLineWidget(this.lineWidgetSet);
  }

  public clearDecorationsByRange(range: LineRange): void {
    if (range.isEmpty) {
      for (const matchLineWidget of this.lineWidgetSet.values()) {
        if (matchLineWidget.getRecordLine() === Math.max(0, range.startLineNumber - 1)) {
          matchLineWidget.hide();
        }
      }
    } else {
      this.editor.changeDecorations((accessor) => {
        const findLineDecoration = this.deltaDecoration.find(
          (d) => d.editorDecoration.options.description === range.id,
        );
        if (findLineDecoration) {
          accessor.removeDecoration(findLineDecoration.id);

          // 找出这个 LineRange 范围内的 innerChange
          const findInnerChange = this.deltaDecoration.filter((d) =>
            range.isInclude(d.editorDecoration.range as Range),
          );
          findInnerChange.forEach((inner) => {
            accessor.removeDecoration(inner.id);
          });
        }
      });
    }
  }

  public updateDecorations(ranges: IRenderChangesInput[], innerChanges: IRenderInnerChangesInput[]): void {
    this.clearDecorations();
    this.render(ranges, innerChanges);
  }

  public getDecorations(): IDiffDecoration[] {
    return this.deltaDecoration;
  }

  public getLineWidgets(): GuidelineWidget[] {
    return Array.from(this.lineWidgetSet.keys());
  }

  public setRetainDecoration(retain: IDiffDecoration[] = []): this {
    this.retainDecoration = retain;
    return this;
  }

  public setRetainLineWidget(retain: GuidelineWidget[] = []): this {
    this.cleanUpLineWidget(this.retainLineWidgetSet);

    retain.forEach((r) => {
      this.retainLineWidgetSet.add(r);
    });
    return this;
  }

  public render(ranges: IRenderChangesInput[], innerChanges: IRenderInnerChangesInput[]): void {
    this.setDecorations(ranges, innerChanges);
  }

  public dispose(): void {
    super.dispose();

    this.lineWidgetSet.forEach((w) => w.dispose());
    this.retainLineWidgetSet.forEach((w) => w.dispose());
  }
}

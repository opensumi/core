import { orderBy } from 'lodash';

import { Disposable } from '@opensumi/ide-core-common';
import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { IFoldedCodeWidgetContentProvider } from '../common';

import { ZoneWidget } from './zone-widget';

export class FoldedCodeWidget extends ZoneWidget {
  protected _fillContainer(container: HTMLElement): void {}
  protected applyClass() {}

  protected applyStyle() {}

  constructor(
    protected readonly editor: IMonacoCodeEditor,
    protected readonly index: number,
    protected provider: IFoldedCodeWidgetContentProvider,
  ) {
    super(editor);
  }

  show(where: monaco.IRange) {
    super.show(
      {
        startLineNumber: where.startLineNumber,
        endLineNumber: where.startLineNumber,
        startColumn: where.startColumn,
        endColumn: where.endColumn,
      },
      1,
    );
    this.provider.renderInforOverlay(this._container, this.index);
  }
}

export class FoldedCodeWidgetGroup extends Disposable {
  protected widgets: Array<FoldedCodeWidget> = [];

  private _orderRanges(ranges: monaco.IRange[]) {
    return orderBy(ranges, ['startLineNumber'], ['asc']);
  }

  private _split(ranges: monaco.IRange[], end: number) {
    const another: monaco.IRange[] = [];
    let start = 1;

    ranges.forEach(({ startLineNumber, endLineNumber }) => {
      if (startLineNumber !== 1) {
        another.push({
          startLineNumber: start,
          endLineNumber: startLineNumber - 1,
          startColumn: 1,
          endColumn: 1,
        });
      }
      start = endLineNumber + 1;
    });

    if (start < end) {
      another.push({
        startLineNumber: start,
        endLineNumber: end,
        startColumn: 1,
        endColumn: 1,
      });
    }

    return another;
  }

  constructor(protected readonly editor: IMonacoCodeEditor, protected provider: IFoldedCodeWidgetContentProvider) {
    super();

    this.editor.updateOptions({
      folding: false,
      readOnly: true,
    });

    this.addDispose({
      dispose: () => {
        this.widgets.forEach((widget) => {
          widget.hide();
          widget.dispose();
        });
      },
    });
  }

  fold(showRanges: monaco.IRange[]) {
    if (!this.editor.getModel()) {
      throw new Error('Can not fold a editor without any text model');
    }

    const ordered = this._orderRanges(showRanges);
    const foldRanges = this._split(ordered, this.editor.getModel()!.getLineCount());
    (this.editor as any)._modelData.viewModel.setHiddenAreas(foldRanges);

    if (ordered[0].startLineNumber !== 1) {
      const widget = new FoldedCodeWidget(this.editor, 0, this.provider);
      widget.show({ startLineNumber: 0, endLineNumber: 0, startColumn: 1, endColumn: 1 });
      this.widgets.push(widget);
    }

    ordered.forEach((range) => {
      const widget = new FoldedCodeWidget(this.editor, this.widgets.length, this.provider);
      widget.show({ ...range, startLineNumber: range.endLineNumber });
      this.widgets.push(widget);
    });
  }

  dispose() {
    (this.editor as any)._modelData.viewModel.setHiddenAreas([]);
    this.widgets.forEach((widget) => {
      widget.hide();
      widget.dispose();
    });
    this.widgets = [];
  }
}

import { orderBy } from 'lodash';
import { Disposable } from '@ali/ide-core-common';
import { ZoneWidget } from './zone-widget';
import { IFoldedCodeWidgetContentProvider } from '../common';

export class FoldedCodeWidget extends ZoneWidget {

  protected applyClass() {
  }

  protected applyStyle() {
  }

  constructor(
    protected readonly editor: monaco.editor.ICodeEditor,
    protected provider: IFoldedCodeWidgetContentProvider,
  ) {
    super(editor);
  }

  show(where: monaco.IRange) {
    super.show({
      startLineNumber: where.startLineNumber,
      endLineNumber: where.startLineNumber,
      startColumn: where.startColumn,
      endColumn: where.endColumn,
    }, 1);
    (this.editor as any)._modelData.viewModel.setHiddenAreas([where]);
    this.provider.renderInforOverlay(this._container, where);
  }
}

export class FoldedCodeWidgetGroup extends Disposable {
  protected widgets: Map<string, FoldedCodeWidget>;
  protected foldRanges: monaco.IRange[];
  protected model: monaco.editor.ITextModel;

  private _orderRanges(ranges: monaco.IRange[]) {
    return orderBy(ranges, ['startLineNumber'], ['asc']);
  }

  private _split(ranges: monaco.IRange[], end: number) {
    const another: monaco.IRange[] = [];
    let start = 1;
    const ordered = this._orderRanges(ranges);
    ordered.forEach(({ startLineNumber, endLineNumber }) => {
      if (start <= startLineNumber) {
        start = endLineNumber + 1;
        return;
      }

      if (start > startLineNumber) {
        another.push({
          startLineNumber: start,
          endLineNumber: startLineNumber - 1,
          startColumn: 1,
          endColumn: 1,
        });
      }
    });

    if (start <= end) {
      another.push({
        startLineNumber: start,
        endLineNumber: end,
        startColumn: 1,
        endColumn: 1,
      });
    }

    return another;
  }

  constructor(
    protected readonly editor: monaco.editor.ICodeEditor,
    protected showRanges: monaco.IRange[],
    protected provider: IFoldedCodeWidgetContentProvider,
  ) {
    super();

    editor.updateOptions({
      folding: false,
      readOnly: true,
    });

    this.model = editor.getModel()!;

    if (!this.model) {
      throw new Error('Can not fold a editor without any text model');
    }

    this.foldRanges = this._split(this.showRanges, this.model.getLineCount());

    this.addDispose({
      dispose: () => {
        this.widgets.forEach((widget) => {
          widget.hide();
          widget.dispose();
        });
      },
    });
  }

  foldAll() {
    this.foldRanges.forEach((range) => {
      const widget = new FoldedCodeWidget(this.editor, this.provider);
      widget.show(range);
      this.widgets.set(`${range.startLineNumber}:${range.endLineNumber}`, widget);
    });
  }

  unfold(foldRange: monaco.IRange) {
    const index = `${foldRange.startLineNumber}:${foldRange.endLineNumber}`;
    const widget = this.widgets.get(index);

    if (widget) {
      const delIndex = this.foldRanges.findIndex((r) => r.startLineNumber === foldRange.startLineNumber);
      this.foldRanges.splice(delIndex, 1);
      this.showRanges = this._split(this.foldRanges, this.model.getLineCount());
      widget.hide();
      widget.dispose();
      this.widgets.delete(index);
    }
  }
}

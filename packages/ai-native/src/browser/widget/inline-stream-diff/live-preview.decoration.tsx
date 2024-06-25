import React from 'react';
import ReactDOMClient from 'react-dom/client';

import { Disposable } from '@opensumi/ide-core-common';
import {
  ICodeEditor,
  IEditorDecorationsCollection,
  IPosition,
  IRange,
  Position,
  Range,
  Selection,
} from '@opensumi/ide-monaco';
import { LineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/lineRange';
import { ModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';
import { ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';

import styles from './inline-stream-diff.module.less';

class RemovedZoneWidget extends ZoneWidget {
  private root: ReactDOMClient.Root;

  _fillContainer(container: HTMLElement): void {
    this.root = ReactDOMClient.createRoot(container);
  }

  renderText(text: string): void {
    this.root.render(<div className={styles.inline_diff_remove_zone}>{text}</div>);
  }

  override revealRange(): void {}
  dispose(): void {
    this.root.unmount();
    super.dispose();
  }
}

export class LivePreviewDiffDecorationModel extends Disposable {
  private selectionDec: IEditorDecorationsCollection;

  private activeLineDec: IEditorDecorationsCollection;
  private addedRangeDec: IEditorDecorationsCollection;

  private removedZoneWidgets: Array<RemovedZoneWidget> = [];

  constructor(private readonly monacoEditor: ICodeEditor, private readonly selection: Selection) {
    super();

    this.selectionDec = this.monacoEditor.createDecorationsCollection();

    this.activeLineDec = this.monacoEditor.createDecorationsCollection();
    this.addedRangeDec = this.monacoEditor.createDecorationsCollection();

    this.selectionDec.set([
      {
        range: Range.fromPositions(
          { lineNumber: this.selection.startLineNumber, column: 1 },
          { lineNumber: this.selection.endLineNumber, column: Number.MAX_SAFE_INTEGER },
        ),
        options: ModelDecorationOptions.register({
          description: 'zone-decoration',
          className: styles.inline_diff_zone,
          isWholeLine: true,
        }),
      },
    ]);
  }

  override dispose(): void {
    super.dispose();

    this.selectionDec.clear();
    this.clearActiveLine();
    this.clearAddedLine();
    this.clearRemovedWidgets();
  }

  public showRemovedWidgetByLineNumber(lineNumber: number, heightInLines: number, text: string): void {
    const position = new Position(lineNumber, this.monacoEditor.getModel()!.getLineMaxColumn(lineNumber) || 1);

    const widget = new RemovedZoneWidget(this.monacoEditor, {
      showInHiddenAreas: true,
      showFrame: false,
      showArrow: false,
    });

    widget.create();
    widget.renderText(text);
    widget.show(position, heightInLines);

    this.removedZoneWidgets.push(widget);
  }

  public getZone(): Range {
    const selectionRange = this.selectionDec.getRange(0)!;

    const addedIndex = this.addedRangeDec.getRanges().length - 1;
    const latestAddedRange = this.addedRangeDec.getRange(Math.max(0, addedIndex));

    if (!latestAddedRange) {
      return selectionRange;
    }

    return selectionRange.setEndPosition(
      Math.max(selectionRange.endLineNumber, latestAddedRange.endLineNumber),
      Math.max(selectionRange.endColumn, latestAddedRange.endColumn),
    );
  }

  public touchActiveLine(lineNumber: number) {
    const zone = this.getZone();

    this.activeLineDec.set([
      {
        range: Range.fromPositions(
          {
            lineNumber: zone.startLineNumber + lineNumber - 1,
            column: 0,
          },
          {
            lineNumber: zone.startLineNumber + lineNumber - 1,
            column: Number.MAX_SAFE_INTEGER,
          },
        ),
        options: ModelDecorationOptions.register({
          description: 'activeLine-decoration',
          isWholeLine: true,
          className: styles.inline_diff_current,
        }),
      },
    ]);
  }

  public touchAddedRange(ranges: LineRange[]) {
    const zone = this.getZone();

    this.addedRangeDec.set(
      ranges.map((range) => ({
        range: Range.fromPositions(
          {
            lineNumber: zone.startLineNumber + range.startLineNumber - 1,
            column: 0,
          },
          {
            lineNumber: zone.startLineNumber + range.endLineNumberExclusive - 2,
            column: Number.MAX_SAFE_INTEGER,
          },
        ),
        options: ModelDecorationOptions.register({
          description: 'added-range-decoration',
          isWholeLine: true,
          className: styles.inline_diff_added_range,
        }),
      })),
    );
  }

  public clearActiveLine() {
    this.activeLineDec.clear();
  }

  public clearAddedLine() {
    this.addedRangeDec.clear();
  }

  public clearRemovedWidgets() {
    this.removedZoneWidgets.forEach((widget) => {
      widget.dispose();
    });
    this.removedZoneWidgets = [];
  }
}

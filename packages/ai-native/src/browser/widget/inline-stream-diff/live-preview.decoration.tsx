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
  private zoneDec: IEditorDecorationsCollection;

  private activeLineDec: IEditorDecorationsCollection;
  private addedRangeDec: IEditorDecorationsCollection;

  private removedZoneWidgets: Array<RemovedZoneWidget> = [];

  constructor(private readonly monacoEditor: ICodeEditor) {
    super();

    this.zoneDec = this.monacoEditor.createDecorationsCollection();

    this.activeLineDec = this.monacoEditor.createDecorationsCollection();
    this.addedRangeDec = this.monacoEditor.createDecorationsCollection();
  }

  override dispose(): void {
    super.dispose();

    this.zoneDec.clear();
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

  public setZone(selection: Selection): void {
    this.zoneDec.set([
      {
        range: Range.fromPositions(
          { lineNumber: selection.startLineNumber, column: 1 },
          { lineNumber: selection.endLineNumber, column: Number.MAX_SAFE_INTEGER },
        ),
        options: ModelDecorationOptions.register({
          description: 'zone-decoration',
          className: styles.inline_diff_zone,
        }),
      },
    ]);
  }

  public getZone(): Range {
    return this.zoneDec.getRange(0)!;
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

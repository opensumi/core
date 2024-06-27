import React, { useEffect } from 'react';
import ReactDOMClient from 'react-dom/client';

import { StackingLevel } from '@opensumi/ide-core-browser';
import { Disposable } from '@opensumi/ide-core-common';
import { ICodeEditor, IEditorDecorationsCollection, Position, Range, Selection } from '@opensumi/ide-monaco';
import { EditorOption } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { LineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/lineRange';
import { ModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';
import { LineTokens } from '@opensumi/monaco-editor-core/esm/vs/editor/common/tokens/lineTokens';
import { ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';

import { renderLines } from '../ghost-text-widget/index';

import styles from './inline-stream-diff.module.less';

const ZoneDescription = 'zone-description';
const ActiveLineDecoration = 'activeLine-decoration';
const AddedRangeDecoration = 'added-range-decoration';
const PendingRangeDecoration = 'pending-range-decoration';

const RemovedWidgetComponent = ({ dom, marginWidth }) => {
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dom && ref && ref.current) {
      ref.current.appendChild(dom);
    }
  }, [dom, ref]);

  return <div className={styles.inline_diff_remove_zone} ref={ref} style={{ marginLeft: marginWidth + 'px' }}></div>;
};

class RemovedZoneWidget extends ZoneWidget {
  private root: ReactDOMClient.Root;

  _fillContainer(container: HTMLElement): void {
    container.classList.add(styles.inline_diff_remove_zone_widget_container);
    this.root = ReactDOMClient.createRoot(container);
  }

  renderDom(dom: HTMLElement, options: { marginWidth: number }): void {
    this.root.render(<RemovedWidgetComponent dom={dom} marginWidth={options.marginWidth} />);
  }

  override revealRange(): void {}
  dispose(): void {
    this.root.unmount();
    super.dispose();
  }
}

interface ITextLinesTokens {
  text: string;
  lineTokens: LineTokens;
}

export class LivePreviewDiffDecorationModel extends Disposable {
  private zoneDec: IEditorDecorationsCollection;

  private activeLineDec: IEditorDecorationsCollection;
  private pendingRangeDec: IEditorDecorationsCollection;
  private addedRangeDec: IEditorDecorationsCollection;

  private removedZoneWidgets: Array<RemovedZoneWidget> = [];
  private rawOriginalTextLinesTokens: ITextLinesTokens[] = [];

  private zone: LineRange;

  constructor(private readonly monacoEditor: ICodeEditor, private readonly selection: Selection) {
    super();

    this.zoneDec = this.monacoEditor.createDecorationsCollection();

    this.activeLineDec = this.monacoEditor.createDecorationsCollection();
    this.addedRangeDec = this.monacoEditor.createDecorationsCollection();
    this.pendingRangeDec = this.monacoEditor.createDecorationsCollection();

    this.updateZone(
      LineRange.fromRangeInclusive(
        Range.fromPositions(
          { lineNumber: this.selection.startLineNumber, column: 1 },
          { lineNumber: this.selection.endLineNumber, column: Number.MAX_SAFE_INTEGER },
        ),
      ),
    );
  }

  override dispose(): void {
    super.dispose();

    this.zoneDec.clear();

    this.clearPendingLine();
    this.clearActiveLine();
    this.clearAddedLine();
    this.clearRemovedWidgets();
  }

  public calcTextLinesTokens(rawOriginalTextLines: string[]): void {
    this.rawOriginalTextLinesTokens = rawOriginalTextLines.map((text, index) => {
      const model = this.monacoEditor.getModel()!;
      const zone = this.getZone();
      const lineNumber = zone.startLineNumber + index;

      model.tokenization.forceTokenization(lineNumber);
      const lineTokens = model.tokenization.getLineTokens(lineNumber);

      return {
        text,
        lineTokens,
      };
    });
  }

  public showRemovedWidgetByLineNumber(
    lineNumber: number,
    removedLinesOriginalRange: LineRange,
    texts: string[],
  ): void {
    const position = new Position(lineNumber, this.monacoEditor.getModel()!.getLineMaxColumn(lineNumber) || 1);
    const heightInLines = texts.length;

    const widget = new RemovedZoneWidget(this.monacoEditor, {
      showInHiddenAreas: true,
      showFrame: false,
      showArrow: false,
    });

    widget.create();

    const dom = document.createElement('div');
    renderLines(
      dom,
      this.monacoEditor.getOption(EditorOption.tabIndex),
      texts.map((content, index) => ({
        content,
        decorations: [],
        lineTokens: this.rawOriginalTextLinesTokens[removedLinesOriginalRange.startLineNumber - 1 + index].lineTokens,
      })),
      this.monacoEditor.getOptions(),
    );

    const layoutInfo = this.monacoEditor.getOption(EditorOption.layoutInfo);
    const marginWidth = layoutInfo.contentLeft;

    widget.renderDom(dom, { marginWidth });
    widget.show(position, heightInLines);

    this.removedZoneWidgets.push(widget);
  }

  public updateZone(newZone: LineRange): void {
    this.zone = newZone;

    this.zoneDec.set([
      {
        range: newZone.toInclusiveRange()!,
        options: ModelDecorationOptions.register({
          description: ZoneDescription,
          className: styles.inline_diff_zone,
          isWholeLine: true,
        }),
      },
    ]);
  }

  public getZone(): LineRange {
    return this.zone;
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
          description: ActiveLineDecoration,
          isWholeLine: true,
          className: styles.inline_diff_current,
          zIndex: StackingLevel.WorkbenchEditor,
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
            column: 1,
          },
          {
            lineNumber: zone.startLineNumber + range.endLineNumberExclusive - 2,
            column: Number.MAX_SAFE_INTEGER,
          },
        ),
        options: ModelDecorationOptions.register({
          description: AddedRangeDecoration,
          isWholeLine: true,
          className: styles.inline_diff_added_range,
        }),
      })),
    );
  }

  public touchPendingRange(range: LineRange) {
    const zone = this.getZone();

    this.pendingRangeDec.set([
      {
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
          description: PendingRangeDecoration,
          isWholeLine: true,
          className: styles.inline_diff_pending_range,
        }),
      },
    ]);
  }

  public clearPendingLine() {
    this.pendingRangeDec.clear();
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

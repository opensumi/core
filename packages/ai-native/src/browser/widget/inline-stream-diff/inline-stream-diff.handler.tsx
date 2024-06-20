import React from 'react';
import ReactDOMClient from 'react-dom/client';

import { Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-browser';
import { ICodeEditor, IEditorDecorationsCollection, ITextModel, Range, Selection } from '@opensumi/ide-monaco';
import { StandaloneServices } from '@opensumi/ide-monaco/lib/browser/monaco-api/services';
import { LineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/lineRange';
import { linesDiffComputers } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputers';
import { DetailedLineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/rangeMapping';
import { ModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';
import { ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';

import styles from './inline-stream-diff.module.less';

interface IRangeChangeData {
  removedTextLines: string[];
  removedLinesOriginalRange: LineRange;
  addedRange: LineRange;
  relativeInnerChanges:
    | {
        originalRange: Range;
        modifiedRange: Range;
      }[]
    | undefined;
}

interface IComputeDiffData {
  newFullRangeTextLines: string[];
  changes: IRangeChangeData[];
  activeLine: number;
  pendingRange: LineRange;
}

class DecorationModel {
  private zoneDec: IEditorDecorationsCollection;

  private activeLineDec: IEditorDecorationsCollection;
  private addedRangeDec: IEditorDecorationsCollection;
  private pendingRangeDec: IEditorDecorationsCollection;

  constructor(private readonly monacoEditor: ICodeEditor) {
    this.zoneDec = this.monacoEditor.createDecorationsCollection();

    this.activeLineDec = this.monacoEditor.createDecorationsCollection();
    this.addedRangeDec = this.monacoEditor.createDecorationsCollection();
    this.pendingRangeDec = this.monacoEditor.createDecorationsCollection();
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
    this.activeLineDec.set([
      {
        range: Range.fromPositions(
          {
            lineNumber: this.zoneDec.getRange(0)!.startLineNumber + lineNumber - 1,
            column: 0,
          },
          {
            lineNumber: this.zoneDec.getRange(0)!.startLineNumber + lineNumber - 1,
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
}

@Injectable({ multiple: true })
export class InlineStreamDiffHandler extends Disposable {
  private modifiedModel: ITextModel;
  private rawOriginalTextLines: string[];
  private decorationModel: DecorationModel;

  constructor(private readonly monacoEditor: ICodeEditor, private readonly selection: Selection) {
    super();

    this.decorationModel = new DecorationModel(this.monacoEditor);
    this.decorationModel.setZone(this.selection);

    const modelService = StandaloneServices.get(IModelService);
    this.modifiedModel = modelService.createModel('', null);

    this.rawOriginalTextLines = this.getNewOriginalTextLines();
  }

  private get originalModel(): ITextModel {
    return this.monacoEditor.getModel()!;
  }

  private get defaultLinesDiffComputer() {
    return linesDiffComputers.getDefault();
  }

  private getNewOriginalTextLines(): string[] {
    const zone = this.decorationModel.getZone();

    return Array.from({
      length: zone.endLineNumber - zone.startLineNumber + 1,
    }).map((_, i) => this.originalModel.getLineContent(zone.startLineNumber + i));
  }

  private computeDiff(originalTextLines: string[], newTextLines: string[]): IComputeDiffData {
    const computeResult = this.defaultLinesDiffComputer.computeDiff(originalTextLines, newTextLines, {
      computeMoves: false,
      maxComputationTimeMs: 200,
      ignoreTrimWhitespace: false,
    });

    let changes = computeResult.changes;

    if (computeResult.hitTimeout) {
      changes = [
        new DetailedLineRangeMapping(
          new LineRange(1, originalTextLines.length + 1),
          new LineRange(1, newTextLines.length + 1),
          undefined,
        ),
      ];
    }

    const resultChanges: IRangeChangeData[] = [];
    let removedTextLines: string[] = [];

    for (const change of changes) {
      if (change.modified.endLineNumberExclusive === newTextLines.length + 1) {
        removedTextLines = originalTextLines.slice(
          change.original.startLineNumber - 1,
          change.original.endLineNumberExclusive - 1,
        );
        if (change.modified.isEmpty) {
          continue;
        }

        resultChanges.push({
          removedTextLines: [],
          removedLinesOriginalRange: new LineRange(change.original.startLineNumber, change.original.startLineNumber),
          addedRange: change.modified,
          relativeInnerChanges: undefined,
        });
      } else {
        resultChanges.push({
          removedTextLines: originalTextLines.slice(
            change.original.startLineNumber - 1,
            change.original.endLineNumberExclusive - 1,
          ),
          removedLinesOriginalRange: change.original,
          addedRange: change.modified,
          relativeInnerChanges: change.innerChanges
            ? change.innerChanges.map((innerChange) => ({
                originalRange: innerChange.originalRange.delta(-change.original.startLineNumber + 1),
                modifiedRange: innerChange.modifiedRange.delta(-change.modified.startLineNumber + 1),
              }))
            : undefined,
        });
      }
    }

    const newFullRangeTextLines = [...newTextLines, ...removedTextLines];

    let activeLine: number = 0;
    let pendingRange = new LineRange(1, 1);

    if (removedTextLines.length > 0) {
      activeLine = newTextLines.length + 1;
      pendingRange = new LineRange(newTextLines.length + 1, newTextLines.length + 1 + removedTextLines.length);
    }

    return {
      changes: resultChanges,
      newFullRangeTextLines,
      activeLine,
      pendingRange,
    };
  }

  private handleEdits(diffModel: IComputeDiffData): void {
    const { activeLine, changes, newFullRangeTextLines } = diffModel;

    const eol = this.originalModel.getEOL();
    const zone = this.decorationModel.getZone();

    const newOriginalTextLines = this.getNewOriginalTextLines();
    const diffComputation = this.defaultLinesDiffComputer.computeDiff(newOriginalTextLines, newFullRangeTextLines, {
      computeMoves: false,
      maxComputationTimeMs: 200,
      ignoreTrimWhitespace: false,
    });

    const changesArray: any = [];

    if (diffComputation.hitTimeout) {
      let newText = newFullRangeTextLines.join(eol);
      zone.isEmpty() && (newText += eol);
      const edit = {
        range: zone,
        text: newText,
        forceMoveMarkers: false,
      };
      changesArray.push(edit);
    } else {
      for (const change of diffComputation.changes) {
        let newText: string | null = newFullRangeTextLines
          .slice(change.modified.startLineNumber - 1, change.modified.endLineNumberExclusive - 1)
          .join(eol);
        let newRange;
        if (change.original.isEmpty) {
          newRange = new Range(
            zone.startLineNumber + change.original.startLineNumber - 1,
            1,
            zone.startLineNumber + change.original.startLineNumber - 1,
            1,
          );
          newText += eol;
        } else if (change.modified.isEmpty) {
          newRange = new Range(
            zone.startLineNumber + change.original.startLineNumber - 1,
            1,
            zone.startLineNumber + change.original.endLineNumberExclusive - 1,
            1,
          );
          newText = null;
        } else {
          newRange = new Range(
            zone.startLineNumber + change.original.startLineNumber - 1,
            1,
            zone.startLineNumber + change.original.endLineNumberExclusive - 2,
            this.originalModel.getLineMaxColumn(zone.startLineNumber + change.original.endLineNumberExclusive - 2),
          );
        }
        const edit = {
          range: newRange,
          text: newText,
          forceMoveMarkers: false,
        };
        changesArray.push(edit);
      }
    }

    this.originalModel.pushEditOperations(null, changesArray, () => null);

    /**
     * handler active line decoration
     */
    if (activeLine > 0) {
      this.decorationModel.touchActiveLine(activeLine);
    } else {
      this.decorationModel.clearActiveLine();
    }

    /**
     * handler add range
     */
    const allAddRanges = changes.filter((c) => c.addedRange.length > 0).map((c) => c.addedRange);
    this.decorationModel.touchAddedRange(allAddRanges);

    this.allRemoveZoneWidget.forEach((widget) => {
      widget.dispose();
    });

    /**
     * handler removed range
     */
    for (const change of changes) {
      const { removedTextLines, removedLinesOriginalRange } = change;
      if (removedTextLines.length > 0) {
        const removedText = removedTextLines.join(eol);
        const zoneWidget = new (class extends ZoneWidget {
          private root: ReactDOMClient.Root;

          _fillContainer(container: HTMLElement): void {
            this.root = ReactDOMClient.createRoot(container);
            this.root.render(<div className={styles.inline_diff_remove_zone}>{removedText}</div>);
          }
          dispose(): void {
            this.root.unmount();
            super.dispose();
          }
        })(this.monacoEditor, {
          showInHiddenAreas: true,
          showFrame: false,
          showArrow: false,
        });

        zoneWidget.create();
        zoneWidget.show(
          Range.fromPositions(
            {
              lineNumber: zone.startLineNumber + removedLinesOriginalRange.startLineNumber - 1,
              column: 1,
            },
            {
              lineNumber: zone.startLineNumber + removedLinesOriginalRange.endLineNumberExclusive - 2,
              column: Number.MAX_SAFE_INTEGER,
            },
          ),
          removedTextLines.length,
        );

        this.allRemoveZoneWidget.push(zoneWidget);
      }
    }

    // console.log('compute diff:>>>> result >>>>>>>>>>>> diffComputation changesArray', changesArray)
    // console.log('compute diff:>>>> result >>>>>>>>>>>> diffComputation allAddRanges', allAddRanges)
  }

  private allRemoveZoneWidget: ZoneWidget[] = [];

  public addLinesToDiff(newText: string): void {
    const lastLine = this.modifiedModel.getLineCount();
    const lastColumn = this.modifiedModel.getLineMaxColumn(lastLine);

    const range = new Range(lastLine, lastColumn, lastLine, lastColumn);

    const edit = {
      range,
      text: newText,
    };
    this.modifiedModel.pushEditOperations(null, [edit], () => null);

    const newTextLines = this.modifiedModel.getLinesContent();

    const diffModel = this.computeDiff(this.rawOriginalTextLines, newTextLines);
    // console.log('compute diff:>>>> result >>>>>>>>>>>> diffModel diffModel', diffModel)
    // console.log('compute diff:>>>> result >>>>>>>>>>>> diffModel.newTextLines \n', newTextLines)
    // console.log('compute diff:>>>> result >>>>>>>>>>>> diffModel.changes', diffModel.changes)
    // console.log('compute diff:>>>> result >>>>>>>>>>>> diffModel.newFullRangeTextLines \n', diffModel.newFullRangeTextLines.join('\n'));
    this.handleEdits(diffModel);
  }
}

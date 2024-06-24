import { Injectable } from '@opensumi/di';
import { Disposable, RunOnceScheduler } from '@opensumi/ide-core-browser';
import { ISingleEditOperation } from '@opensumi/ide-editor';
import { ICodeEditor, ITextModel, Range, Selection } from '@opensumi/ide-monaco';
import { StandaloneServices } from '@opensumi/ide-monaco/lib/browser/monaco-api/services';
import { LineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/lineRange';
import { linesDiffComputers } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputers';
import { DetailedLineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/rangeMapping';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';

import { LivePreviewDiffDecorationModel } from './live-preview.decoration';

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

export enum EComputerMode {
  legacy = 'legacy',
  default = 'default',
}

@Injectable({ multiple: true })
export class InlineStreamDiffHandler extends Disposable {
  private modifiedModel: ITextModel;
  private rawOriginalTextLines: string[];
  private livePreviewDiffDecorationModel: LivePreviewDiffDecorationModel;

  private schedulerHandleEdits: RunOnceScheduler;
  private currentDiffModel: IComputeDiffData;

  constructor(private readonly monacoEditor: ICodeEditor, private readonly selection: Selection) {
    super();

    this.livePreviewDiffDecorationModel = new LivePreviewDiffDecorationModel(this.monacoEditor);
    this.livePreviewDiffDecorationModel.setZone(this.selection);

    const modelService = StandaloneServices.get(IModelService);
    this.modifiedModel = modelService.createModel('', null);

    this.rawOriginalTextLines = this.getNewOriginalTextLines();

    this.schedulerHandleEdits = new RunOnceScheduler(() => {
      if (this.currentDiffModel) {
        this.handleEdits(this.currentDiffModel);
      }
    }, 16 * 12.5);

    this.addDispose(this.livePreviewDiffDecorationModel);
  }

  private get originalModel(): ITextModel {
    return this.monacoEditor.getModel()!;
  }

  private getNewOriginalTextLines(): string[] {
    const zone = this.livePreviewDiffDecorationModel.getZone();

    return Array.from({
      length: zone.endLineNumber - zone.startLineNumber + 1,
    }).map((_, i) => this.originalModel.getLineContent(zone.startLineNumber + i));
  }

  private computeDiff(
    originalTextLines: string[],
    newTextLines: string[],
    computerMode: EComputerMode = EComputerMode.default,
  ): IComputeDiffData {
    const computeResult = (
      computerMode === EComputerMode.default ? linesDiffComputers.getDefault() : linesDiffComputers.getLegacy()
    ).computeDiff(originalTextLines, newTextLines, {
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
      if (
        change.modified.endLineNumberExclusive === newTextLines.length + 1 &&
        computerMode === EComputerMode.default
      ) {
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
    const zone = this.livePreviewDiffDecorationModel.getZone();

    const newOriginalTextLines = this.getNewOriginalTextLines();
    const diffComputation = linesDiffComputers.getDefault().computeDiff(newOriginalTextLines, newFullRangeTextLines, {
      computeMoves: false,
      maxComputationTimeMs: 200,
      ignoreTrimWhitespace: false,
    });

    const realTimeChanges: ISingleEditOperation[] = [];

    if (diffComputation.hitTimeout) {
      let newText = newFullRangeTextLines.join(eol);
      zone.isEmpty() && (newText += eol);
      const edit = {
        range: zone,
        text: newText,
        forceMoveMarkers: false,
      };
      realTimeChanges.push(edit);
    } else {
      for (const change of diffComputation.changes) {
        let newText: string | null = newFullRangeTextLines
          .slice(change.modified.startLineNumber - 1, change.modified.endLineNumberExclusive - 1)
          .join(eol);
        let newRange: Range;
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
        realTimeChanges.push(edit);
      }
    }

    this.originalModel.pushEditOperations(null, realTimeChanges, () => null);

    /**
     * handler active line decoration
     */
    if (activeLine > 0) {
      this.livePreviewDiffDecorationModel.touchActiveLine(activeLine);
    } else {
      this.livePreviewDiffDecorationModel.clearActiveLine();
    }

    /**
     * handler add range
     */
    const allAddRanges = changes.filter((c) => !c.addedRange.isEmpty).map((c) => c.addedRange);
    this.livePreviewDiffDecorationModel.touchAddedRange(allAddRanges);

    this.livePreviewDiffDecorationModel.clearRemovedWidgets();

    /**
     * handler removed range
     */
    let preRemovedLen: number = 0;
    for (const change of changes) {
      const { removedTextLines, removedLinesOriginalRange, addedRange } = change;

      if (removedTextLines.length > 0) {
        const removedText = removedTextLines.join(eol);

        this.livePreviewDiffDecorationModel.showRemovedWidgetByLineNumber(
          zone.startLineNumber + removedLinesOriginalRange.startLineNumber - 2 - preRemovedLen,
          removedTextLines.length,
          removedText,
        );
      }

      preRemovedLen += removedLinesOriginalRange.length - addedRange.length;
    }
  }

  public addLinesToDiff(newText: string, computerMode: EComputerMode = EComputerMode.default): void {
    const lastLine = this.modifiedModel.getLineCount();
    const lastColumn = this.modifiedModel.getLineMaxColumn(lastLine);

    const range = new Range(lastLine, lastColumn, lastLine, lastColumn);

    const edit = {
      range,
      text: newText,
    };
    this.modifiedModel.pushEditOperations(null, [edit], () => null);

    this.recompute(computerMode);
  }

  public recompute(computerMode: EComputerMode): void {
    const newTextLines = this.modifiedModel.getLinesContent();
    const diffModel = this.computeDiff(this.rawOriginalTextLines, newTextLines, computerMode);
    this.currentDiffModel = diffModel;

    if (!this.schedulerHandleEdits.isScheduled()) {
      this.schedulerHandleEdits.schedule();
    }
  }
}

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { Disposable, Emitter, Event, RunOnceScheduler } from '@opensumi/ide-core-browser';
import { ISingleEditOperation } from '@opensumi/ide-editor';
import { ICodeEditor, ITextModel, Range, Selection } from '@opensumi/ide-monaco';
import { StandaloneServices } from '@opensumi/ide-monaco/lib/browser/monaco-api/services';
import { LineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/lineRange';
import { linesDiffComputers } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputers';
import { DetailedLineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/rangeMapping';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';
import { UndoRedoGroup } from '@opensumi/monaco-editor-core/esm/vs/platform/undoRedo/common/undoRedo';

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
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  private virtualModel: ITextModel;
  private rawOriginalTextLines: string[];
  private livePreviewDiffDecorationModel: LivePreviewDiffDecorationModel;

  private schedulerHandleEdits: RunOnceScheduler;
  private currentDiffModel: IComputeDiffData;

  private undoRedoGroup: UndoRedoGroup;

  protected readonly _onDidEditChange = new Emitter<void>();
  public readonly onDidEditChange: Event<void> = this._onDidEditChange.event;

  constructor(private readonly monacoEditor: ICodeEditor, private readonly selection: Selection) {
    super();

    this.undoRedoGroup = new UndoRedoGroup();
    this.livePreviewDiffDecorationModel = this.injector.get(LivePreviewDiffDecorationModel, [
      this.monacoEditor,
      this.selection,
    ]);

    const modelService = StandaloneServices.get(IModelService);
    this.virtualModel = modelService.createModel('', null);

    const eol = this.originalModel.getEOL();
    const startPosition = this.selection.getStartPosition();
    const endPosition = this.selection.getEndPosition();
    this.rawOriginalTextLines = this.originalModel
      .getValueInRange(Range.fromPositions(startPosition, endPosition))
      .split(eol);

    this.livePreviewDiffDecorationModel.calcTextLinesTokens(this.rawOriginalTextLines);

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

  public discard(): void {
    const eol = this.originalModel.getEOL();
    const zone = this.getZone();
    this.originalModel.pushEditOperations(
      null,
      [
        {
          range: zone.toInclusiveRange()!,
          text: this.rawOriginalTextLines.join(eol),
        },
      ],
      () => null,
    );
  }

  public getZone(): LineRange {
    return this.livePreviewDiffDecorationModel.getZone();
  }

  public renderPartialEditWidgets(range: LineRange[]): void {
    this.livePreviewDiffDecorationModel.touchPartialEditWidgets(range);
  }

  /**
   * 令当前的 inline diff 在流式渲染过程当中使用 pushEditOperations 进行编辑的操作都放在同一组 undo/redo 堆栈里
   * 一旦撤销到最顶层则关闭当前的 inline diff
   */
  public pushStackElement(): void {
    this.livePreviewDiffDecorationModel.pushUndoElement({
      undo: () => this.dispose(),
      redo: () => {
        /* noop */
      },
      group: this.undoRedoGroup,
    });
  }

  private handleEdits(diffModel: IComputeDiffData): void {
    const { activeLine, changes, newFullRangeTextLines, pendingRange } = diffModel;
    const eol = this.originalModel.getEOL();
    const zone = this.getZone();

    const validZone =
      zone.startLineNumber < zone.endLineNumberExclusive
        ? new Range(
            zone.startLineNumber,
            1,
            zone.endLineNumberExclusive - 1,
            this.originalModel.getLineMaxColumn(zone.endLineNumberExclusive - 1),
          )
        : new Range(zone.startLineNumber, 1, zone.startLineNumber, 1);

    const newOriginalTextLines = this.originalModel.getValueInRange(validZone).split(eol);
    const diffComputation = linesDiffComputers.getDefault().computeDiff(newOriginalTextLines, newFullRangeTextLines, {
      computeMoves: false,
      maxComputationTimeMs: 200,
      ignoreTrimWhitespace: false,
    });

    const realTimeChanges: ISingleEditOperation[] = [];

    if (diffComputation.hitTimeout) {
      let newText = newFullRangeTextLines.join(eol);
      validZone.isEmpty() && (newText += eol);
      const edit = {
        range: validZone,
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
            validZone.startLineNumber + change.original.startLineNumber - 1,
            1,
            validZone.startLineNumber + change.original.startLineNumber - 1,
            1,
          );
          newText += eol;
        } else if (change.modified.isEmpty) {
          newRange = new Range(
            validZone.startLineNumber + change.original.startLineNumber - 1,
            1,
            validZone.startLineNumber + change.original.endLineNumberExclusive - 1,
            1,
          );
          newText = null;
        } else {
          newRange = new Range(
            validZone.startLineNumber + change.original.startLineNumber - 1,
            1,
            validZone.startLineNumber + change.original.endLineNumberExclusive - 2,
            this.originalModel.getLineMaxColumn(validZone.startLineNumber + change.original.endLineNumberExclusive - 2),
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

    this.originalModel.pushEditOperations(null, realTimeChanges, () => null, this.undoRedoGroup);

    /**
     * 根据 newFullRangeTextLines 内容长度重新计算 zone，避免超过最大长度，进而影响未选中的代码区域
     */
    this.livePreviewDiffDecorationModel.updateZone(
      new LineRange(zone.startLineNumber, zone.startLineNumber + newFullRangeTextLines.length),
    );

    /**
     * handle active line decoration
     */
    if (activeLine > 0) {
      this.livePreviewDiffDecorationModel.touchActiveLine(activeLine);
    } else {
      this.livePreviewDiffDecorationModel.clearActiveLine();
    }

    /**
     * handle added range decoration
     */
    const allAddRanges = changes.map((c) => c.addedRange);
    this.livePreviewDiffDecorationModel.touchAddedRange(allAddRanges);

    /**
     * handle pending range decoration
     */
    if (pendingRange.length > 0) {
      this.livePreviewDiffDecorationModel.touchPendingRange(pendingRange);
    } else {
      this.livePreviewDiffDecorationModel.clearPendingLine();
    }

    /**
     * handle removed range
     */
    let preRemovedLen: number = 0;
    this.livePreviewDiffDecorationModel.clearRemovedWidgets();

    for (const change of changes) {
      const { removedTextLines, removedLinesOriginalRange, addedRange } = change;

      if (removedTextLines.length > 0) {
        this.livePreviewDiffDecorationModel.showRemovedWidgetByLineNumber(
          validZone.startLineNumber + removedLinesOriginalRange.startLineNumber - 2 - preRemovedLen,
          removedLinesOriginalRange,
          removedTextLines,
        );
      }

      preRemovedLen += removedLinesOriginalRange.length - addedRange.length;
    }

    this._onDidEditChange.fire();
  }

  public addLinesToDiff(newText: string, computerMode: EComputerMode = EComputerMode.default): void {
    this.virtualModel.setValue(newText);
    this.recompute(computerMode);
  }

  public recompute(computerMode: EComputerMode): IComputeDiffData {
    const newTextLines = this.virtualModel.getLinesContent();
    const diffModel = this.computeDiff(this.rawOriginalTextLines, newTextLines, computerMode);
    this.currentDiffModel = diffModel;

    if (!this.schedulerHandleEdits.isScheduled()) {
      this.schedulerHandleEdits.schedule();
    }

    return diffModel;
  }
}

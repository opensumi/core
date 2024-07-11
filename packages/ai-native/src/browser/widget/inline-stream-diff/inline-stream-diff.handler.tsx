import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { Disposable, Emitter, Event, RunOnceScheduler } from '@opensumi/ide-core-browser';
import { ISingleEditOperation } from '@opensumi/ide-editor';
import { ICodeEditor, ITextModel, Range, Selection } from '@opensumi/ide-monaco';
import { StandaloneServices } from '@opensumi/ide-monaco/lib/browser/monaco-api/services';
import { LineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/lineRange';
import { linesDiffComputers } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputers';
import { DetailedLineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/rangeMapping';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';
import { LineTokens } from '@opensumi/monaco-editor-core/esm/vs/editor/common/tokens/lineTokens';
import { UndoRedoGroup } from '@opensumi/monaco-editor-core/esm/vs/platform/undoRedo/common/undoRedo';

import { AcceptPartialEditWidget, LivePreviewDiffDecorationModel } from './live-preview.decoration';

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
  private rawOriginalTextLinesTokens: LineTokens[] = [];

  private livePreviewDiffDecorationModel: LivePreviewDiffDecorationModel;

  private schedulerHandleEdits: RunOnceScheduler;
  private currentDiffModel: IComputeDiffData;

  private undoRedoGroup: UndoRedoGroup;
  private partialEditWidgetHandle: (widgets: AcceptPartialEditWidget[]) => void;

  protected readonly _onDidEditChange = new Emitter<void>();
  public readonly onDidEditChange: Event<void> = this._onDidEditChange.event;

  constructor(private readonly monacoEditor: ICodeEditor, private readonly selection: Selection) {
    super();

    this.undoRedoGroup = new UndoRedoGroup();

    const modelService = StandaloneServices.get(IModelService);
    this.virtualModel = modelService.createModel('', null);

    const eol = this.originalModel.getEOL();
    const startPosition = this.selection.getStartPosition();
    const endPosition = this.selection.getEndPosition();
    this.rawOriginalTextLines = this.originalModel
      .getValueInRange(Range.fromPositions(startPosition, endPosition))
      .split(eol);

    this.rawOriginalTextLinesTokens = this.rawOriginalTextLines.map((_, index) => {
      const lineNumber = startPosition.lineNumber + index;
      this.originalModel.tokenization.forceTokenization(lineNumber);
      const lineTokens = this.originalModel.tokenization.getLineTokens(lineNumber);
      return lineTokens;
    });

    this.schedulerHandleEdits = new RunOnceScheduler(() => {
      if (this.currentDiffModel) {
        this.handleEdits(this.currentDiffModel);
      }
    }, 16 * 12.5);

    this.initializeDecorationModel();
  }

  private initializeDecorationModel(): void {
    this.livePreviewDiffDecorationModel = this.injector.get(LivePreviewDiffDecorationModel, [
      this.monacoEditor,
      this.selection,
    ]);

    this.addDispose(this.livePreviewDiffDecorationModel);

    this.addDispose(
      this.livePreviewDiffDecorationModel.onPartialEditWidgetListChange((partialWidgets) => {
        if (this.partialEditWidgetHandle) {
          this.partialEditWidgetHandle(partialWidgets);
        }
      }),
    );
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

  public registerPartialEditWidgetHandle(exec: (widgets: AcceptPartialEditWidget[]) => void) {
    this.partialEditWidgetHandle = exec;
  }

  public discard(): void {
    this.livePreviewDiffDecorationModel.discardUnProcessed();
  }

  public getZone(): LineRange {
    return this.livePreviewDiffDecorationModel.getZone();
  }

  private renderPartialEditWidgets(diffModel: IComputeDiffData): void {
    const { changes } = diffModel;
    const zone = this.getZone();
    const allAddRanges = changes.map((c) => {
      const lineNumber = zone.startLineNumber + c.addedRange.startLineNumber - 1;
      return new LineRange(lineNumber, lineNumber + 1);
    });

    this.livePreviewDiffDecorationModel.touchPartialEditWidgets(allAddRanges);
  }

  private renderAddedRangeDecoration(diffModel: IComputeDiffData): void {
    const allAddRanges = diffModel.changes.map((c) => c.addedRange);
    this.livePreviewDiffDecorationModel.touchAddedRange(allAddRanges);
  }

  private renderRemovedRangeDecoration(diffModel: IComputeDiffData): void {
    const { changes } = diffModel;
    const zone = this.getZone();

    let preRemovedLen: number = 0;
    this.livePreviewDiffDecorationModel.clearRemovedWidgets();

    for (const change of changes) {
      const { removedTextLines, removedLinesOriginalRange, addedRange } = change;

      if (removedTextLines.length > 0) {
        this.livePreviewDiffDecorationModel.showRemovedWidgetByLineNumber(
          zone.startLineNumber + removedLinesOriginalRange.startLineNumber - 2 - preRemovedLen,
          removedTextLines.map((text, index) => ({
            text,
            lineTokens: this.rawOriginalTextLinesTokens[removedLinesOriginalRange.startLineNumber - 1 + index],
          })),
        );
      }

      preRemovedLen += removedLinesOriginalRange.length - addedRange.length;
    }
  }

  /**
   * 令当前的 inline diff 在流式渲染过程当中使用 pushEditOperations 进行编辑的操作都放在同一组 undo/redo 堆栈里
   * 一旦撤销到最顶层则关闭当前的 inline diff
   */
  private pushStackElement(): void {
    this.livePreviewDiffDecorationModel.pushUndoElement({
      undo: () => this.dispose(),
      redo: () => {
        /* noop */
      },
      group: this.undoRedoGroup,
    });
  }

  private handleEdits(diffModel: IComputeDiffData): void {
    const { activeLine, newFullRangeTextLines, pendingRange } = diffModel;
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
    this.renderAddedRangeDecoration(diffModel);

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
    this.renderRemovedRangeDecoration(diffModel);

    this._onDidEditChange.fire();
  }

  private doSchedulerEdits(): void {
    if (!this.schedulerHandleEdits.isScheduled()) {
      this.schedulerHandleEdits.schedule();
    }
  }

  public recompute(computerMode: EComputerMode, newContent?: string): IComputeDiffData {
    if (newContent) {
      this.virtualModel.setValue(newContent);
    }
    const newTextLines = this.virtualModel.getLinesContent();
    this.currentDiffModel = this.computeDiff(this.rawOriginalTextLines, newTextLines, computerMode);
    return this.currentDiffModel;
  }

  public addLinesToDiff(newText: string, computerMode: EComputerMode = EComputerMode.default): void {
    this.virtualModel.setValue(newText);
    this.recompute(computerMode);
    this.doSchedulerEdits();
  }

  public readyRender(diffModel: IComputeDiffData): void {
    this.doSchedulerEdits();

    this.renderPartialEditWidgets(diffModel);
    this.pushStackElement();
    this.monacoEditor.focus();
  }
}

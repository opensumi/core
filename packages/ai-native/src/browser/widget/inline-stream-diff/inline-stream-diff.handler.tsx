import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { Disposable, Emitter, Event, FRAME_THREE, Schemes, Uri, randomString, sleep } from '@opensumi/ide-core-browser';
import { ISingleEditOperation } from '@opensumi/ide-editor';
import { ICodeEditor, ITextModel, Range, Selection } from '@opensumi/ide-monaco';
import { StandaloneServices } from '@opensumi/ide-monaco/lib/browser/monaco-api/services';
import { LineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/lineRange';
import { linesDiffComputers } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputers';
import { DetailedLineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/rangeMapping';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';
import { LineTokens } from '@opensumi/monaco-editor-core/esm/vs/editor/common/tokens/lineTokens';
import { UndoRedoGroup } from '@opensumi/monaco-editor-core/esm/vs/platform/undoRedo/common/undoRedo';

import { IDecorationSerializableState } from '../../model/enhanceDecorationsCollection';
import { IDiffPreviewerOptions, IInlineDiffPreviewerNode } from '../inline-diff/inline-diff-previewer';

import { InlineStreamDiffComputer } from './inline-stream-diff-computer';
import { IRemovedWidgetState } from './live-preview.component';
import { ILivePreviewDiffDecorationSnapshotData, LivePreviewDiffDecorationModel } from './live-preview.decoration';

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

export interface IInlineStreamDiffSnapshotData {
  rawOriginalTextLines: string[];
  rawOriginalTextLinesTokens: LineTokens[];
  undoRedoGroup: UndoRedoGroup;
  decorationSnapshotData: ILivePreviewDiffDecorationSnapshotData;
  previewerOptions: IDiffPreviewerOptions;
}

const inlineStreamDiffComputer = new InlineStreamDiffComputer();

@Injectable({ multiple: true })
export class InlineStreamDiffHandler extends Disposable implements IInlineDiffPreviewerNode {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  protected readonly _onDidEditChange = this.registerDispose(new Emitter<void>());
  public readonly onDidEditChange: Event<void> = this._onDidEditChange.event;

  public previewerOptions: IDiffPreviewerOptions;

  private originalModel: ITextModel;
  private virtualModel: ITextModel;

  // Parts that require snapshots
  private rawOriginalTextLines: string[];
  private rawOriginalTextLinesTokens: LineTokens[] = [];
  private undoRedoGroup: UndoRedoGroup;

  public livePreviewDiffDecorationModel: LivePreviewDiffDecorationModel;

  constructor(private readonly monacoEditor: ICodeEditor) {
    super();

    this.undoRedoGroup = new UndoRedoGroup();

    const modelService = StandaloneServices.get(IModelService);
    this.virtualModel = modelService.createModel(
      '',
      null,
      Uri.from({
        scheme: Schemes.inMemory,
        path: 'inline-stream-diff/' + randomString(8),
      }),
      true,
    );
    this.originalModel = this.monacoEditor.getModel()!;

    this.livePreviewDiffDecorationModel = this.injector.get(LivePreviewDiffDecorationModel, [this.monacoEditor]);
    this.addDispose(this.livePreviewDiffDecorationModel);
    this.addDispose(this.virtualModel);

    // 将 diff handler 和 decoration model 的生命周期绑定在一起
    const dispose = this.livePreviewDiffDecorationModel.onDispose(() => {
      this.dispose();
      dispose.dispose();
    });
  }

  setPreviewerOptions(options: IDiffPreviewerOptions): void {
    this.previewerOptions = options;

    this.livePreviewDiffDecorationModel.setPreviewerOptions({
      partialEditWidgetOptions: {
        hideAcceptPartialEditWidget: options.hideAcceptPartialEditWidget,
      },
    });
  }

  initialize(selection: Selection): void {
    const eol = this.originalModel.getEOL();
    const startPosition = selection.getStartPosition();
    const endPosition = selection.getEndPosition();

    this.rawOriginalTextLines = this.originalModel
      .getValueInRange(Range.fromPositions(startPosition, endPosition))
      .split(eol);

    this.rawOriginalTextLinesTokens = this.rawOriginalTextLines.map((_, index) => {
      const lineNumber = startPosition.lineNumber + index;
      this.originalModel.tokenization.forceTokenization(lineNumber);
      const lineTokens = this.originalModel.tokenization.getLineTokens(lineNumber);
      return lineTokens;
    });

    const zone = LineRange.fromRangeInclusive(
      Range.fromPositions(
        { lineNumber: selection.startLineNumber, column: 1 },
        { lineNumber: selection.endLineNumber, column: Number.MAX_SAFE_INTEGER },
      ),
    );

    this.livePreviewDiffDecorationModel.initialize(zone);
  }

  private _snapshotStore: IInlineStreamDiffSnapshotData | undefined;
  restoreSnapshot(snapshot: IInlineStreamDiffSnapshotData): void {
    this._snapshotStore = snapshot;
    const {
      rawOriginalTextLines,
      rawOriginalTextLinesTokens,
      undoRedoGroup,
      decorationSnapshotData,
      previewerOptions,
    } = snapshot;

    this.setPreviewerOptions(previewerOptions);

    this.rawOriginalTextLines = rawOriginalTextLines;
    this.rawOriginalTextLinesTokens = rawOriginalTextLinesTokens;
    this.undoRedoGroup = undoRedoGroup;

    this.livePreviewDiffDecorationModel.initialize(decorationSnapshotData.zone);
  }

  get currentSnapshotStore(): IInlineStreamDiffSnapshotData | undefined {
    return this._snapshotStore;
  }

  restoreDecorationSnapshot(decorationSnapshotData: ILivePreviewDiffDecorationSnapshotData): void {
    this.livePreviewDiffDecorationModel.restoreSnapshot(decorationSnapshotData);
  }

  createSnapshot(): IInlineStreamDiffSnapshotData {
    return {
      rawOriginalTextLines: this.rawOriginalTextLines,
      rawOriginalTextLinesTokens: this.rawOriginalTextLinesTokens,
      undoRedoGroup: this.undoRedoGroup,
      decorationSnapshotData: this.livePreviewDiffDecorationModel.createSnapshot(),
      previewerOptions: this.previewerOptions,
    };
  }

  getVirtualModelValue() {
    return this.virtualModel.getValue();
  }

  getOriginModelValue() {
    return this.rawOriginalTextLines.join('\n');
  }

  get onPartialEditWidgetListChange() {
    return this.livePreviewDiffDecorationModel.onPartialEditWidgetListChange;
  }

  private computeDiff(
    originalTextLines: string[],
    newTextLines: string[],
    computerMode: EComputerMode = EComputerMode.default,
  ): IComputeDiffData {
    const computeResult = (
      computerMode === EComputerMode.default ? inlineStreamDiffComputer : linesDiffComputers.getLegacy()
    ).computeDiff(originalTextLines, newTextLines, {
      computeMoves: false,
      maxComputationTimeMs: 200,
      ignoreTrimWhitespace: false,
      onlyCareAboutPrefixOfOriginalLines: true,
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

  private calculateAddedDecorationCollectionState(diffModel: IComputeDiffData): IDecorationSerializableState[] {
    const zone = this.getZone();

    const ranges = diffModel.changes.map((c) => {
      const r = c.addedRange;
      const startPosition = { lineNumber: zone.startLineNumber + r.startLineNumber - 1, column: 1 };
      const endPosition = {
        lineNumber: zone.startLineNumber + r.endLineNumberExclusive - 2,
        column: 1,
      };

      return {
        startPosition,
        endPosition,
        len: r.endLineNumberExclusive - r.startLineNumber,
      };
    });

    return ranges;
  }

  private renderPartialEditWidgets(diffModel: IComputeDiffData): void {
    const decorationRange = this.calculateAddedDecorationCollectionState(diffModel);
    this.livePreviewDiffDecorationModel.touchPartialEditWidgets(decorationRange.map((v) => v.startPosition.lineNumber));
  }

  private renderAddedRangeDecoration(diffModel: IComputeDiffData): void {
    const ranges = this.calculateAddedDecorationCollectionState(diffModel);
    this.livePreviewDiffDecorationModel.touchAddedRange(ranges);
  }

  private renderRemovedRangeDecoration(diffModel: IComputeDiffData): void {
    const { changes } = diffModel;
    const zone = this.getZone();

    let preRemovedLen: number = 0;

    const states = [] as IRemovedWidgetState[];

    for (const change of changes) {
      const { removedTextLines, removedLinesOriginalRange, addedRange } = change;

      if (removedTextLines.length > 0) {
        states.push({
          position: {
            column: 1,
            lineNumber: zone.startLineNumber + removedLinesOriginalRange.startLineNumber - 2 - preRemovedLen,
          },
          textLines: removedTextLines.map((text, index) => ({
            text,
            lineTokens: this.rawOriginalTextLinesTokens[removedLinesOriginalRange.startLineNumber - 1 + index],
          })),
        });
      }

      preRemovedLen += removedLinesOriginalRange.length - addedRange.length;
    }

    this.livePreviewDiffDecorationModel.touchRemovedWidget(states);
  }

  /**
   * 令当前的 inline diff 在流式渲染过程当中使用 pushEditOperations 进行编辑的操作都放在同一组 undo/redo 堆栈里
   * 一旦撤销到最顶层则关闭当前的 inline diff
   */
  private pushStackElement(): void {
    const stack = this.livePreviewDiffDecorationModel.createEditStackElement(this.undoRedoGroup);
    stack.attachModel(this.livePreviewDiffDecorationModel);
    stack.registerUndo((decorationModel) => {
      decorationModel.dispose();
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

  public recompute(computerMode: EComputerMode, newContent?: string): IComputeDiffData {
    if (newContent) {
      this.virtualModel.setValue(newContent);
    }

    const newTextLines = this.virtualModel.getLinesContent();
    return this.computeDiff(this.rawOriginalTextLines, newTextLines, computerMode);
  }

  private currentEditLine = 0;
  private finallyDiffModel: IComputeDiffData | null = null;
  private isEditing = false;
  private async rateEditController(): Promise<void> {
    if (this.isEditing === false) {
      this.isEditing = true;

      while (this.currentEditLine <= this.virtualModel.getLinesContent().length) {
        if (this.disposed) {
          return;
        }

        const virtualTextLines = this.virtualModel.getLinesContent();
        const currentText = virtualTextLines.slice(0, this.currentEditLine);
        const currentDiffModel = this.computeDiff(this.rawOriginalTextLines, currentText);
        this.handleEdits(currentDiffModel);

        this.currentEditLine += 1;

        await sleep(FRAME_THREE);
      }

      if (this.finallyDiffModel) {
        this.finallyRender(this.finallyDiffModel);
      }

      this.isEditing = false;
    }
  }

  public addLinesToDiff(newText: string, computerMode: EComputerMode = EComputerMode.default): void {
    this.recompute(computerMode, newText);
    this.rateEditController();
  }

  public pushRateFinallyDiffStack(diffModel: IComputeDiffData): void {
    this.finallyDiffModel = diffModel;

    // 可能存在 rate editr controller 处理完之后接口层流式才结束
    if (this.isEditing === false) {
      this.finallyRender(this.finallyDiffModel);
    }
  }

  public finallyRender(diffModel: IComputeDiffData): void {
    // 流式结束后才会确定所有的 added range，再渲染 partial edit widgets
    this.renderPartialEditWidgets(diffModel);
    this.handleEdits(diffModel);
    this.pushStackElement();
    this.monacoEditor.focus();
  }

  get onPartialEditEvent() {
    return this.livePreviewDiffDecorationModel.onPartialEditEvent;
  }

  acceptAll(): void {
    this.livePreviewDiffDecorationModel.acceptUnProcessed();
    this.dispose();
  }

  rejectAll(): void {
    this.livePreviewDiffDecorationModel.discardUnProcessed();
    this.dispose();
  }

  revealFirstDiff() {
    this.livePreviewDiffDecorationModel.revealFirstDiff();
  }

  getZone(): LineRange {
    return this.livePreviewDiffDecorationModel.getZone();
  }

  getTotalCodeInfo() {
    return this.livePreviewDiffDecorationModel.getTotalCodeInfo();
  }
}

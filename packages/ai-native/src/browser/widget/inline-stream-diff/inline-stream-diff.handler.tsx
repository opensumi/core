import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { Disposable, Emitter, Event, FRAME_THREE, Schemes, Uri, randomString, sleep } from '@opensumi/ide-core-browser';
import { ISingleEditOperation } from '@opensumi/ide-editor';
import { ICodeEditor, ITextModel, Range, Selection } from '@opensumi/ide-monaco';
import { StandaloneServices } from '@opensumi/ide-monaco/lib/browser/monaco-api/services';
import { ISettableObservable, observableValue, transaction } from '@opensumi/ide-monaco/lib/common/observable';
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

export interface IComputeDiffData {
  newFullRangeTextLines: string[];
  changes: IRangeChangeData[];
  activeLine: number;
  pendingRange: LineRange;
}

export enum EComputerMode {
  legacy = 'legacy',
  default = 'default',
}

const inlineStreamDiffComputer = new InlineStreamDiffComputer();

/**
 * Abstract base class for inline streaming diff handlers
 */
@Injectable({ multiple: true })
export abstract class BaseInlineStreamDiffHandler extends Disposable implements IInlineDiffPreviewerNode {
  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  protected readonly _onDidEditChange = this.registerDispose(new Emitter<void>());
  public readonly onDidEditChange: Event<void> = this._onDidEditChange.event;

  protected readonly onDiffFinishedEmitter = this.registerDispose(new Emitter<IComputeDiffData>());
  public readonly onDiffFinished: Event<IComputeDiffData> = this.onDiffFinishedEmitter.event;

  public previewerOptions: IDiffPreviewerOptions;

  protected savedModel: ITextModel;
  protected virtualModel: ITextModel;

  protected rawSavedTextLines: string[];
  protected rawOriginTextLinesTokens: LineTokens[] | undefined;
  protected undoRedoGroup: UndoRedoGroup = new UndoRedoGroup();

  protected readonly finallyDiffModel: ISettableObservable<IComputeDiffData | undefined> = observableValue(
    this,
    undefined,
  );

  public livePreviewDiffDecorationModel: LivePreviewDiffDecorationModel;

  public get uri() {
    return this.savedModel.uri;
  }

  constructor(protected readonly monacoEditor: ICodeEditor) {
    super();

    const modelService = StandaloneServices.get(IModelService);
    const savedModel = this.monacoEditor.getModel()!;
    const setModel = modelService.createModel(
      '',
      null,
      Uri.from({
        scheme: Schemes.inMemory,
        path: 'inline-stream-diff/' + randomString(8),
      }),
      true,
    );
    this.savedModel = savedModel;
    this.virtualModel = setModel;

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
      renderRemovedWidgetImmediately: options.renderRemovedWidgetImmediately,
    });
  }

  abstract initialize(selection: Selection): void;

  getVirtualModelValue() {
    return this.virtualModel.getValue();
  }

  getOriginModelValue() {
    return this.rawSavedTextLines.join('\n');
  }

  get onPartialEditWidgetListChange() {
    return this.livePreviewDiffDecorationModel.onPartialEditWidgetListChange;
  }

  protected computeDiff(
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
            lineTokens:
              this.rawOriginTextLinesTokens?.[removedLinesOriginalRange.startLineNumber - 1 + index] ||
              LineTokens.createEmpty(text, {
                encodeLanguageId: () => 0,
                decodeLanguageId: () => 'plaintext',
              }),
          })),
        });
      }

      preRemovedLen += removedLinesOriginalRange.length - addedRange.length;
    }

    this.livePreviewDiffDecorationModel.touchRemovedWidget(states, () => {
      this._onDidEditChange.fire();
    });
  }

  /**
   * Get the original model for diff operations
   */
  protected abstract getOriginalModel(): ITextModel;

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

  protected renderDiffEdits(diffModel: IComputeDiffData): void {
    const { activeLine, newFullRangeTextLines, pendingRange } = diffModel;
    const zone = this.getZone();

    const originalModel = this.getOriginalModel();
    const eol = originalModel.getEOL();

    const validZone =
      zone.startLineNumber < zone.endLineNumberExclusive
        ? new Range(
            zone.startLineNumber,
            1,
            zone.endLineNumberExclusive - 1,
            originalModel.getLineMaxColumn(zone.endLineNumberExclusive - 1),
          )
        : new Range(zone.startLineNumber, 1, zone.startLineNumber, 1);

    const newOriginalTextLines = originalModel.getValueInRange(validZone).split(eol);
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
            originalModel.getLineMaxColumn(validZone.startLineNumber + change.original.endLineNumberExclusive - 2),
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
    originalModel.pushEditOperations(null, realTimeChanges, () => null, this.undoRedoGroup);

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

  public recompute(computerMode: EComputerMode, content?: string): IComputeDiffData {
    if (content) {
      this.virtualModel.setValue(content);
    }

    const textLines = this.virtualModel.getLinesContent();
    return this.processDiffComputation(textLines, computerMode);
  }

  protected currentEditLine = 0;
  protected isEditing = false;

  protected abstract processDiffComputation(currentText: string[], computerMode?: EComputerMode): IComputeDiffData;

  public async rateRenderEditController(): Promise<void> {
    if (this.isEditing === false) {
      this.isEditing = true;

      while (this.currentEditLine <= this.virtualModel.getLinesContent().length) {
        if (this.disposed) {
          return;
        }

        const virtualTextLines = this.virtualModel.getLinesContent();
        const currentText = virtualTextLines.slice(0, this.currentEditLine);
        const currentDiffModel = this.processDiffComputation(currentText);

        if (this.savedModel.id === this.monacoEditor.getModel()?.id) {
          this.renderDiffEdits(currentDiffModel);
        }

        this.currentEditLine += 1;
        // 这个 sleep 会带来潜在的时序问题，如 finallyRender 时模型已经被 dispose
        await sleep(FRAME_THREE);
      }

      const finallyDiffModel = this.finallyDiffModel.get();
      if (finallyDiffModel) {
        this.finallyRender(finallyDiffModel);
      }

      this.isEditing = false;
    }
  }

  public addLinesToDiff(newText: string, computerMode: EComputerMode = EComputerMode.default): void {
    this.recompute(computerMode, newText);
  }

  public pushRateFinallyDiffStack(diffModel: IComputeDiffData): void {
    transaction((tx) => {
      this.finallyDiffModel.set(diffModel, tx);
      // 可能存在 rate editor controller 处理完之后接口层流式才结束
      if (this.isEditing === false) {
        this.finallyRender(diffModel);
      }
    });
  }

  public finallyRender(diffModel: IComputeDiffData): void {
    transaction((tx) => {
      this.finallyDiffModel.set(diffModel, tx);
    });

    if (this.savedModel.id !== this.monacoEditor.getModel()?.id) {
      return;
    }

    this.onDiffFinishedEmitter.fire(diffModel);

    if (this.livePreviewDiffDecorationModel.disposed) {
      return;
    }
    this.renderPartialEditWidgets(diffModel);
    this.renderDiffEdits(diffModel);
    this.pushStackElement();
    this.monacoEditor.focus();
  }

  public hide(): void {
    this.livePreviewDiffDecorationModel.hide();
  }

  public resume(): void {
    const finallyDiffModel = this.finallyDiffModel.get();
    if (!finallyDiffModel) {
      this.rateRenderEditController();
    }

    this.livePreviewDiffDecorationModel.resume();
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

/**
 * Regular inline stream diff handler (non-reverse mode)
 */
@Injectable({ multiple: true })
export class InlineStreamDiffHandler extends BaseInlineStreamDiffHandler {
  initialize(selection: Selection): void {
    const eol = this.savedModel.getEOL();
    const startPosition = selection.getStartPosition();
    const endPosition = selection.getEndPosition();

    this.rawSavedTextLines = this.savedModel
      .getValueInRange(Range.fromPositions(startPosition, endPosition))
      .split(eol);

    const zone = LineRange.fromRangeInclusive(
      Range.fromPositions(
        { lineNumber: selection.startLineNumber, column: 1 },
        { lineNumber: selection.endLineNumber, column: Number.MAX_SAFE_INTEGER },
      ),
    );

    this.livePreviewDiffDecorationModel.initialize(zone);
    this.rawOriginTextLinesTokens = this.rawSavedTextLines.map((_, index) => {
      const lineNumber = startPosition.lineNumber + index;
      this.savedModel.tokenization.forceTokenization(lineNumber);
      const lineTokens = this.savedModel.tokenization.getLineTokens(lineNumber);
      return lineTokens;
    });
  }

  protected processDiffComputation(currentText: string[], computerMode?: EComputerMode): IComputeDiffData {
    return this.computeDiff(this.rawSavedTextLines, currentText, computerMode);
  }

  protected getOriginalModel(): ITextModel {
    return this.savedModel;
  }
}

/**
 * Reverse inline stream diff handler
 * In reverse mode, the roles of savedModel and virtualModel are swapped
 */
@Injectable({ multiple: true })
export class ReverseInlineStreamDiffHandler extends BaseInlineStreamDiffHandler {
  recompute(computerMode: EComputerMode, content?: string): IComputeDiffData {
    const result = super.recompute(computerMode, content);
    this.rawOriginTextLinesTokens = this.virtualModel.getLinesContent().map((_, index) => {
      const lineNumber = index + 1;
      this.virtualModel.tokenization.forceTokenization(lineNumber);
      const lineTokens = this.virtualModel.tokenization.getLineTokens(lineNumber);
      return lineTokens;
    });
    return result;
  }

  initialize(): void {
    const eol = this.savedModel.getEOL();

    // reverse 模式不支持 range
    this.rawSavedTextLines = this.savedModel.getValue().split(eol);

    // TODO: reverse 模式暂不支持 range
    const zone = LineRange.fromRangeInclusive(
      Range.fromPositions(
        { lineNumber: 1, column: 1 },
        { lineNumber: this.virtualModel.getLineCount(), column: Number.MAX_SAFE_INTEGER },
      ),
    );
    this.livePreviewDiffDecorationModel.initialize(zone);
  }

  protected getOriginalModel(): ITextModel {
    return this.virtualModel;
  }

  protected processDiffComputation(currentText: string[], computerMode?: EComputerMode): IComputeDiffData {
    return this.computeDiff(currentText, this.rawSavedTextLines, computerMode);
  }
}

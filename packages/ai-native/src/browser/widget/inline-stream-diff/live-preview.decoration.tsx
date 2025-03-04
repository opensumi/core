import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { StackingLevel } from '@opensumi/ide-core-browser';
import {
  ActionSourceEnum,
  ActionTypeEnum,
  Disposable,
  Emitter,
  Event,
  IAIReporter,
  localize,
  runWhenIdle,
} from '@opensumi/ide-core-common';
import { ISingleEditOperation } from '@opensumi/ide-editor';
import { ICodeEditor, IEditorDecorationsCollection, ITextModel, Position, Range } from '@opensumi/ide-monaco';
import { StandaloneServices } from '@opensumi/ide-monaco/lib/browser/monaco-api/services';
import { IMessageService } from '@opensumi/ide-overlay';
import { EditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/editOperation';
import { LineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/lineRange';
import { ModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';
import { IUndoRedoService, UndoRedoGroup } from '@opensumi/monaco-editor-core/esm/vs/platform/undoRedo/common/undoRedo';

import { AINativeContextKey } from '../../ai-core.contextkeys';
import { IDecorationSerializableState, IEnhanceModelDeltaDecoration } from '../../model/enhanceDecorationsCollection';
import { InlineDiffService } from '../inline-diff';

import styles from './inline-stream-diff.module.less';
import { InlineStreamDiffService } from './inline-stream-diff.service';
import { LivePreviewUndoRedoStackElement } from './live-preview-stack';
import {
  AcceptPartialEditWidget,
  ActiveLineDecoration,
  AddedRangeDecoration,
  AddedRangeDecorationsCollection,
  EPartialEdit,
  IPartialEditEvent,
  IPartialEditWidgetOptions,
  IRemovedWidgetState,
  IRemovedZoneWidgetOptions,
  ITextLinesTokens,
  PendingRangeDecoration,
  RemovedZoneWidget,
} from './live-preview.component';

export interface ITotalCodeInfo {
  totalAddedLinesCount: number;
  totalDeletedLinesCount: number;
  totalChangedLinesCount: number;
  unresolvedAddedLinesCount: number;
  unresolvedDeletedLinesCount: number;
  unresolvedChangedLinesCount: number;
}

export interface IModelOptions {
  partialEditWidgetOptions?: IPartialEditWidgetOptions;
  renderRemovedWidgetImmediately?: boolean;
}

@Injectable({ multiple: true })
export class LivePreviewDiffDecorationModel extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  @Autowired(InlineStreamDiffService)
  private readonly inlineStreamDiffService: InlineStreamDiffService;

  @Autowired(InlineDiffService)
  private readonly inlineDiffService: InlineDiffService;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  private activeLineDec: IEditorDecorationsCollection;
  private pendingRangeDec: IEditorDecorationsCollection;
  private aiNativeContextKey: AINativeContextKey;
  private undoRedoService: IUndoRedoService;

  protected readonly _onPartialEditWidgetListChange = this.registerDispose(new Emitter<AcceptPartialEditWidget[]>());
  public readonly onPartialEditWidgetListChange: Event<AcceptPartialEditWidget[]> =
    this._onPartialEditWidgetListChange.event;

  protected options: IModelOptions = {
    partialEditWidgetOptions: {},
  };

  protected model: ITextModel;

  private addedRangeDec: AddedRangeDecorationsCollection;
  private partialEditWidgetList: AcceptPartialEditWidget[] = [];
  private removedZoneWidgets: RemovedZoneWidget[] = [];
  private zone: LineRange;

  public get partialEditWidgetCount() {
    return this.partialEditWidgetList.length;
  }

  constructor(private readonly monacoEditor: ICodeEditor) {
    super();
    this.model = this.monacoEditor.getModel()!;

    this.undoRedoService = StandaloneServices.get(IUndoRedoService);
    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [this.monacoEditor.contextKeyService]);

    this.activeLineDec = this.monacoEditor.createDecorationsCollection();
    this.pendingRangeDec = this.monacoEditor.createDecorationsCollection();

    this.addDispose(
      this.inlineStreamDiffService.onAcceptDiscardPartialEdit((isAccept) => {
        const currentPosition = this.monacoEditor.getPosition()!;

        /**
         * 找出离当前光标最近的操作点
         */
        const widget = this.partialEditWidgetList
          .filter((p) => !p.isHidden)
          .sort((pa, pb) => {
            const paLineNumber = pa.getPosition()?.position?.lineNumber || 1;
            const pbLineNumber = pb.getPosition()?.position?.lineNumber || 1;

            const distanceToPa = Math.abs(currentPosition.lineNumber - paLineNumber);
            const distanceToPb = Math.abs(currentPosition.lineNumber - pbLineNumber);

            return distanceToPa - distanceToPb;
          });

        if (widget.length > 0) {
          this.handlePartialEditAction(isAccept ? EPartialEdit.accept : EPartialEdit.discard, widget[0]);
        }
      }),
    );

    this.addedRangeDec = new AddedRangeDecorationsCollection(this.monacoEditor);
    this.addDispose(
      this.addedRangeDec.onDidDecorationsChange((newAddedRangeDec) => {
        const inlineDiffPartialEditsIsVisible = this.aiNativeContextKey.inlineDiffPartialEditsIsVisible.get();
        if (inlineDiffPartialEditsIsVisible) {
          this.partialEditWidgetList.forEach((widget) => {
            const addedWidget = newAddedRangeDec.find((a) => widget.getAddedRangeId() === a.id);
            if (addedWidget) {
              const range = addedWidget.getRange();
              /**
               * 重新定位 added decoration 与 partial edit widget 的位置
               */
              widget.setOptions({ position: { lineNumber: range.startLineNumber, column: 1 } });
              widget.layoutContentWidget();
            }
          });
        }
      }),
    );

    this.addDispose(Disposable.create(() => this.clear()));
  }

  clear() {
    this.clearPendingLine();
    this.clearActiveLine();
    this.clearAddedLine();
    this.clearRemovedWidgets();
    this.clearPartialEditWidgetList();
  }

  hide() {
    this.addedRangeDec.getDecorations().forEach((dec) => dec.hide());
    this.partialEditWidgetList.forEach((widget) => widget.hide());
    this.removedZoneWidgets.forEach((widget) => widget.hide());

    this.activeLineDec.clear();
    this.pendingRangeDec.clear();
  }

  /**
   * 仅恢复渲染 status 为 pending 的部件
   */
  resume() {
    this.addedRangeDec.getDecorations().forEach((dec) => dec.status === 'pending' && dec.resume());
    this.partialEditWidgetList.forEach((widget) => widget.status === 'pending' && widget.resume());
    this.removedZoneWidgets.forEach((widget) => widget.status === 'pending' && widget.resume());
  }

  initialize(zone: LineRange): void {
    this.updateZone(zone);
  }

  getRemovedWidgets(): RemovedZoneWidget[] {
    return this.removedZoneWidgets;
  }

  public showRemovedWidgetByLineNumber(
    lineNumber: number,
    texts: ITextLinesTokens[],
    options: IRemovedZoneWidgetOptions,
  ): void {
    const position = new Position(lineNumber, 1);
    const heightInLines = texts.length;

    const widget = new RemovedZoneWidget(this.monacoEditor, texts, {
      ...options,
      showInHiddenAreas: true,
      showFrame: false,
      showArrow: false,
    });

    widget.create();
    this.removedZoneWidgets.push(widget);

    if (options.isHidden) {
      widget.hide();
    } else {
      widget.show(position, heightInLines);
    }
  }

  public updateZone(newZone: LineRange): void {
    this.zone = newZone;
  }

  public getZone(): LineRange {
    return this.zone;
  }

  public touchActiveLine(lineNumber: number) {
    const zone = this.getZone();

    this.activeLineDec.set([
      {
        range: Range.fromPositions({
          lineNumber: zone.startLineNumber + lineNumber - 1,
          column: 0,
        }),
        options: ModelDecorationOptions.register({
          description: ActiveLineDecoration,
          isWholeLine: true,
          className: styles.inline_diff_current,
          zIndex: StackingLevel.Workbench,
        }),
      },
    ]);
  }

  private doDiscardPartialWidget(
    partialWidget: AcceptPartialEditWidget,
    addedDec?: IEnhanceModelDeltaDecoration,
    removedWidget?: RemovedZoneWidget,
  ): ISingleEditOperation | null {
    let operation: ISingleEditOperation | null = null;

    let addedLinesCount = 0;
    let deletedLinesCount = 0;

    if (addedDec && addedDec.length > 0) {
      const addedRange = addedDec.getRange();
      operation = EditOperation.delete(
        Range.lift({
          startLineNumber: addedRange.startLineNumber,
          startColumn: addedRange.startColumn,
          endLineNumber: addedRange.endLineNumber + 1,
          endColumn: 1,
        }),
      );
      addedLinesCount = addedDec.length;

      addedDec.hide();
    }

    if (removedWidget) {
      const position = removedWidget.getLastPosition();
      const eol = this.model.getEOL();

      const lines = removedWidget.getRemovedTextLines();
      deletedLinesCount = lines.length;
      const removedText = lines.join(eol) + eol;

      if (operation) {
        operation = EditOperation.replace(Range.lift(operation.range), removedText);
      } else {
        operation = EditOperation.insert(position.delta(1)!, removedText);
      }

      removedWidget.hide();
    }

    partialWidget.discard(addedLinesCount, deletedLinesCount);
    return operation;
  }

  private handlePartialEditAction(
    type: EPartialEdit,
    widget: AcceptPartialEditWidget,
    isPushStack: boolean = true,
    isReport: boolean = false,
  ) {
    const position = widget.getPosition()!.position!;
    const relationId = this.aiReporter.getRelationId();
    const model = this.model;
    /**
     * added widget 通常是在 removed widget 的下面一行的位置
     */
    const removedWidget = this.removedZoneWidgets.find(
      (w) => w.getLastPosition().lineNumber === Math.max(1, position.lineNumber - 1),
    );

    const addedDec = this.addedRangeDec.getDecorationByLineNumber(position.lineNumber);
    const addedLinesCount = addedDec?.length || 0;
    const deletedLinesCount = removedWidget?.height || 0;

    // 将 partial widget 的所有操作和代码变更放在单独的 undo/redo 堆栈组里面
    const group = new UndoRedoGroup();
    // 并将此刻的 group 信息记录到每个 widget/decoration 中
    widget.setGroup(group);
    removedWidget?.setGroup(group);
    addedDec?.setGroup(group);

    /**
     * 在 undo/redo 的 stack 中，原本的 widget 和 decoration 信息已经是旧的数据了，所以不能直接拿旧的数据进行 resume 或 accept
     * 需要根据 group 信息和当前实例的 LivePreviewDiffDecorationModel 对象重新找到 widget 和 decoration
     */
    const findPartialWidgetByGroup = (model: LivePreviewDiffDecorationModel) =>
      model.partialEditWidgetList.find((widget) => widget.group === group);
    const findRemovedWidgetByGroup = (model: LivePreviewDiffDecorationModel) =>
      model.removedZoneWidgets.find((widget) => widget.group === group);
    const findAddedRangeDecByGroup = (model: LivePreviewDiffDecorationModel) =>
      model.addedRangeDec.getDecorationByGroup(group);

    let modifyContent: string;
    const removeContent = removedWidget?.getRemovedTextLines().join('\n') || '';
    const range = addedDec?.getRange();
    if (range) {
      modifyContent = model.getValueInRange({
        ...range,
        endColumn: model.getLineMaxColumn(range.endLineNumber),
      });
    }
    const discard = (decorationModel: LivePreviewDiffDecorationModel) => {
      // 只有点击行丢弃时才会上报
      if (isReport) {
        this.aiReporter.end(relationId, {
          message: 'discard',
          success: true,
          isDrop: true,
          code: modifyContent,
          originCode: removeContent,
          actionSource: ActionSourceEnum.InlineChat,
          actionType: ActionTypeEnum.LineDiscard,
        });
      }
      const removedWidget = findRemovedWidgetByGroup(decorationModel);
      removedWidget?.discard();

      const addedDec = findAddedRangeDecByGroup(decorationModel);
      addedDec?.discard();

      const partialEditWidget = findPartialWidgetByGroup(decorationModel);
      const operation = this.doDiscardPartialWidget(partialEditWidget!, addedDec, removedWidget);

      return operation;
    };

    const accept = (decorationModel: LivePreviewDiffDecorationModel) => {
      // 只有点击行采纳时才会上报
      if (isReport) {
        this.aiReporter.end(relationId, {
          message: 'accept',
          success: true,
          isReceive: true,
          code: modifyContent,
          originCode: removeContent,
          actionSource: ActionSourceEnum.InlineChat,
          actionType: ActionTypeEnum.lineAccept,
        });
      }
      const partialEditWidget = findPartialWidgetByGroup(decorationModel);
      partialEditWidget?.accept(addedLinesCount, deletedLinesCount);

      const removedWidget = findRemovedWidgetByGroup(decorationModel);
      removedWidget?.accept();

      const addedDec = findAddedRangeDecByGroup(decorationModel);
      addedDec?.accept();
    };

    const resume = (decorationModel: LivePreviewDiffDecorationModel) => {
      const partialEditWidget = findPartialWidgetByGroup(decorationModel);
      partialEditWidget?.resume();

      const removedWidget = findRemovedWidgetByGroup(decorationModel);
      removedWidget?.resume();

      const addedDec = findAddedRangeDecByGroup(decorationModel);
      addedDec?.resume();
    };

    switch (type) {
      case EPartialEdit.accept:
        accept(this);
        if (isPushStack) {
          const stack = this.createEditStackElement(group);
          stack.attachModel(this);
          stack.registerUndo((model: LivePreviewDiffDecorationModel) => {
            resume(model);
          });
          stack.registerRedo((model: LivePreviewDiffDecorationModel) => {
            accept(model);
          });
        }
        break;

      case EPartialEdit.discard:
        {
          const op = discard(this);
          if (op) {
            if (isPushStack) {
              const stack = this.createEditStackElement(group);
              stack.attachModel(this);
              stack.registerUndo((model: LivePreviewDiffDecorationModel) => {
                resume(model);
              });
              stack.registerRedo((model: LivePreviewDiffDecorationModel) => {
                discard(model);
              });
            }
            model.pushStackElement();
            model.pushEditOperations(null, [op], () => null, group);
            model.pushStackElement();
          }
        }
        break;
      default:
        break;
    }

    const event: IPartialEditEvent = {
      uri: this.model.uri,
      totalPartialEditCount: this.partialEditWidgetList.length,
      resolvedPartialEditCount: this.partialEditWidgetList.filter((w) => w.isHidden).length,
      acceptPartialEditCount: this.partialEditWidgetList.filter((w) => w.isAccepted).length,
      currentPartialEdit: {
        addedLinesCount,
        deletedLinesCount,
        type,
      },
      ...this.getTotalCodeInfo(),
    };

    this.monacoEditor.focus();

    this.inlineDiffService.firePartialEdit(event);
    this.firePartialEditWidgetList();
  }

  private firePartialEditWidgetList(): void {
    this._onPartialEditWidgetListChange.fire(this.partialEditWidgetList);
    const visibleLists = this.partialEditWidgetList.filter((widget) => !widget.isHidden);
    this.aiNativeContextKey.inlineDiffPartialEditsIsVisible.set(visibleLists.length !== 0);
  }

  public createEditStackElement(group: UndoRedoGroup): LivePreviewUndoRedoStackElement {
    const newElement = new LivePreviewUndoRedoStackElement(this.model);
    this.undoRedoService.pushElement(newElement, group);
    return newElement;
  }

  static computeCodeInfo(
    partialEditWidgetList: AcceptPartialEditWidget[],
    addedDecList: IEnhanceModelDeltaDecoration[],
    removedWidgetList: RemovedZoneWidget[],
  ): ITotalCodeInfo {
    // 代码除了新增和删除行，还需要统计变更行
    // 1. 新增 N 行 => N
    // 2. 删除 N 行 => N
    // 3. 新增 M 行，删除 N 行 => max(M, N)
    // 综上所述，变更行数 = sum(list.map(item => max(新增行数, 删除行数)))
    const resolvedStatus = calculate(partialEditWidgetList);
    const unresolvedStatus = { added: 0, deleted: 0, changed: 0 };
    partialEditWidgetList.forEach((v, idx) => {
      if (v.status === 'pending') {
        const addedDec = addedDecList[idx];
        const removedWidget = removedWidgetList[idx];
        const addedLinesCount = addedDec?.length || 0;
        const deletedLinesCount = removedWidget?.height || 0;
        unresolvedStatus.added += addedLinesCount;
        unresolvedStatus.deleted += deletedLinesCount;
        unresolvedStatus.changed += Math.max(addedLinesCount, deletedLinesCount);
      }
    });

    return {
      totalAddedLinesCount: resolvedStatus.added,
      totalDeletedLinesCount: resolvedStatus.deleted,
      totalChangedLinesCount: resolvedStatus.changed,
      unresolvedAddedLinesCount: unresolvedStatus.added,
      unresolvedDeletedLinesCount: unresolvedStatus.deleted,
      unresolvedChangedLinesCount: unresolvedStatus.changed,
    };

    function calculate(list: AcceptPartialEditWidget[]) {
      const result = { added: 0, deleted: 0, changed: 0 };
      list.forEach((widget) => {
        const addedLinesCount = widget.addedLinesCount;
        const deletedLinesCount = widget.deletedLinesCount;
        result.added += addedLinesCount;
        result.deleted += deletedLinesCount;
        result.changed += Math.max(addedLinesCount, deletedLinesCount);
      });
      return result;
    }
  }

  /**
   * 获取当前编辑器的代码采纳状态
   * 1. 已经采纳的代码信息
   * 2. 还未处理的代码信息
   */
  getTotalCodeInfo(): ITotalCodeInfo {
    const partialEditWidgetList = this.partialEditWidgetList;
    const addedDecList = this.addedRangeDec.getDecorations();
    const removedWidgetList = this.removedZoneWidgets;

    return LivePreviewDiffDecorationModel.computeCodeInfo(partialEditWidgetList, addedDecList, removedWidgetList);
  }

  /**
   * 记录 partial edit widget 与 added range 的映射关系(主要用于位置计算)
   */
  private recordPartialEditWidgetWithAddedDec(): void {
    this.partialEditWidgetList.forEach((widget) => {
      const lineNumber = widget.getPosition()?.position?.lineNumber;
      if (lineNumber) {
        const addedWidget = this.addedRangeDec.getDecorationByLineNumber(lineNumber);
        if (addedWidget) {
          widget.recordAddedRangeId(addedWidget.id);
        }
      }
    });
  }

  public acceptUnProcessed(): void {
    const showingWidgets = this.partialEditWidgetList.filter((widget) => !widget.isHidden);
    showingWidgets.forEach((widget) => {
      this.handlePartialEditAction(EPartialEdit.accept, widget, false);
    });
  }

  public discardUnProcessed(): void {
    const showingWidgets = this.partialEditWidgetList.filter((widget) => !widget.isHidden);
    showingWidgets.forEach((widget) => {
      this.handlePartialEditAction(EPartialEdit.discard, widget, false);
    });
  }

  private createPartialEditWidget(lineNumber: number): AcceptPartialEditWidget {
    const acceptPartialEditWidget = this.injector.get(AcceptPartialEditWidget, [
      this.monacoEditor,
      this.options.partialEditWidgetOptions,
    ]);
    acceptPartialEditWidget.show({ position: { lineNumber, column: 1 } });

    const disposable = acceptPartialEditWidget.onDispose(() => {
      const id = acceptPartialEditWidget.getId();
      this.partialEditWidgetList = this.partialEditWidgetList.filter((p) => p.getId() !== id);

      disposable.dispose();
    });

    acceptPartialEditWidget.addDispose([
      acceptPartialEditWidget.onAccept(() => {
        this.handlePartialEditAction(EPartialEdit.accept, acceptPartialEditWidget, true, true);
      }),
      acceptPartialEditWidget.onDiscard(() => {
        this.handlePartialEditAction(EPartialEdit.discard, acceptPartialEditWidget, true, true);
      }),
    ]);

    return acceptPartialEditWidget;
  }

  public touchPartialEditWidgets(lineNumbers: number[]) {
    this.clearPartialEditWidgetList();
    this.partialEditWidgetList = lineNumbers.map((lineNumber) => this.createPartialEditWidget(lineNumber));
    this.firePartialEditWidgetList();
  }

  public touchAddedRange(ranges: IDecorationSerializableState[]) {
    this.addedRangeDec.set(
      ranges.map((r) => {
        const startPosition = r.startPosition;
        const endPosition = r.endPosition;
        const length = r.len;

        let range = Range.fromPositions(startPosition, endPosition);
        let className = styles.inline_diff_added_range + ' ';

        if (length === 0) {
          range = Range.fromPositions(startPosition);
          className += styles.hide;
        }

        return {
          length,
          range,
          isHidden: length === 0,
          options: ModelDecorationOptions.register({
            description: AddedRangeDecoration,
            isWholeLine: true,
            className,
          }),
        };
      }),
    );

    this.recordPartialEditWidgetWithAddedDec();
  }

  public touchRemovedWidget(states: IRemovedWidgetState[], cb?: () => void) {
    const run = () => {
      this.clearRemovedWidgets();
      states.forEach(({ textLines, position }) => {
        this.showRemovedWidgetByLineNumber(position.lineNumber, textLines, {});
      });
      cb?.();
    };

    if (this.options.renderRemovedWidgetImmediately) {
      run();
    } else {
      this.addDispose(runWhenIdle(run));
    }
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

  public clearPartialEditWidgetList() {
    this.partialEditWidgetList.forEach((widget) => {
      widget.dispose();
    });
    this.partialEditWidgetList = [];
    this.aiNativeContextKey.inlineDiffPartialEditsIsVisible.set(false);
  }

  public clearRemovedWidgets() {
    this.removedZoneWidgets.forEach((widget) => {
      widget.dispose();
    });
    this.removedZoneWidgets = [];
  }

  revealFirstDiff(): void {
    const first = this.removedZoneWidgets[0];
    if (first) {
      const pos = first.getLastPosition();
      if (pos) {
        this.monacoEditor.revealLineInCenterIfOutsideViewport(pos.lineNumber);
      }
    }
  }

  currentChangeIndex: number = 0;

  revealSiblingChange(direction: 'up' | 'down') {
    this.currentChangeIndex = this.currentChangeIndex + (direction === 'up' ? -1 : 1);
    if (this.currentChangeIndex >= 0 && this.currentChangeIndex < this.partialEditWidgetList.length) {
      const siblingChange = this.partialEditWidgetList[this.currentChangeIndex];
      const pos = siblingChange.getPosition();
      if (pos?.position) {
        this.monacoEditor.revealLineInCenter(pos.position!.lineNumber);
        return this.currentChangeIndex;
      }
    } else {
      this.messageService.info(
        direction === 'up'
          ? localize('aiNative.inlineDiff.noMoreChangesUp')
          : localize('aiNative.inlineDiff.noMoreChangesDown'),
      );
    }
  }

  setPreviewerOptions(options: IModelOptions) {
    this.options = options;
  }
}

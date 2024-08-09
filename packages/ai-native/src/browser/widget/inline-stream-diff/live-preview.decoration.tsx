import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { StackingLevel } from '@opensumi/ide-core-browser';
import { Disposable, Emitter, Event } from '@opensumi/ide-core-common';
import { ISingleEditOperation } from '@opensumi/ide-editor';
import { ICodeEditor, IEditorDecorationsCollection, ITextModel, Position, Range } from '@opensumi/ide-monaco';
import { StandaloneServices } from '@opensumi/ide-monaco/lib/browser/monaco-api/services';
import { EditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/editOperation';
import { LineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/lineRange';
import { ModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';
import {
  IUndoRedoService,
  ResourceEditStackSnapshot,
  UndoRedoGroup,
} from '@opensumi/monaco-editor-core/esm/vs/platform/undoRedo/common/undoRedo';

import { AINativeContextKey } from '../../contextkey/ai-native.contextkey.service';
import {
  EnhanceDecorationsCollection,
  IDecorationSerializableState,
  IEnhanceModelDeltaDecoration,
} from '../../model/enhanceDecorationsCollection';

import styles from './inline-stream-diff.module.less';
import { InlineStreamDiffService } from './inline-stream-diff.service';
import { LivePreviewUndoRedoStackElement } from './live-preview-stack';
import {
  AcceptPartialEditWidget,
  ActiveLineDecoration,
  AddedRangeDecoration,
  EPartialEdit,
  IPartialEditEvent,
  IRemovedWidgetState,
  IRemovedZoneWidgetOptions,
  ITextLinesTokens,
  PendingRangeDecoration,
  RemovedZoneWidget,
} from './live-preview.component';

export interface ILivePreviewDiffDecorationSnapshotData {
  addedDecList: IEnhanceModelDeltaDecoration[];
  partialEditWidgetList: AcceptPartialEditWidget[];
  removedWidgetList: RemovedZoneWidget[];
  editStackSnapshot: ResourceEditStackSnapshot;
  zone: LineRange;
}

@Injectable({ multiple: true })
export class LivePreviewDiffDecorationModel extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(InlineStreamDiffService)
  private readonly inlineStreamDiffService: InlineStreamDiffService;

  private readonly _onPartialEditEvent = this.registerDispose(new Emitter<IPartialEditEvent>());
  public readonly onPartialEditEvent: Event<IPartialEditEvent> = this._onPartialEditEvent.event;

  private activeLineDec: IEditorDecorationsCollection;
  private pendingRangeDec: IEditorDecorationsCollection;
  private aiNativeContextKey: AINativeContextKey;
  private undoRedoService: IUndoRedoService;

  protected readonly _onPartialEditWidgetListChange = this.registerDispose(new Emitter<AcceptPartialEditWidget[]>());
  public readonly onPartialEditWidgetListChange: Event<AcceptPartialEditWidget[]> =
    this._onPartialEditWidgetListChange.event;

  protected model: ITextModel;

  // Parts that require snapshots
  private addedRangeDec: EnhanceDecorationsCollection;
  private partialEditWidgetList: AcceptPartialEditWidget[] = [];
  private removedZoneWidgets: Array<RemovedZoneWidget> = [];
  private zone: LineRange;

  constructor(private readonly monacoEditor: ICodeEditor) {
    super();
    this.model = this.monacoEditor.getModel()!;

    this.undoRedoService = StandaloneServices.get(IUndoRedoService);

    this.activeLineDec = this.monacoEditor.createDecorationsCollection();
    this.pendingRangeDec = this.monacoEditor.createDecorationsCollection();

    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [this.monacoEditor.contextKeyService]);

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

    this.addedRangeDec = new EnhanceDecorationsCollection(this.monacoEditor);
    this.addDispose(
      this.addedRangeDec.onDidDecorationsChange((newAddedRangeDec) => {
        const inlineDiffPartialEditsIsVisible = this.aiNativeContextKey.inlineDiffPartialEditsIsVisible.get();
        if (inlineDiffPartialEditsIsVisible) {
          this.partialEditWidgetList.forEach((widget) => {
            const addedWidget = newAddedRangeDec.find((a) => widget.getDecorationId() === a.id);
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

    this.addDispose(
      Disposable.create(() => {
        this.clear();
      }),
    );
  }

  clear() {
    this.clearPendingLine();
    this.clearActiveLine();
    this.clearAddedLine();
    this.clearRemovedWidgets();
    this.clearPartialEditWidgetList();
  }

  initialize(zone: LineRange): void {
    this.updateZone(zone);
  }

  restoreSnapshot(snapshot: ILivePreviewDiffDecorationSnapshotData): void {
    const {
      addedDecList,
      removedWidgetList,
      zone,
      editStackSnapshot,
      partialEditWidgetList: snapshotPartialEditWidgetList,
    } = snapshot;

    // restore zone
    this.updateZone(zone);

    // restore added
    this.addedRangeDec.set(addedDecList);

    // restore removed
    this.clearRemovedWidgets();
    removedWidgetList.forEach((widget) => {
      const position = widget.getLastPosition();
      if (position) {
        this.showRemovedWidgetByLineNumber(position.lineNumber, widget.textLines, {
          isHidden: widget.isHidden,
          recordPosition: widget.getLastPosition(),
          undoRedoGroup: widget.group,
        });
      }
    });

    // restore partial edit widget
    this.clearPartialEditWidgetList();
    snapshotPartialEditWidgetList.forEach((snapshotWidget) => {
      const lineNumber = snapshotWidget.getPosition()?.position?.lineNumber;
      if (lineNumber) {
        const newPartialEditWidget = this.createPartialEditWidget(lineNumber);

        if (snapshotWidget.status === 'accept') {
          newPartialEditWidget.accept(snapshotWidget.addedLinesCount, snapshotWidget.deletedLinesCount);
        } else if (snapshotWidget.status === 'discard') {
          newPartialEditWidget.discard(snapshotWidget.addedLinesCount, snapshotWidget.deletedLinesCount);
        }

        newPartialEditWidget.setGroup(snapshotWidget.group);
        this.partialEditWidgetList.push(newPartialEditWidget);
      }
    });
    this.firePartialEditWidgetList();
    this.recordPartialEditWidgetWithAddedDec();

    // restore undo/redo stack
    const uri = this.model.uri;
    this.undoRedoService.restoreSnapshot(editStackSnapshot);
    const elements = this.undoRedoService.getElements(uri);
    elements.future.concat(elements.past).forEach((node) => {
      if (node instanceof LivePreviewUndoRedoStackElement) {
        // 在每次 restore 的时候需要将当前的类重新指向到 undo/redo 的 stack 中
        node.attachModel(this);
      }
    });
  }

  createSnapshot(): ILivePreviewDiffDecorationSnapshotData {
    return {
      addedDecList: this.addedRangeDec.getDecorations(),
      partialEditWidgetList: this.partialEditWidgetList,
      removedWidgetList: this.removedZoneWidgets,
      editStackSnapshot: this.undoRedoService.createSnapshot(this.model.uri),
      zone: this.zone,
    };
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
          zIndex: StackingLevel.WorkbenchEditor,
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

  private handlePartialEditAction(type: EPartialEdit, widget: AcceptPartialEditWidget, isPushStack: boolean = true) {
    const position = widget.getPosition()!.position!;
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

    const discard = (decorationModel: LivePreviewDiffDecorationModel) => {
      const removedWidget = findRemovedWidgetByGroup(decorationModel);
      removedWidget?.hide();

      const addedDec = findAddedRangeDecByGroup(decorationModel);
      addedDec?.hide();

      const partialEditWidget = findPartialWidgetByGroup(decorationModel);
      const operation = this.doDiscardPartialWidget(partialEditWidget!, addedDec, removedWidget);

      return operation;
    };

    const accpet = (decorationModel: LivePreviewDiffDecorationModel) => {
      const partialEditWidget = findPartialWidgetByGroup(decorationModel);
      partialEditWidget?.accept(addedLinesCount, deletedLinesCount);

      const removedWidget = findRemovedWidgetByGroup(decorationModel);
      removedWidget?.hide();

      const addedDec = findAddedRangeDecByGroup(decorationModel);
      addedDec?.hide();
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
        accpet(this);
        if (isPushStack) {
          const stack = this.createEditStackElement(group);
          stack.attachModel(this);
          stack.registerUndo((model: LivePreviewDiffDecorationModel) => {
            resume(model);
          });
          stack.registerRedo((model: LivePreviewDiffDecorationModel) => {
            accpet(model);
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
      currentPartialEdit: {
        addedLinesCount,
        deletedLinesCount,
        type,
      },
      ...this.getTotalCodeCount(),
    };

    this.monacoEditor.focus();

    this._onPartialEditEvent.fire(event);
    this.firePartialEditWidgetList();
  }

  private firePartialEditWidgetList(): void {
    this._onPartialEditWidgetListChange.fire(this.partialEditWidgetList);
    const visiableLists = this.partialEditWidgetList.filter((widget) => !widget.isHidden);
    this.aiNativeContextKey.inlineDiffPartialEditsIsVisible.set(visiableLists.length !== 0);
  }

  public createEditStackElement(group: UndoRedoGroup): LivePreviewUndoRedoStackElement {
    const newElement = new LivePreviewUndoRedoStackElement(this.model);
    this.undoRedoService.pushElement(newElement, group);
    return newElement;
  }

  protected getTotalCodeCount(): {
    totalAddedLinesCount: number;
    totalDeletedLinesCount: number;
  } {
    const list = this.partialEditWidgetList.filter((w) => w.isAccepted);
    return {
      totalAddedLinesCount: list.reduce((prev, current) => prev + current.addedLinesCount, 0),
      totalDeletedLinesCount: list.reduce((prev, current) => prev + current.deletedLinesCount, 0),
    };
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
          widget.recordDecorationId(addedWidget.id);
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
    const acceptPartialEditWidget = this.injector.get(AcceptPartialEditWidget, [this.monacoEditor]);
    acceptPartialEditWidget.show({ position: { lineNumber, column: 1 } });

    const dispoable = acceptPartialEditWidget.onDispose(() => {
      const id = acceptPartialEditWidget.getId();
      this.partialEditWidgetList = this.partialEditWidgetList.filter((p) => p.getId() !== id);

      dispoable.dispose();
    });

    acceptPartialEditWidget.addDispose([
      acceptPartialEditWidget.onAccept(() => {
        this.handlePartialEditAction(EPartialEdit.accept, acceptPartialEditWidget);
      }),
      acceptPartialEditWidget.onDiscard(() => {
        this.handlePartialEditAction(EPartialEdit.discard, acceptPartialEditWidget);
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

  public touchRemovedWidget(states: IRemovedWidgetState[]) {
    this.clearRemovedWidgets();

    states.forEach(({ textLines, position }) => {
      this.showRemovedWidgetByLineNumber(position.lineNumber, textLines, {});
    });
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
}

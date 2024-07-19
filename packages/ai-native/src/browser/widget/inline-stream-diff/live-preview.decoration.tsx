import cls from 'classnames';
import React, { useEffect } from 'react';
import ReactDOMClient from 'react-dom/client';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { KeybindingRegistry, StackingLevel } from '@opensumi/ide-core-browser';
import { AI_INLINE_DIFF_PARTIAL_EDIT } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { Disposable, Emitter, Event, IPosition, IRange, isUndefined, uuid } from '@opensumi/ide-core-common';
import { ISingleEditOperation } from '@opensumi/ide-editor';
import {
  ICodeEditor,
  IContentWidgetPosition,
  IEditorDecorationsCollection,
  ITextModel,
  Position,
  Range,
  Selection,
  TrackedRangeStickiness,
} from '@opensumi/ide-monaco';
import {
  ReactInlineContentWidget,
  ShowAIContentOptions,
} from '@opensumi/ide-monaco/lib/browser/ai-native/BaseInlineContentWidget';
import { URI } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { StandaloneServices } from '@opensumi/ide-monaco/lib/browser/monaco-api/services';
import { ContentWidgetPositionPreference } from '@opensumi/ide-monaco/lib/browser/monaco-exports/editor';
import { EditorOption } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { EditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/editOperation';
import { LineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/lineRange';
import { ModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';
import { LineTokens } from '@opensumi/monaco-editor-core/esm/vs/editor/common/tokens/lineTokens';
import { IOptions, ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';
import {
  IResourceUndoRedoElement,
  IUndoRedoService,
  UndoRedoElementType,
  UndoRedoGroup,
} from '@opensumi/monaco-editor-core/esm/vs/platform/undoRedo/common/undoRedo';

import { AINativeContextKey } from '../../contextkey/ai-native.contextkey.service';
import {
  EnhanceDecorationsCollection,
  IDecorationSerializableState,
  IEnhanceModelDeltaDecoration,
} from '../../model/enhanceDecorationsCollection';
import { renderLines } from '../ghost-text-widget/index';

import styles from './inline-stream-diff.module.less';
import { InlineStreamDiffService } from './inline-stream-diff.service';

const ZoneDescription = 'zone-description';
const ActiveLineDecoration = 'activeLine-decoration';
const AddedRangeDecoration = 'added-range-decoration';
const PendingRangeDecoration = 'pending-range-decoration';

interface IPartialEditWidgetComponent {
  acceptSequence: string;
  discardSequence: string;
}

export enum EPartialEdit {
  accept = 'accept',
  discard = 'discard',
}

export interface IPartialEditEvent {
  uri: URI;
  /**
   * 总 diff 数
   */
  totalPartialEditCount: number;
  /**
   * 已处理的个数
   */
  resolvedPartialEditCount: number;
  /**
   * 已添加行数
   */
  totalAddedLinesCount: number;
  /**
   * 已删除行数
   */
  totalDeletedLinesCount: number;
  currentPartialEdit: {
    type: EPartialEdit;
    addedLinesCount: number;
    deletedLinesCount: number;
  };
}

export interface ITextLinesTokens {
  text: string;
  lineTokens: LineTokens;
}

type IWidgetStatus = 'accept' | 'discard' | 'pending';

export interface IWidgetSerializedState {
  addedLinesCount: number;
  deletedLinesCount: number;
  status: IWidgetStatus;
  lineNumber: number;
}

export interface SerializableState {
  addedState: IDecorationSerializableState[];
  removedTextLines: IRemovedWidgetSerializedState[];
  widgets: IWidgetSerializedState[];
  selection: Selection;
}

@Injectable({ multiple: true })
export class AcceptPartialEditWidget extends ReactInlineContentWidget {
  static ID = 'AcceptPartialEditWidgetID';

  @Autowired(KeybindingRegistry)
  private readonly keybindingRegistry: KeybindingRegistry;

  private _id: string;
  private _decorationId: string;

  private readonly _onAccept = this.registerDispose(new Emitter<void>());
  public readonly onAccept: Event<void> = this._onAccept.event;

  private readonly _onDiscard = this.registerDispose(new Emitter<void>());
  public readonly onDiscard: Event<void> = this._onDiscard.event;

  positionPreference = [ContentWidgetPositionPreference.EXACT];

  public addedLinesCount: number = 0;
  public deletedLinesCount: number = 0;
  public status: IWidgetStatus = 'pending';

  private getSequenceKeyStrings(): IPartialEditWidgetComponent | undefined {
    let keybindings = this.keybindingRegistry.getKeybindingsForCommand(AI_INLINE_DIFF_PARTIAL_EDIT.id);
    keybindings = keybindings.sort((a, b) => b.args - a.args);

    if (!keybindings || (keybindings.length !== 2 && keybindings.some((k) => isUndefined(k.resolved)))) {
      return;
    }

    return {
      acceptSequence: this.keybindingRegistry.acceleratorForSequence(keybindings[0].resolved!, '')[0],
      discardSequence: this.keybindingRegistry.acceleratorForSequence(keybindings[1].resolved!, '')[0],
    };
  }

  public renderView(): React.ReactNode {
    const keyStrings = this.getSequenceKeyStrings();
    if (!keyStrings) {
      return;
    }

    return (
      <div className={styles.inline_diff_accept_partial_widget_container}>
        <div className={styles.content}>
          <span className={cls(styles.accept_btn, styles.btn)} onClick={() => this._onAccept.fire()}>
            {keyStrings.acceptSequence}
          </span>
          <span className={cls(styles.discard_btn, styles.btn)} onClick={() => this._onDiscard.fire()}>
            {keyStrings.discardSequence}
          </span>
        </div>
      </div>
    );
  }

  public id(): string {
    if (!this._id) {
      this._id = `${AcceptPartialEditWidget.ID}_${uuid(4)}`;
    }
    return this._id;
  }

  public getClassName(): string {
    return styles.accept_partial_edit_widget_id;
  }

  public recordDecorationId(id: string): void {
    this._decorationId = id;
  }

  public getDecorationId(): string {
    return this._decorationId;
  }

  public resume(): void {
    this.status = 'pending';
    this.addedLinesCount = 0;
    this.deletedLinesCount = 0;

    super.resume();
  }

  public accept(addedLinesCount: number, deletedLinesCount: number): void {
    this.status = 'accept';
    this.addedLinesCount = addedLinesCount;
    this.deletedLinesCount = deletedLinesCount;
    super.hide();
  }

  get isAccepted(): boolean {
    return this.status === 'accept';
  }

  public discard(addedLinesCount: number, deletedLinesCount: number): void {
    this.status = 'discard';
    this.addedLinesCount = addedLinesCount;
    this.deletedLinesCount = deletedLinesCount;
    super.hide();
  }

  get isRejected(): boolean {
    return this.status === 'discard';
  }

  public serializeState(): IWidgetSerializedState {
    return {
      addedLinesCount: this.addedLinesCount,
      deletedLinesCount: this.deletedLinesCount,
      status: this.status,
      lineNumber: this.getPosition()!.position!.lineNumber,
    };
  }

  public restoreSerializedState(state: IWidgetSerializedState) {
    if (state.status === 'accept') {
      this.accept(state.addedLinesCount, state.deletedLinesCount);
    } else if (state.status === 'discard') {
      this.discard(state.addedLinesCount, state.deletedLinesCount);
    } else {
      this.resume();
    }
  }
}

export interface IRemovedWidgetSerializedState {
  textLines: ITextLinesTokens[];
  position: IPosition;
}

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
  private recordPositionData: { position: IPosition; heightInLines: number };

  private _hidden: boolean = false;
  get isHidden(): boolean {
    return this._hidden;
  }

  constructor(editor: ICodeEditor, private readonly textLines: ITextLinesTokens[], options: IOptions) {
    super(editor, options);
  }

  _fillContainer(container: HTMLElement): void {
    container.classList.add(styles.inline_diff_remove_zone_widget_container);
    this.root = ReactDOMClient.createRoot(container);
  }

  getRemovedTextLines(): string[] {
    return this.textLines.map((v) => v.text);
  }

  get height() {
    return this.textLines.length;
  }

  getLastPosition(): IPosition {
    return this.recordPositionData.position;
  }

  serializeState(): IRemovedWidgetSerializedState {
    return {
      textLines: this.textLines,
      position: this.getLastPosition(),
    };
  }

  hide(): void {
    if (this._viewZone && this.position) {
      this.recordPositionData = {
        position: this.position,
        heightInLines: this._viewZone?.heightInLines,
      };
    }
    this._hidden = true;
    super.hide();
  }

  resume(): void {
    if (this.recordPositionData) {
      this.show(this.recordPositionData.position, this.recordPositionData.heightInLines);
    }
  }

  override show(pos: IPosition, heightInLines: number): void {
    this.recordPositionData = { position: pos, heightInLines };
    this._hidden = false;
    super.show(pos, heightInLines);
  }

  override revealRange(): void {}

  override create(): void {
    super.create();
    const dom = document.createElement('div');
    renderLines(
      dom,
      this.editor.getOption(EditorOption.tabIndex),
      this.textLines.map(({ text: content, lineTokens }) => ({
        content,
        decorations: [],
        lineTokens,
      })),
      this.editor.getOptions(),
    );

    const layoutInfo = this.editor.getOption(EditorOption.layoutInfo);
    const marginWidth = layoutInfo.contentLeft;
    this.root.render(<RemovedWidgetComponent dom={dom} marginWidth={marginWidth} />);
  }

  dispose(): void {
    this.root.unmount();
    super.dispose();
  }
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

  private addedRangeDec: EnhanceDecorationsCollection;
  private partialEditWidgetList: AcceptPartialEditWidget[] = [];
  private removedZoneWidgets: Array<RemovedZoneWidget> = [];

  private undoRedoService: IUndoRedoService;

  private zone: LineRange;
  private aiNativeContextKey: AINativeContextKey;

  protected readonly _onPartialEditWidgetListChange = this.registerDispose(new Emitter<AcceptPartialEditWidget[]>());
  public readonly onPartialEditWidgetListChange: Event<AcceptPartialEditWidget[]> =
    this._onPartialEditWidgetListChange.event;

  protected model: ITextModel;

  constructor(private readonly monacoEditor: ICodeEditor, private selection: Selection) {
    super();
    this.model = this.monacoEditor.getModel()!;

    this.activeLineDec = this.monacoEditor.createDecorationsCollection();
    this.pendingRangeDec = this.monacoEditor.createDecorationsCollection();

    this.addedRangeDec = new EnhanceDecorationsCollection(this.monacoEditor);
    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [this.monacoEditor.contextKeyService]);

    this.undoRedoService = StandaloneServices.get(IUndoRedoService);

    this.updateSelection(selection);

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

  public updateSelection(selection: Selection) {
    this.selection = selection;
    this.updateZone(
      LineRange.fromRangeInclusive(
        Range.fromPositions(
          { lineNumber: this.selection.startLineNumber, column: 1 },
          { lineNumber: this.selection.endLineNumber, column: Number.MAX_SAFE_INTEGER },
        ),
      ),
    );
  }

  public showRemovedWidgetByLineNumber(lineNumber: number, texts: ITextLinesTokens[]): void {
    const position = new Position(lineNumber, 1);
    const heightInLines = texts.length;

    const widget = new RemovedZoneWidget(this.monacoEditor, texts, {
      showInHiddenAreas: true,
      showFrame: false,
      showArrow: false,
    });

    widget.create();
    widget.show(position, heightInLines);

    this.removedZoneWidgets.push(widget);
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
      const position = removedWidget.position!;
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
    const removedWidget = this.removedZoneWidgets.find((w) => w.position?.lineNumber === position.lineNumber - 1);
    const addedDec = this.addedRangeDec.getDecorationByLineNumber(position.lineNumber);

    const addedLinesCount = addedDec?.length || 0;
    const deletedLinesCount = removedWidget?.height || 0;

    const accpet = () => {
      widget.accept(addedLinesCount, deletedLinesCount);
      addedDec?.hide();
      removedWidget?.hide();
    };

    const discard = () => {
      const operation = this.doDiscardPartialWidget(widget, addedDec, removedWidget);

      addedDec?.hide();
      removedWidget?.hide();

      return operation;
    };

    const resume = () => {
      widget.resume();
      addedDec?.resume();
      removedWidget?.resume();
    };

    /**
     * 将 partial widget 的所有操作和代码变更放在单独的 undo/redo 堆栈组里面
     */
    const group = new UndoRedoGroup();

    switch (type) {
      case EPartialEdit.accept:
        accpet();
        if (isPushStack) {
          this.pushUndoElement({
            undo: () => resume(),
            redo: () => accpet(),
            group,
          });
        }
        break;

      case EPartialEdit.discard:
        {
          const op = discard();
          if (op) {
            if (isPushStack) {
              this.pushUndoElement({
                undo: () => resume(),
                redo: () => discard(),
                group,
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
    this._onPartialEditWidgetListChange.fire(this.partialEditWidgetList);
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

  public pushUndoElement(data: { undo: () => void; redo: () => void; group?: UndoRedoGroup }): void {
    const resource = this.model.uri;
    const group = data.group ?? new UndoRedoGroup();

    this.undoRedoService.pushElement(
      {
        type: UndoRedoElementType.Resource,
        resource,
        label: 'Live.Preview.UndoRedo',
        undo: () => {
          if (!this.disposed) {
            data.undo();
          }
        },
        redo: () => {
          if (!this.disposed) {
            data.redo();
          }
        },
      } as IResourceUndoRedoElement,
      group,
    );
  }

  public touchPartialEditWidgets(startLineNumbers: number[]) {
    this.clearPartialEditWidgetList();

    startLineNumbers.forEach((lineNumber) => {
      const dispoable = new Disposable();
      const acceptPartialEditWidget = this.injector.get(AcceptPartialEditWidget, [this.monacoEditor]);
      acceptPartialEditWidget.show({ position: { lineNumber, column: 1 } });

      dispoable.addDispose(
        acceptPartialEditWidget.onDispose(() => {
          const id = acceptPartialEditWidget.getId();
          this.partialEditWidgetList = this.partialEditWidgetList.filter((p) => p.getId() !== id);

          dispoable.dispose();
        }),
      );

      acceptPartialEditWidget.addDispose([
        acceptPartialEditWidget.onAccept(() => {
          this.handlePartialEditAction(EPartialEdit.accept, acceptPartialEditWidget);
        }),
        acceptPartialEditWidget.onDiscard(() => {
          this.handlePartialEditAction(EPartialEdit.discard, acceptPartialEditWidget);
        }),
      ]);

      this.partialEditWidgetList.push(acceptPartialEditWidget);
    });

    this._onPartialEditWidgetListChange.fire(this.partialEditWidgetList);

    this.aiNativeContextKey.inlineDiffPartialEditsIsVisible.set(true);
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
          options: ModelDecorationOptions.register({
            description: AddedRangeDecoration,
            isWholeLine: true,
            className,
            // stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          }),
        };
      }),
    );

    this.recordPartialEditWidgetWithAddedDec();
  }

  public touchRemovedWidget(states: IRemovedWidgetSerializedState[]) {
    this.clearRemovedWidgets();

    states.forEach(({ textLines, position }) => {
      this.showRemovedWidgetByLineNumber(position.lineNumber, textLines);
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

  serializeState(): SerializableState {
    const addedState = this.addedRangeDec.serializeState();
    const removedTextLines = this.removedZoneWidgets.filter((v) => !v.isHidden).map((w) => w.serializeState());
    const widgets = this.partialEditWidgetList.map((w) => w.serializeState());

    const state = {
      addedState,
      removedTextLines,
      widgets,
      selection: this.selection,
    };
    return state;
  }

  restoreSerializedState(state: SerializableState): void {
    this.clear();

    this.touchAddedRange(state.addedState);
    const widgetLineNumber = state.widgets.map((w) => w.lineNumber);
    this.touchPartialEditWidgets(widgetLineNumber);
    widgetLineNumber.forEach((range, index) => {
      const widget = this.partialEditWidgetList[index];
      if (widget) {
        widget.restoreSerializedState(state.widgets[index]);
      }
    });
    this.touchRemovedWidget(state.removedTextLines);
  }

  revealFirstDiff(): void {
    const first = this.removedZoneWidgets[0];
    if (first) {
      const pos = first.getLastPosition();
      this.monacoEditor.revealLineInCenterIfOutsideViewport(pos.lineNumber);
    }
  }
}

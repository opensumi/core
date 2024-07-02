import cls from 'classnames';
import React, { useEffect } from 'react';
import ReactDOMClient from 'react-dom/client';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { KeybindingRegistry, StackingLevel } from '@opensumi/ide-core-browser';
import { AI_INLINE_DIFF_PARTIAL_EDIT } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { Disposable, Emitter, Event, isUndefined, uuid } from '@opensumi/ide-core-common';
import { ISingleEditOperation } from '@opensumi/ide-editor';
import {
  ICodeEditor,
  IEditorDecorationsCollection,
  IPosition,
  IRange,
  Position,
  Range,
  Selection,
} from '@opensumi/ide-monaco';
import { ReactInlineContentWidget } from '@opensumi/ide-monaco/lib/browser/ai-native/BaseInlineContentWidget';
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
import { EnhanceDecorationsCollection, IEnhanceModelDeltaDecoration } from '../../model/enhanceDecorationsCollection';
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

enum EPartialEdit {
  accept = 'accept',
  discard = 'discard',
}

@Injectable({ multiple: true })
class AcceptPartialEditWidget extends ReactInlineContentWidget {
  @Autowired(KeybindingRegistry)
  private readonly keybindingRegistry: KeybindingRegistry;

  private _id: string;
  private _decorationId: string;

  private readonly _onAccept = new Emitter<void>();
  public readonly onAccept: Event<void> = this._onAccept.event;

  private readonly _onDiscard = new Emitter<void>();
  public readonly onDiscard: Event<void> = this._onDiscard.event;

  positionPreference = [ContentWidgetPositionPreference.EXACT];

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
      this._id = `AcceptPartialEditWidgetID_${uuid(4)}`;
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
  private recordPositionData: { rangeOrPos: IRange | IPosition; heightInLines: number };

  constructor(editor: ICodeEditor, private readonly removedTextLines: string[], options: IOptions) {
    super(editor, options);
  }

  _fillContainer(container: HTMLElement): void {
    container.classList.add(styles.inline_diff_remove_zone_widget_container);
    this.root = ReactDOMClient.createRoot(container);
  }

  renderDom(dom: HTMLElement, options: { marginWidth: number }): void {
    this.root.render(<RemovedWidgetComponent dom={dom} marginWidth={options.marginWidth} />);
  }

  getRemovedTextLines(): string[] {
    return this.removedTextLines;
  }

  show(rangeOrPos: IRange | IPosition, heightInLines: number): void {
    this.recordPositionData = { rangeOrPos, heightInLines };
    super.show(rangeOrPos, heightInLines);
  }

  resume(): void {
    if (this.recordPositionData) {
      this.show(this.recordPositionData.rangeOrPos, this.recordPositionData.heightInLines);
    }
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

@Injectable({ multiple: true })
export class LivePreviewDiffDecorationModel extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(InlineStreamDiffService)
  private readonly inlineStreamDiffService: InlineStreamDiffService;

  private zoneDec: IEditorDecorationsCollection;

  private activeLineDec: IEditorDecorationsCollection;
  private pendingRangeDec: IEditorDecorationsCollection;

  private addedRangeDec: EnhanceDecorationsCollection;
  private partialEditWidgetList: AcceptPartialEditWidget[] = [];
  private removedZoneWidgets: Array<RemovedZoneWidget> = [];
  private rawOriginalTextLinesTokens: ITextLinesTokens[] = [];

  private undoRedoService: IUndoRedoService;

  private zone: LineRange;
  private aiNativeContextKey: AINativeContextKey;

  constructor(private readonly monacoEditor: ICodeEditor, private readonly selection: Selection) {
    super();

    this.zoneDec = this.monacoEditor.createDecorationsCollection();
    this.activeLineDec = this.monacoEditor.createDecorationsCollection();
    this.pendingRangeDec = this.monacoEditor.createDecorationsCollection();

    this.addedRangeDec = new EnhanceDecorationsCollection(this.monacoEditor);
    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [this.monacoEditor.contextKeyService]);

    this.undoRedoService = StandaloneServices.get(IUndoRedoService);

    this.updateZone(
      LineRange.fromRangeInclusive(
        Range.fromPositions(
          { lineNumber: this.selection.startLineNumber, column: 1 },
          { lineNumber: this.selection.endLineNumber, column: Number.MAX_SAFE_INTEGER },
        ),
      ),
    );

    this.addDispose(
      this.addedRangeDec.onDidDecorationsChange((newAddedRangeDec) => {
        const inlineDiffPartialEditsIsVisible = this.aiNativeContextKey.inlineDiffPartialEditsIsVisible.get();
        if (inlineDiffPartialEditsIsVisible) {
          this.partialEditWidgetList.forEach((widget) => {
            const addedWidget = newAddedRangeDec.find((a) => widget.getDecorationId() === a.id);
            if (addedWidget) {
              const range = addedWidget.getActualRange();
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
        const firstWidget = this.partialEditWidgetList.filter((p) => !p.isHidden)[0];
        if (firstWidget) {
          this.handlePartialEditAction(isAccept ? EPartialEdit.accept : EPartialEdit.discard, firstWidget);
        }
      }),
    );

    this.addDispose(
      Disposable.create(() => {
        this.zoneDec.clear();

        this.clearPendingLine();
        this.clearActiveLine();
        this.clearAddedLine();
        this.clearRemovedWidgets();
        this.clearPartialEditWidgetList();
      }),
    );
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

    const widget = new RemovedZoneWidget(this.monacoEditor, texts, {
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

  private pushUndoElement(data: { undo: () => void; redo: () => void; group?: UndoRedoGroup }): void {
    const resource = this.monacoEditor.getModel()!.uri;
    const group = data.group ?? new UndoRedoGroup();

    this.undoRedoService.pushElement(
      {
        type: UndoRedoElementType.Resource,
        resource,
        label: 'handlePartialEditAction',
        code: 'handlePartialEditAction_1',
        undo: data.undo,
        redo: data.redo,
      } as IResourceUndoRedoElement,
      group,
    );
  }

  private doDiscard(
    partialWidget: AcceptPartialEditWidget,
    addedDec?: IEnhanceModelDeltaDecoration,
    removedWidget?: RemovedZoneWidget,
  ): ISingleEditOperation | null {
    const model = this.monacoEditor.getModel()!;
    partialWidget.hide();

    let operation: ISingleEditOperation | null = null;

    if (addedDec) {
      if (addedDec.length > 0) {
        const addedRange = addedDec.getActualRange();
        const opRange = Range.lift({
          startLineNumber: addedRange.startLineNumber,
          startColumn: addedRange.startColumn,
          endLineNumber: addedRange.endLineNumber + 1,
          endColumn: 1,
        });
        operation = EditOperation.delete(opRange);
      }

      addedDec.hide();
    }

    if (removedWidget) {
      const position = removedWidget.position!;
      const eol = model.getEOL();

      const removedText = removedWidget.getRemovedTextLines().join(eol) + eol;

      if (operation) {
        operation = EditOperation.replace(Range.lift(operation.range), removedText);
      } else {
        operation = EditOperation.insert(position.delta(1)!, removedText);
      }

      removedWidget.hide();
    }

    return operation;
  }

  private handlePartialEditAction(type: EPartialEdit, widget: AcceptPartialEditWidget) {
    const position = widget.getPosition()!.position!;
    const model = this.monacoEditor.getModel()!;
    /**
     * added widget 通常是在 removed widget 的下面一行的位置
     */
    const findRemovedWidget = this.removedZoneWidgets.find((w) => w.position?.lineNumber === position.lineNumber - 1);
    const findAddedDec = this.addedRangeDec.getDecorationByLineNumber(position.lineNumber);

    const hide = () => {
      widget.hide();
      findAddedDec?.hide();
      findRemovedWidget?.hide();
    };

    const resume = () => {
      widget.resume();
      findAddedDec?.resume();
      findRemovedWidget?.resume();
    };

    /**
     * 将 partial widget 的所有操作和代码变更放在单独的 undo/redo 堆栈组里面
     */
    const group = new UndoRedoGroup();

    switch (type) {
      case EPartialEdit.accept:
        hide();
        this.pushUndoElement({
          undo: () => resume(),
          redo: () => hide(),
          group,
        });
        break;

      case EPartialEdit.discard:
        {
          const operation = this.doDiscard(widget, findAddedDec, findRemovedWidget);
          if (operation) {
            this.pushUndoElement({
              undo: () => resume(),
              redo: () => hide(),
              group,
            });
            model.pushEditOperations(null, [operation], () => null, group);
          }
        }
        break;

      default:
        break;
    }
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

  public touchPartialEditWidgets(ranges: LineRange[]) {
    this.clearPartialEditWidgetList();

    ranges.forEach((range) => {
      const lineNumber = range.startLineNumber;

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

    this.aiNativeContextKey.inlineDiffPartialEditsIsVisible.set(true);
  }

  public touchAddedRange(ranges: LineRange[]) {
    const zone = this.getZone();

    this.addedRangeDec.set(
      ranges.map((r) => {
        const startPosition = { lineNumber: zone.startLineNumber + r.startLineNumber - 1, column: 1 };
        const endPosition = {
          lineNumber: zone.startLineNumber + r.endLineNumberExclusive - 2,
          column: Number.MAX_SAFE_INTEGER,
        };
        const length = r.length;

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
          }),
        };
      }),
    );

    this.recordPartialEditWidgetWithAddedDec();
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
}

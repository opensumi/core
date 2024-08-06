import cls from 'classnames';
import React, { useCallback, useEffect } from 'react';
import ReactDOMClient from 'react-dom/client';

import { Autowired, Injectable } from '@opensumi/di';
import { KeybindingRegistry, useDisposable } from '@opensumi/ide-core-browser';
import { AI_INLINE_DIFF_PARTIAL_EDIT } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { Emitter, Event, IPosition, isUndefined, uuid } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { ReactInlineContentWidget } from '@opensumi/ide-monaco/lib/browser/ai-native/BaseInlineContentWidget';
import { URI } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { ContentWidgetPositionPreference } from '@opensumi/ide-monaco/lib/browser/monaco-exports/editor';
import { EditorOption } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { IScrollEvent } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';
import { LineTokens } from '@opensumi/monaco-editor-core/esm/vs/editor/common/tokens/lineTokens';
import { IOptions, ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';
import { UndoRedoGroup } from '@opensumi/monaco-editor-core/esm/vs/platform/undoRedo/common/undoRedo';

import { renderLines } from '../ghost-text-widget/index';

import styles from './inline-stream-diff.module.less';
import { IWidgetStatus } from './live-preview-stack';

export const ActiveLineDecoration = 'activeLine-decoration';
export const AddedRangeDecoration = 'added-range-decoration';
export const PendingRangeDecoration = 'pending-range-decoration';

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

const PartialEditComponent = (props: {
  keyStrings: IPartialEditWidgetComponent;
  onAccept: () => void;
  onDiscard: () => void;
  editor: ICodeEditor;
}) => {
  const { keyStrings, onAccept, onDiscard, editor } = props;
  const [scrollLeft, setScrollLeft] = React.useState(0);

  const handleAccept = useCallback(() => {
    onAccept?.();
  }, [onAccept]);

  const handleDiscard = useCallback(() => {
    onDiscard?.();
  }, [onDiscard]);

  useDisposable(
    () =>
      editor.onDidScrollChange((event: IScrollEvent) => {
        const { scrollLeftChanged, scrollLeft } = event;
        if (scrollLeftChanged) {
          setScrollLeft(scrollLeft);
        }
      }),
    [editor],
  );

  return (
    <div
      className={cls('kt-inline-diff-accept-partial-widget-container', styles.inline_diff_accept_partial_widget_container)}
      style={{ marginLeft: scrollLeft }}
    >
      <div className={styles.content}>
        <span className={cls(styles.accept_btn, styles.btn)} onClick={handleAccept}>
          {keyStrings.acceptSequence}
        </span>
        <span className={cls(styles.discard_btn, styles.btn)} onClick={handleDiscard}>
          {keyStrings.discardSequence}
        </span>
      </div>
    </div>
  );
};

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

  private _group: UndoRedoGroup;
  public get group(): UndoRedoGroup {
    return this._group;
  }

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
      <PartialEditComponent
        keyStrings={keyStrings}
        onAccept={() => this._onAccept.fire()}
        onDiscard={() => this._onDiscard.fire()}
        editor={this.editor}
      />
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

  public setGroup(group): void {
    this._group = group;
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
}

const RemovedWidgetComponent = ({ dom, editor }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = React.useState(0);
  const [marginWidth, setMarginWidth] = React.useState(0);

  useEffect(() => {
    if (dom && ref && ref.current) {
      ref.current.appendChild(dom);
    }
  }, [dom, ref]);

  useDisposable(
    () =>
      editor.onDidScrollChange((event: IScrollEvent) => {
        const { scrollLeftChanged, scrollLeft } = event;
        if (scrollLeftChanged) {
          setScrollLeft(scrollLeft);
        }
      }),
    [editor],
  );

  useDisposable(() => {
    setMarginWidth(editor.getOption(EditorOption.layoutInfo).contentLeft);
    return editor.onDidChangeConfiguration((event) => {
      if (event.hasChanged(EditorOption.layoutInfo)) {
        setMarginWidth(editor.getOption(EditorOption.layoutInfo).contentLeft);
      }
    });
  }, [editor]);

  return (
    <div className={styles.inline_diff_remove_zone_fixed_box} style={{ marginLeft: marginWidth + 'px' }}>
      <div className={styles.inline_diff_remove_zone} ref={ref} style={{ marginLeft: -scrollLeft + 'px' }}></div>
    </div>
  );
};

export class RemovedZoneWidget extends ZoneWidget {
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

  override revealRange(): void { }

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

    this.root.render(<RemovedWidgetComponent dom={dom} editor={this.editor} />);
  }

  dispose(): void {
    this.root.unmount();
    super.dispose();
  }
}

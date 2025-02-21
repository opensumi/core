import cls from 'classnames';
import React, { useCallback, useEffect } from 'react';
import ReactDOMClient from 'react-dom/client';

import { Autowired, Injectable } from '@opensumi/di';
import { KeybindingRegistry, useDisposable } from '@opensumi/ide-core-browser';
import { AI_INLINE_DIFF_PARTIAL_EDIT } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { Emitter, Event, IPosition, isDefined, isUndefined, localize, uuid } from '@opensumi/ide-core-common';
import {
  ICodeEditor,
  IEditorDecorationsCollection,
  IModelDecorationsChangedEvent,
  Position,
} from '@opensumi/ide-monaco';
import { ReactInlineContentWidget } from '@opensumi/ide-monaco/lib/browser/ai-native/BaseInlineContentWidget';
import { URI } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { ContentWidgetPositionPreference } from '@opensumi/ide-monaco/lib/browser/monaco-exports/editor';
import { EditorOption } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { IScrollEvent } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';
import { LineTokens } from '@opensumi/monaco-editor-core/esm/vs/editor/common/tokens/lineTokens';
import { IOptions, ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';
import { UndoRedoGroup } from '@opensumi/monaco-editor-core/esm/vs/platform/undoRedo/common/undoRedo';

import {
  DeltaDecorations,
  EnhanceDecorationsCollection,
  IDeltaDecorationsOptions,
} from '../../model/enhanceDecorationsCollection';
import { renderLines } from '../ghost-text-widget/index';

import styles from './inline-stream-diff.module.less';

export const ActiveLineDecoration = 'activeLine-decoration';
export const AddedRangeDecoration = 'added-range-decoration';
export const PendingRangeDecoration = 'pending-range-decoration';

interface IPartialEditWidgetComponent {
  acceptSequence: string;
  discardSequence: string;
}

type IWidgetStatus = 'accept' | 'discard' | 'pending';

export interface IRemovedWidgetState {
  textLines: ITextLinesTokens[];
  position: IPosition;
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
   * 已采纳的个数
   */
  acceptPartialEditCount: number;
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
      className={cls(
        'kt-inline-diff-accept-partial-widget-container',
        styles.inline_diff_accept_partial_widget_container,
      )}
      style={{ marginLeft: scrollLeft }}
    >
      <div className={styles.content}>
        <span className={cls(styles.accept_btn, styles.btn)} onClick={handleAccept}>
          {localize('aiNative.inline.diff.accept')}
          <span>{keyStrings.acceptSequence}</span>
        </span>
        <span className={cls(styles.discard_btn, styles.btn)} onClick={handleDiscard}>
          {localize('aiNative.inline.diff.reject')}
          <span>{keyStrings.discardSequence}</span>
        </span>
      </div>
    </div>
  );
};

export interface IPartialEditWidgetOptions {
  /**
   * In some case, we don't want to show the accept and reject button
   */
  hideAcceptPartialEditWidget?: boolean;
}

@Injectable({ multiple: true })
export class AcceptPartialEditWidget extends ReactInlineContentWidget {
  static ID = 'AcceptPartialEditWidgetID';

  @Autowired(KeybindingRegistry)
  private readonly keybindingRegistry: KeybindingRegistry;

  private _id: string;
  private _addedRangeId: string;

  private readonly _onAccept = this.registerDispose(new Emitter<void>());
  public readonly onAccept: Event<void> = this._onAccept.event;

  private readonly _onDiscard = this.registerDispose(new Emitter<void>());
  public readonly onDiscard: Event<void> = this._onDiscard.event;

  positionPreference = [ContentWidgetPositionPreference.EXACT];

  constructor(protected readonly editor: ICodeEditor, protected editWidgetOptions?: IPartialEditWidgetOptions) {
    super(editor);
  }

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
    if (this.editWidgetOptions?.hideAcceptPartialEditWidget) {
      return;
    }

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

  public recordAddedRangeId(id: string): void {
    this._addedRangeId = id;
  }

  public getAddedRangeId(): string {
    return this._addedRangeId;
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

  get isPending(): boolean {
    return this.status === 'pending';
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

export interface IRemovedZoneWidgetOptions extends IOptions {
  isHidden?: boolean;
  recordPosition?: Position;
  undoRedoGroup?: UndoRedoGroup;
}

export class RemovedZoneWidget extends ZoneWidget {
  private root: ReactDOMClient.Root;
  private _recordPosition: Position;

  private _hidden: boolean = false;
  get isHidden(): boolean {
    return this._hidden;
  }

  private _group: UndoRedoGroup;
  public get group(): UndoRedoGroup {
    return this._group;
  }

  public status: IWidgetStatus = 'pending';

  constructor(editor: ICodeEditor, public readonly textLines: ITextLinesTokens[], options: IRemovedZoneWidgetOptions) {
    super(editor, options);

    if (isDefined(options.isHidden)) {
      this._hidden = options.isHidden;
    }

    if (isDefined(options.recordPosition)) {
      this._recordPosition = options.recordPosition;
    }

    if (isDefined(options.undoRedoGroup)) {
      this._group = options.undoRedoGroup;
    }

    // 监听 position 的位置变化
    const positionMarkerId = this['_positionMarkerId'] as IEditorDecorationsCollection;
    this._disposables.add(
      positionMarkerId.onDidChange((event: IModelDecorationsChangedEvent) => {
        const range = positionMarkerId.getRange(0);
        if (range) {
          this._recordPosition = range.getStartPosition();
        }
      }),
    );
  }

  setGroup(group): void {
    this._group = group;
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

  getLastPosition(): Position {
    return this.position || this._recordPosition;
  }

  accept(): void {
    this.status = 'accept';
    this.hide();
  }

  discard(): void {
    this.status = 'discard';
    super.hide();
  }

  hide(): void {
    this._hidden = true;
    super.hide();
  }

  resume(): void {
    this.status = 'pending';
    const position = this.getLastPosition();
    if (position) {
      this.show(position, this.height);
    }
  }

  override show(pos: IPosition, heightInLines: number): void {
    this._hidden = false;
    this.status = 'pending';
    super.show(pos, heightInLines);
  }

  override revealRange(): void {}

  override create(): void {
    super.create();
    this.mountRender();
  }

  mountRender(): void {
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

class AddedRangeDeltaDecorations extends DeltaDecorations {
  public status: IWidgetStatus = 'pending';

  accept(): void {
    this.status = 'accept';
    super.hide();
  }

  discard(): void {
    this.status = 'discard';
    super.hide();
  }
}

export class AddedRangeDecorationsCollection extends EnhanceDecorationsCollection<AddedRangeDeltaDecorations> {
  protected override createDecorations(metaData: IDeltaDecorationsOptions) {
    return new AddedRangeDeltaDecorations(metaData);
  }
}

import { ISelection, IRange, ILineChange } from '@opensumi/ide-core-common';
import {
  IUndoStopOptions,
  ISingleEditOperation,
  IDecorationRenderOptions,
  IDecorationApplyOptions,
  IResourceOpenOptions,
} from '@opensumi/ide-editor';
// eslint-disable-next-line import/no-restricted-paths
import type { EndOfLineSequence } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import type { RenderLineNumbersType as MonacoRenderLineNumbersType } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';

import { ViewColumn } from './enums';
export * from './custom-editor';
export * from './enums';
export interface IExtensionHostEditorService {
  $acceptChange(change: IEditorChangeDTO);
  $acceptPropertiesChange(change: IEditorStatusChangeDTO);
}

export interface IMainThreadEditorsService {
  $createTextEditorDecorationType(key: string, resolved: IDecorationRenderOptions): Promise<void>;
  $deleteTextEditorDecorationType(key: string): void;
  $applyDecoration(id: string, decorationKey: string, options: IDecorationApplyOptions[]): Promise<void>;
  $applyEdits(
    id: string,
    documentVersionId: number,
    edits: ISingleEditOperation[],
    options: { setEndOfLine: EndOfLineSequence | undefined; undoStopBefore: boolean; undoStopAfter: boolean },
  ): Promise<boolean>;
  $revealRange(id: string, range: IRange, type?: TextEditorRevealType): Promise<void>;
  $getInitialState(): Promise<IEditorChangeDTO>;
  $closeEditor(id: string): Promise<void>;
  $insertSnippet(id: string, snippet: string, ranges?: IRange[], options?: IUndoStopOptions): Promise<void>;
  $openResource(uri: string, options: IResourceOpenOptions): Promise<string>;
  $setSelections(id: string, selections: ISelection[]): Promise<void>;
  $updateOptions(id: string, options: ITextEditorUpdateConfiguration): Promise<void>;
  $getDiffInformation(id: string): Promise<ILineChange[]>;
}

export interface IEditorStatusChangeDTO {
  id: string;

  selections?: ISelectionChangeEvent;

  options?: IResolvedTextEditorConfiguration;

  visibleRanges?: IRange[];

  viewColumn?: number;
}

export interface IEditorChangeDTO {
  created?: IEditorCreatedDTO[];

  removed?: string[];

  actived?: string;
}

export interface IEditorCreatedDTO extends IEditorChangeDTO {
  id: string;

  selections: ISelection[];

  options: IResolvedTextEditorConfiguration;

  uri: string;

  viewColumn: number;

  visibleRanges: IRange[];
}

export interface ISelectionChangeEvent {
  selections: ISelection[];
  source?: string;
}

export interface IResolvedTextEditorConfiguration {
  tabSize: number;
  indentSize: number;
  insertSpaces: boolean;
  cursorStyle: TextEditorCursorStyle;
  lineNumbers: MonacoRenderLineNumbersType;
}

export interface ITextEditorUpdateConfiguration {
  tabSize?: number | 'auto';
  indentSize?: number | 'tabSize';
  insertSpaces?: boolean | 'auto';
  cursorStyle?: TextEditorCursorStyle;
  lineNumbers?: MonacoRenderLineNumbersType;
}

// 继承自 MonacoRenderLineNumbersType#enum
// export const RenderLineNumbersType = MonacoRenderLineNumbersType;
export type RenderLineNumbersType = MonacoRenderLineNumbersType;

/**
 * The style in which the editor's cursor should be rendered.
 */
export enum TextEditorCursorStyle {
  /**
   * As a vertical line (sitting between two characters).
   */
  Line = 1,
  /**
   * As a block (sitting on top of a character).
   */
  Block = 2,
  /**
   * As a horizontal line (sitting under a character).
   */
  Underline = 3,
  /**
   * As a thin vertical line (sitting between two characters).
   */
  LineThin = 4,
  /**
   * As an outlined block (sitting on top of a character).
   */
  BlockOutline = 5,
  /**
   * As a thin horizontal line (sitting under a character).
   */
  UnderlineThin = 6,
}

export enum TextEditorSelectionChangeKind {
  Keyboard = 1,
  Mouse = 2,
  Command = 3,
}

export namespace TextEditorSelectionChangeKind {
  export function fromValue(s: string | undefined) {
    switch (s) {
      case 'keyboard':
        return TextEditorSelectionChangeKind.Keyboard;
      case 'mouse':
        return TextEditorSelectionChangeKind.Mouse;
      case 'api':
        return TextEditorSelectionChangeKind.Command;
    }
    return undefined;
  }
}

/**
 * Represents different [reveal](#TextEditor.revealRange) strategies in a text editor.
 */
export enum TextEditorRevealType {
  /**
   * The range will be revealed with as little scrolling as possible.
   */
  Default = 0,
  /**
   * The range will always be revealed in the center of the viewport.
   */
  InCenter = 1,
  /**
   * If the range is outside the viewport, it will be revealed in the center of the viewport.
   * Otherwise, it will be revealed with as little scrolling as possible.
   */
  InCenterIfOutsideViewport = 2,
  /**
   * The range will always be revealed at the top of the viewport.
   */
  AtTop = 3,
}

export interface TextDocumentShowOptions {
  /**
   * An optional view column in which the [editor](#TextEditor) should be shown.
   * The default is the [active](#ViewColumn.Active), other values are adjusted to
   * be `Min(column, columnCount + 1)`, the [active](#ViewColumn.Active)-column is
   * not adjusted. Use [`ViewColumn.Beside`](#ViewColumn.Beside) to open the
   * editor to the side of the currently active one.
   */
  viewColumn?: ViewColumn;

  /**
   * An optional flag that when `true` will stop the [editor](#TextEditor) from taking focus.
   */
  preserveFocus?: boolean;

  /**
   * An optional flag that controls if an [editor](#TextEditor)-tab will be replaced
   * with the next editor or if it will be kept.
   */
  preview?: boolean;

  /**
   * An optional selection to apply for the document in the [editor](#TextEditor).
   */
  selection?: IRange;
}

export const CUSTOM_EDITOR_SCHEME = 'vscode_customEditor';

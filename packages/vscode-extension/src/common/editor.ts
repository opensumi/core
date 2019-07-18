import { ISelection, IRange } from '@ali/ide-core-common';

export interface IExtensionHostEditorService {
  $acceptChange(change: IEditorChangeDTO);
  $acceptPropertiesChange(change: IEditorStatusChangeDTO);
}

export interface IMainThreadEditorsService {
  $getInitialState(): IEditorChangeDTO;
}

export interface IEditorStatusChangeDTO {

  id: string;

  selections?: ISelectionChangeEvent;

  options?: IResolvedTextEditorConfiguration;

  visibleRanges?: IRange[];
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
  lineNumbers: RenderLineNumbersType;
}

export const enum RenderLineNumbersType {
  Off = 0,
  On = 1,
  Relative = 2,
  Interval = 3,
  Custom = 4,
}

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
      case 'keyboard': return TextEditorSelectionChangeKind.Keyboard;
      case 'mouse': return TextEditorSelectionChangeKind.Mouse;
      case 'api': return TextEditorSelectionChangeKind.Command;
    }
    return undefined;
  }
}

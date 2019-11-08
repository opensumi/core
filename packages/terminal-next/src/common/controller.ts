import { IWidgetGroup, IWidget } from './widget';

export const ITerminalController = Symbol('ITerminalController');
export interface ITerminalController {
  groups: IWidgetGroup[];
  state: { index: number };
  focusedId: string;
  firstInitialize(): void;
  split(): void;
  focus(current: IWidget): void;
  selectIndex(index: number): void;
  removeFocus(): void;
  createGroup(): void;
}

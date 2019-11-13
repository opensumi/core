import { IWidgetGroup } from './resize';

export const ITerminalController = Symbol('ITerminalController');
export interface ITerminalController {
  groups: IWidgetGroup[];
  state: { index: number };
  firstInitialize(): void;
  removeFocused(): void;
  snapshot(): string;

  addWidget(): void;
  focusWidget(widgetId: string): void;

  createGroup(): void;
  selectGroup(index: number): void;

  drawTerminalClient(dom: HTMLDivElement, termId: string): void;
  layoutTerminalClient(widgetId: string): void;
  eraseTerminalClient(termId: string): void;
}

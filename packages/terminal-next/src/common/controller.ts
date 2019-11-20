import { IWidgetGroup } from './resize';
import { ITerminalError } from './error';

export const ITerminalController = Symbol('ITerminalController');
export interface ITerminalController {
  currentGroup: IWidgetGroup | undefined;
  groups: IWidgetGroup[];
  state: { index: number };
  errors: Map<string, ITerminalError>;
  recovery(history: any): Promise<void>;
  firstInitialize(): void;
  removeFocused(): void;
  snapshot(): string;

  addWidget(client?: any): void;
  focusWidget(widgetId: string): void;
  removeWidget(widgetId: string): void;

  createGroup(selected?: boolean): number;
  selectGroup(index: number): void;

  drawTerminalClient(dom: HTMLDivElement, termId: string, restore?: boolean): void;
  showTerminalClient(widgetId: string): void;
  retryTerminalClient(widgetId: string): void;
  layoutTerminalClient(widgetId: string): void;
  eraseTerminalClient(termId: string): void;
  toJSON(): { groups: any[] };
}

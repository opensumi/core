import { ITerminalOptions, ITheme, Terminal } from 'xterm';

import { SupportedOptions } from './preference';

export interface IXTerm {
  raw: Terminal;
  container: HTMLDivElement;
  xtermOptions: ITerminalOptions & SupportedOptions;

  copySelection(): Promise<void>;
  onSelectionChange(): Promise<void>;
  open(): void;
  fit(): void;
  findNext(text: string): boolean;
  updatePreferences(options: SupportedOptions): void;
  updateTheme(theme: ITheme | undefined): void;
}

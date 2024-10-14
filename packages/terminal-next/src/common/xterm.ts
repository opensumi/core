import { ITerminalOptions, ITheme, Terminal } from '@xterm/xterm';

import { SupportedOptions } from './preference';

export enum RenderType {
  Canvas = 'canvas',
  WebGL = 'webgl',
  Dom = 'dom',
}

export interface IXTerm {
  raw: Terminal;
  container: HTMLDivElement;
  xtermOptions: ITerminalOptions & SupportedOptions;

  copySelection(): Promise<void>;
  onSelectionChange(): Promise<void>;
  open(): void;
  fit(): void;
  findNext(text: string): boolean;
  closeSearch(): void;
  updatePreferences(options: SupportedOptions): void;
  updateTheme(theme: ITheme | undefined): void;
}

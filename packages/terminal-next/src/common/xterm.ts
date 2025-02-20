import { ISearchOptions } from '@xterm/addon-search';
import { IEvent, ITerminalOptions, ITheme, Terminal } from '@xterm/xterm';

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

  onSearchResultsChange: IEvent<{ resultIndex: number; resultCount: number }>;

  copySelection(): Promise<void>;
  onSelectionChange(): Promise<void>;
  open(): void;
  fit(): void;
  findNext(text: string, searchOptions?: ISearchOptions): boolean;
  findPrevious(text: string, searchOptions?: ISearchOptions): boolean;
  closeSearch(): void;
  updatePreferences(options: SupportedOptions): void;
  updateTheme(theme: ITheme | undefined): void;
}

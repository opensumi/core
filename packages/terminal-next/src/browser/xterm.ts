import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { ITerminalOptions, ITheme, Terminal, IEvent } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { AttachAddon } from './terminal.addon';
import { Disposable } from '@opensumi/ide-core-common';

import styles from './component/terminal.module.less';

export interface XTermOptions {
  cwd?: string;
  xtermOptions?: Partial<ITerminalOptions>;
}

@Injectable({ multiple: true })
export class XTerm extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  container: HTMLDivElement;

  raw: Terminal;

  /** addons */
  private _fitAddon: FitAddon;
  private _searchAddon: SearchAddon;
  /** end */

  constructor(options?: XTermOptions) {
    super();
    this.container = document.createElement('div');
    this.container.className = styles.terminalInstance;

    this.raw = new Terminal(options?.xtermOptions);
    this._prepareAddons();
  }
  private _prepareAddons() {
    this._searchAddon = new SearchAddon();
    this._fitAddon = new FitAddon();
    this.addDispose([this._searchAddon, this._fitAddon]);

    this.raw.loadAddon(this._searchAddon);
    this.raw.loadAddon(this._fitAddon);
  }
  updateTheme(theme: ITheme | undefined) {
    if (theme) {
      this.raw.setOption('theme', theme);
    }
  }
  findNext(text: string) {
    return this._searchAddon.findNext(text);
  }
  open() {
    this.raw.open(this.container);
  }
  fit() {
    this._fitAddon.fit();
  }
  dispose() {
    this.raw.dispose();
    this.container.remove();
  }
}

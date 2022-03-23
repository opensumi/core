import { ITerminalOptions, ITheme, Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';

import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { IClipboardService } from '@opensumi/ide-core-browser';
import { Disposable } from '@opensumi/ide-core-common';
import { MessageService } from '@opensumi/ide-overlay/lib/browser/message.service';

import { SupportedOptions } from '../common/preference';

import styles from './component/terminal.module.less';

export interface XTermOptions {
  cwd?: string;
  // 要传给 xterm 的参数和一些我们自己的参数（如 copyOnSelection）
  // 现在混在一起，也不太影响使用
  xtermOptions: SupportedOptions & ITerminalOptions;
}

@Injectable({ multiple: true })
export class XTerm extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(MessageService)
  protected messageService: MessageService;

  @Autowired(IClipboardService)
  clipboardService: IClipboardService;

  container: HTMLDivElement;

  raw: Terminal;

  xtermOptions: ITerminalOptions & SupportedOptions;

  /** addons */
  private _fitAddon: FitAddon;
  private _searchAddon: SearchAddon;
  /** end */

  constructor(public options: XTermOptions) {
    super();

    this.container = document.createElement('div');
    this.container.className = styles.terminalInstance;

    this.xtermOptions = options.xtermOptions;

    this.raw = new Terminal(this.xtermOptions);
    this._prepareAddons();
    this.raw.onSelectionChange(this.onSelectionChange.bind(this));
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
      this.xtermOptions = {
        ...this.xtermOptions,
        theme,
      };
    }
  }

  updatePreferences(options: SupportedOptions) {
    this.xtermOptions = {
      ...this.xtermOptions,
      ...options,
    };
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

  async onSelectionChange() {
    if (this.xtermOptions?.copyOnSelection) {
      if (this.raw.hasSelection()) {
        await this.copySelection();
      }
    }
  }

  async copySelection() {
    if (this.raw.hasSelection()) {
      await this.clipboardService.writeText(this.raw.getSelection());
    } else {
      this.messageService.warning('The terminal has no selection to copy');
    }
  }

  dispose() {
    this.raw.dispose();
    this.container.remove();
  }
}

import { ITerminalOptions, ITheme, Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { ISearchOptions, SearchAddon } from 'xterm-addon-search';

import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { IClipboardService } from '@opensumi/ide-core-browser';
import { Disposable } from '@opensumi/ide-core-common';
import { MessageService } from '@opensumi/ide-overlay/lib/browser/message.service';
import { WorkbenchThemeService } from '@opensumi/ide-theme/lib/browser/workbench.theme.service';
import { IThemeService } from '@opensumi/ide-theme/lib/common/theme.service';

import { SupportedOptions } from '../common/preference';

import styles from './component/terminal.module.less';
import {
  TERMINAL_FIND_MATCH_BACKGROUND_COLOR,
  TERMINAL_FIND_MATCH_BORDER_COLOR,
  TERMINAL_FIND_MATCH_HIGHLIGHT_BACKGROUND_COLOR,
  TERMINAL_FIND_MATCH_HIGHLIGHT_BORDER_COLOR,
  TERMINAL_OVERVIEW_RULER_CURSOR_FOREGROUND_COLOR,
  TERMINAL_OVERVIEW_RULER_FIND_MATCH_FOREGROUND_COLOR,
} from './terminal.color';

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
  protected clipboardService: IClipboardService;

  @Autowired(IThemeService)
  protected themeService: WorkbenchThemeService;

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

  private getFindColors() {
    const theme = this.themeService.getCurrentThemeSync();
    // Theme color names align with monaco/vscode whereas xterm.js has some different naming.
    // The mapping is as follows:
    // - findMatch -> activeMatch
    // - findMatchHighlight -> match
    const findMatchBackground = theme.getColor(TERMINAL_FIND_MATCH_BACKGROUND_COLOR);
    const findMatchBorder = theme.getColor(TERMINAL_FIND_MATCH_BORDER_COLOR);
    const findMatchOverviewRuler = theme.getColor(TERMINAL_OVERVIEW_RULER_CURSOR_FOREGROUND_COLOR);
    const findMatchHighlightBackground = theme.getColor(TERMINAL_FIND_MATCH_HIGHLIGHT_BACKGROUND_COLOR);
    const findMatchHighlightBorder = theme.getColor(TERMINAL_FIND_MATCH_HIGHLIGHT_BORDER_COLOR);
    const findMatchHighlightOverviewRuler = theme.getColor(TERMINAL_OVERVIEW_RULER_FIND_MATCH_FOREGROUND_COLOR);

    return {
      activeMatchBackground: findMatchBackground?.toString() || 'transparent',
      activeMatchBorder: findMatchBorder?.toString() || 'transparent',
      activeMatchColorOverviewRuler: findMatchOverviewRuler?.toString() || 'transparent',
      matchBackground: findMatchHighlightBackground?.toString() || 'transparent',
      matchBorder: findMatchHighlightBorder?.toString() || 'transparent',
      matchOverviewRuler: findMatchHighlightOverviewRuler?.toString() || 'transparent',
    };
  }

  findNext(text: string) {
    const options: ISearchOptions = {
      decorations: this.getFindColors(),
    };
    return this._searchAddon.findNext(text, options);
  }

  closeSearch() {
    this._searchAddon.clearDecorations();
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

/* eslint-disable @typescript-eslint/ban-ts-comment */
import { FitAddon } from '@xterm/addon-fit';
import { ISearchOptions, SearchAddon } from '@xterm/addon-search';
import { ITerminalOptions, ITheme, Terminal } from '@xterm/xterm';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { IClipboardService } from '@opensumi/ide-core-browser';
import { PreferenceService } from '@opensumi/ide-core-browser/lib/preferences/types';
import { Disposable } from '@opensumi/ide-core-common';
import { MessageService } from '@opensumi/ide-overlay/lib/browser/message.service';
import { WorkbenchThemeService } from '@opensumi/ide-theme/lib/browser/workbench.theme.service';
import { PANEL_BACKGROUND } from '@opensumi/ide-theme/lib/common/color-registry';
import { IThemeService } from '@opensumi/ide-theme/lib/common/theme.service';

import { CodeTerminalSettingId, SupportedOptions } from '../common/preference';
import { IXTerm, RenderType } from '../common/xterm';

import styles from './component/terminal.module.less';
import {
  TERMINAL_BACKGROUND_COLOR,
  TERMINAL_FIND_MATCH_BACKGROUND_COLOR,
  TERMINAL_FIND_MATCH_BORDER_COLOR,
  TERMINAL_FIND_MATCH_HIGHLIGHT_BACKGROUND_COLOR,
  TERMINAL_FIND_MATCH_HIGHLIGHT_BORDER_COLOR,
  TERMINAL_OVERVIEW_RULER_CURSOR_FOREGROUND_COLOR,
  TERMINAL_OVERVIEW_RULER_FIND_MATCH_FOREGROUND_COLOR,
} from './terminal.color';

import type { CanvasAddon as CanvasAddonType } from '@xterm/addon-canvas';
import type { WebglAddon as WebglAddonType } from '@xterm/addon-webgl';

export interface XTermOptions {
  cwd?: string;
  // 要传给 xterm 的参数和一些我们自己的参数（如 copyOnSelection）
  // 现在混在一起，也不太影响使用
  xtermOptions: SupportedOptions & ITerminalOptions;
}

@Injectable({ multiple: true })
export class XTerm extends Disposable implements IXTerm {
  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(MessageService)
  protected messageService: MessageService;

  @Autowired(IClipboardService)
  protected clipboardService: IClipboardService;

  @Autowired(IThemeService)
  protected themeService: WorkbenchThemeService;

  @Autowired(PreferenceService)
  protected readonly preferenceService: PreferenceService;

  container: HTMLDivElement;

  raw: Terminal;

  xtermOptions: ITerminalOptions & SupportedOptions;

  /** addons */
  private _fitAddon: FitAddon;
  private _searchAddon: SearchAddon;
  private _webglAddon?: WebglAddonType;
  private _canvasAddon?: CanvasAddonType;
  /** end */

  constructor(public options: XTermOptions) {
    super();
    this.container = document.createElement('div');
    this.container.className = styles.terminalInstance;

    this.xtermOptions = options.xtermOptions;

    this.raw = new Terminal({
      allowProposedApi: true,
      ...this.xtermOptions,
    });
    this._prepareAddons();
    // 终端内运行的程序（如 vim、tmux、opencode 等）会通过 OSC 52 序列请求设置系统剪贴板，
    // 这是 Web / 远程场景下程序写入用户本机剪贴板的唯一通道，xterm.js 核心不处理该序列，
    // 需在此注册 handler 将内容写入浏览器剪贴板，否则序列会被静默丢弃。
    this.addDispose(this.raw.parser.registerOscHandler(52, (data) => this._handleOsc52(data)));
    this.raw.onSelectionChange(this.onSelectionChange.bind(this));
  }

  /**
   * 处理 OSC 52（Clipboard）序列，格式为 `OSC 52 ; Ps ; Pt ST`（Ps 为剪贴板选择，如 `c` 表示系统剪贴板），
   * Pt 为 base64 编码的内容，为 `?` 时表示查询剪贴板（不支持）。
   * @see https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Operating-System-Commands
   */
  private async _handleOsc52(data: string): Promise<boolean> {
    const semiIndex = data.indexOf(';');
    if (semiIndex === -1) {
      return false;
    }
    const payload = data.slice(semiIndex + 1);
    // 不支持剪贴板查询
    if (!payload || payload === '?') {
      return false;
    }
    try {
      const byteString = atob(payload);
      const bytes = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        bytes[i] = byteString.charCodeAt(i);
      }
      // 编码侧使用 UTF-8（如 `Buffer.from(text).toString('base64')`），需按 UTF-8 解码，
      // 避免中文等多字节字符乱码
      const text = new TextDecoder().decode(bytes);
      await this.clipboardService.writeText(text);
      return true;
    } catch (err) {
      // 忽略非法序列，不影响终端正常输出
      return false;
    }
  }

  protected async enableCanvasRenderer() {
    try {
      if (!this._canvasAddon) {
        // @ts-ignore
        this._canvasAddon = new (await import('@xterm/addon-canvas')).CanvasAddon();
      }

      this.addDispose(this._canvasAddon);
      this.raw.loadAddon(this._canvasAddon);

      if (this._webglAddon) {
        this._webglAddon.dispose();
        this._webglAddon = undefined;
      }
    } catch (err) {
      // ignore
    }
  }

  protected async enableWebglRenderer() {
    try {
      if (!this._webglAddon) {
        // @ts-ignore
        this._webglAddon = new (await import('@xterm/addon-webgl')).WebglAddon();
      }

      this.addDispose(this._webglAddon);
      this.addDispose(
        this._webglAddon.onContextLoss(async () => {
          // Fallback to canvas renderer when WebGL context is lost
          this._webglAddon?.dispose();
          this._webglAddon = undefined;
          await this.enableCanvasRenderer();
        }),
      );
      this.raw.loadAddon(this._webglAddon);
      if (this._canvasAddon) {
        this._canvasAddon.dispose();
        this._canvasAddon = undefined;
      }
    } catch (err) {
      await this.enableCanvasRenderer();
    }
  }

  private async _prepareAddons() {
    this._searchAddon = new SearchAddon();
    this._fitAddon = new FitAddon();

    this.addDispose([this._searchAddon, this._fitAddon]);

    this.raw.loadAddon(this._searchAddon);
    this.raw.loadAddon(this._fitAddon);
  }

  updateTheme(theme: ITheme | undefined) {
    if (theme) {
      this.raw.options.theme = theme;
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
    const terminalBackground = theme.getColor(TERMINAL_BACKGROUND_COLOR) || theme.getColor(PANEL_BACKGROUND);
    const findMatchBackground = theme.getColor(TERMINAL_FIND_MATCH_BACKGROUND_COLOR);
    const findMatchBorder = theme.getColor(TERMINAL_FIND_MATCH_BORDER_COLOR);
    const findMatchOverviewRuler = theme.getColor(TERMINAL_OVERVIEW_RULER_CURSOR_FOREGROUND_COLOR);
    const findMatchHighlightBackground = theme.getColor(TERMINAL_FIND_MATCH_HIGHLIGHT_BACKGROUND_COLOR);
    const findMatchHighlightBorder = theme.getColor(TERMINAL_FIND_MATCH_HIGHLIGHT_BORDER_COLOR);
    const findMatchHighlightOverviewRuler = theme.getColor(TERMINAL_OVERVIEW_RULER_FIND_MATCH_FOREGROUND_COLOR);

    return {
      activeMatchBackground: findMatchBackground?.toString(),
      activeMatchBorder: findMatchBorder?.toString() || 'transparent',
      activeMatchColorOverviewRuler: findMatchOverviewRuler?.toString() || 'transparent',
      matchBackground: terminalBackground
        ? findMatchHighlightBackground?.blend(terminalBackground).toString()
        : undefined,
      matchBorder: findMatchHighlightBorder?.toString() || 'transparent',
      matchOverviewRuler: findMatchHighlightOverviewRuler?.toString() || 'transparent',
    };
  }

  findNext(text: string, searchOptions: ISearchOptions = {}) {
    const options: ISearchOptions = {
      decorations: this.getFindColors(),
      ...searchOptions,
    };
    return this._searchAddon.findNext(text, options);
  }

  findPrevious(text: string, searchOptions: ISearchOptions = {}) {
    const options: ISearchOptions = {
      decorations: this.getFindColors(),
      ...searchOptions,
    };
    return this._searchAddon.findPrevious(text, options);
  }

  get onSearchResultsChange() {
    return this._searchAddon.onDidChangeResults;
  }

  closeSearch() {
    this._searchAddon.clearDecorations();
  }

  open() {
    this.raw.open(this.container);
    const renderType = this.preferenceService.get<RenderType>(CodeTerminalSettingId.XtermRenderType, RenderType.WebGL);
    if (renderType === RenderType.WebGL) {
      this.enableWebglRenderer();
    } else if (renderType === RenderType.Canvas) {
      this.enableCanvasRenderer();
    }
    // 不设置 enableWebGL/Canvas render 的话，默认就会 fallback 到 DOM Render
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

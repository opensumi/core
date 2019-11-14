import { observable } from 'mobx';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { Emitter, OnEvent, uuid, Event, isElectronEnv } from '@ali/ide-core-common';
import { Themable } from '@ali/ide-theme/lib/browser/workbench.theme.service';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { Terminal as XTerm } from 'xterm';
import * as attach from 'xterm/lib/addons/attach/attach';
import * as fit from 'xterm/lib/addons/fit/fit';
import * as fullscreen from 'xterm/lib/addons/fullscreen/fullscreen';
import * as search from 'xterm/lib/addons/search/search';
import * as webLinks from 'xterm/lib/addons/webLinks/webLinks';
import { AppConfig, getSlotLocation, ResizeEvent, ILogger, electronEnv } from '@ali/ide-core-browser';
import { WSChanneHandler as IWSChanneHandler } from '@ali/ide-connection';
import {
  TerminalOptions,
  ITerminalClient,
  TerminalInfo,
  IExternlTerminalService,
} from '../common';
import { TerminalImpl } from './terminal';
import * as TERMINAL_COLOR from './terminal-color';

XTerm.applyAddon(attach);
XTerm.applyAddon(fit);
XTerm.applyAddon(fullscreen);
XTerm.applyAddon(search);
XTerm.applyAddon(webLinks);

@Injectable()
export class TerminalClient extends Themable implements ITerminalClient {
  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(AppConfig)
  private config: AppConfig;

  @Autowired(IExternlTerminalService)
  private terminalService: IExternlTerminalService;

  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @observable
  termMap: Map<string, TerminalImpl> = new Map();

  @observable
  activeId: string;

  private changeActiveTerminalEvent: Emitter<string> = new Emitter();
  private closeTerminalEvent: Emitter<string> = new Emitter();
  private openTerminalEvent: Emitter<TerminalInfo> = new Emitter();
  private wrapEl: HTMLElement;
  private cols: number = 0;
  private rows: number = 0;
  private resizeId: NodeJS.Timeout;

  constructor() {
    super();

  }

  get onDidChangeActiveTerminal(): Event<string> {
    return this.changeActiveTerminalEvent.event;
  }

  get onDidCloseTerminal(): Event<string> {
    return this.closeTerminalEvent.event;
  }

  get onDidOpenTerminal(): Event<TerminalInfo> {
    return this.openTerminalEvent.event;
  }

  setWrapEl(el: HTMLElement) {
    this.wrapEl = el;
  }

  async styleById(id: string) {
    const term = this.getTerm(id);
    if (!term) {
      return;
    }
    const termBgColor = await this.getColor(TERMINAL_COLOR.TERMINAL_BACKGROUND_COLOR);
    const termFgColor = await this.getColor(TERMINAL_COLOR.TERMINAL_FOREGROUND_COLOR);
    const ansiColorMap = TERMINAL_COLOR.ansiColorMap;
    if (termBgColor) {
      term.setOption('theme', {
        background: termBgColor,
        foreground: termFgColor,
        cursor: await this.getColor(TERMINAL_COLOR.TERMINAL_CURSOR_FOREGROUND_COLOR) || termFgColor,
        cursorAccent: await this.getColor(TERMINAL_COLOR.TERMINAL_CURSOR_BACKGROUND_COLOR) || termBgColor,
        selection: await this.getColor(TERMINAL_COLOR.TERMINAL_SELECTION_BACKGROUND_COLOR),
        black: ansiColorMap['terminal.ansiBlack'].defaults[this.theme.type],
        red: ansiColorMap['terminal.ansiRed'].defaults[this.theme.type],
        green: ansiColorMap['terminal.ansiGreen'].defaults[this.theme.type],
        yellow: ansiColorMap['terminal.ansiYellow'].defaults[this.theme.type],
        blue: ansiColorMap['terminal.ansiBlue'].defaults[this.theme.type],
        magenta: ansiColorMap['terminal.ansiMagenta'].defaults[this.theme.type],
        cyan: ansiColorMap['terminal.ansiCyan'].defaults[this.theme.type],
        white: ansiColorMap['terminal.ansiWhite'].defaults[this.theme.type],
        brightBlack: ansiColorMap['terminal.ansiBrightBlack'].defaults[this.theme.type],
        brightRed: ansiColorMap['terminal.ansiBrightRed'].defaults[this.theme.type],
        brightGreen: ansiColorMap['terminal.ansiBrightGreen'].defaults[this.theme.type],
        brightYellow: ansiColorMap['terminal.ansiBrightYellow'].defaults[this.theme.type],
        brightBlue: ansiColorMap['terminal.ansiBrightBlue'].defaults[this.theme.type],
        brightMagenta: ansiColorMap['terminal.ansiBrightMagenta'].defaults[this.theme.type],
        brightCyan: ansiColorMap['terminal.ansiBrightCyan'].defaults[this.theme.type],
        brightWhite: ansiColorMap['terminal.ansiBrightWhite'].defaults[this.theme.type],
      });
      if (this.wrapEl && this.wrapEl.style) {
        this.wrapEl.parentElement!.style.backgroundColor = String(termBgColor);
      }
    }
  }

  async style() {
    for (const id of this.termMap.keys()) {
      this.styleById(id);
    }
  }

  createTerminal = async (options?: TerminalOptions, createdId?: string): Promise<TerminalImpl | null> => {
    if (!this.wrapEl) {
      this.logger.error('没有设置 wrapEl');
    }

    options = options || {};
    const el = this.createEl();
    let id: string;

    if (isElectronEnv()) {
      id = electronEnv.metadata.windowClientId + '|' + (createdId || uuid());
    } else {
      const WSChanneHandler = this.injector.get(IWSChanneHandler);
      id = WSChanneHandler.clientId + '|' + (createdId || uuid());
    }

    const term: XTerm = new XTerm({
      macOptionIsMeta: false,
      cursorBlink: false,
      scrollback: 2500,
      tabStopWidth: 8,
      fontSize: 12,
    });

    const Terminal = new TerminalImpl(Object.assign({
      terminalClient: this as ITerminalClient,
      terminalService: this.terminalService,
      xterm: term,
      id,
      el,
    }, options));

    const ret = await this.terminalService.create(
      id,
      Terminal,
      this.rows,
      this.cols,
      Object.assign({
        cwd: this.config.workspaceDir,
      },
        options,
      ));

    if (!ret) {
      return null;
    }

    this.termMap.set(id, Terminal);

    term.on('resize', (size) => {
      const { cols, rows } = size;
      this.cols = cols;
      this.rows = rows;
      this.terminalService.resize(id, rows, cols);
    });

    this.styleById(id);
    if (!options.hideFromUser) {
      this.showTerm(id);
    }
    this.openTerminalEvent.fire({
      id,
      name: options.name || '',
      isActive: !options.hideFromUser,
    });

    return Terminal;
  }

  sendText(id: string, text: string, addNewLine?: boolean) {
    const terminal = this.termMap.get(id);
    if (terminal) {
      this.terminalService.sendText(id, text, addNewLine);
    }
  }

  isFocused() {
    let findFocused = false;
    this.termMap.forEach((term) => {
      if (term.isFocused()) {
        findFocused = true;
      }
    });
    return findFocused;
  }

  showTerm(id: string, preserveFocus?: boolean) {
    const terminal = this.termMap.get(id);
    if (!terminal) {
      return;
    }
    const handler = this.layoutService.getTabbarHandler('terminal');
    handler.activate();
    this.termMap.forEach((term) => {
      if (term.id === id) {
        term.el.style.display = 'block';
        term.isActive = true;
        this.activeId = id;
        this.changeActiveTerminalEvent.fire(id);
        if (!preserveFocus) {
          term.el.focus();
          term.xterm.focus();
        }
      } else {
        term.el.style.display = 'none';
        term.isActive = false;
      }
    });
    setTimeout(() => {
      // 当底部bar 隐藏时，handler.activate() 后立即 fit() 会报错
      terminal.appendEl();
      (terminal.xterm as any).fit();
    });
  }

  hideTerm(id: string) {
    let preTerminalId: string = '';
    const termMapArray = Array.from(this.termMap);

    termMapArray.some((termArray, index) => {
      const termId = termArray[0];
      if (termId === id) {
        if (termMapArray[index - 1]) {
          preTerminalId = termMapArray[index - 1][0];
        } else if (termMapArray[index + 1]) {
          preTerminalId = termMapArray[index + 1][0];
        }
        return true;
      }
    });

    if (preTerminalId) {
      this.showTerm(preTerminalId);
    } else {
      // TODO hide terminal tab
    }
  }

  removeTerm(id?: string) {
    id = id || this.activeId;
    if (!id) {
      return;
    }
    const term = this.termMap.get(id);
    this.hideTerm(id);
    term!.dispose();
    this.termMap.delete(id);
    this.closeTerminalEvent.fire(id);
  }

  onSelectChange = (e: any) => {
    if (!e.currentTarget || !e.currentTarget.value) {
      return;
    }
    this.showTerm(e.currentTarget.value);
  }

  async getProcessId(id: string) {
    return await this.terminalService.getProcessId(id);
  }

  getTerminal(id: string) {
    return this.termMap.get(id);
  }

  private getTerm(id: string): XTerm | undefined {
    const terminal = this.termMap.get(id);
    return terminal && terminal.xterm ? terminal.xterm : undefined;
  }

  private createEl(): HTMLElement {
    const el = document.createElement('div');
    this.wrapEl.appendChild(el);
    return el;
  }

  @OnEvent(ResizeEvent)
  onResize(e: ResizeEvent, force?: boolean) {
    if (force || e.payload.slotLocation === getSlotLocation('@ali/ide-terminal2', this.config.layoutConfig)) {
      clearTimeout(this.resizeId);
      this.resizeId = setTimeout(() => {
        this.termMap.forEach((term) => {
          if (!term.isActive || !term.isAppendEl) {
            return;
          }
          (term.xterm as any).fit();
        });
      }, 100);
    }
  }

  dispose() {
    this.changeActiveTerminalEvent.dispose();
    this.openTerminalEvent.dispose();
    this.closeTerminalEvent.dispose();
  }
}

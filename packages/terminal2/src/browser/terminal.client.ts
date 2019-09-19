import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { Emitter, OnEvent, uuid, Event, isElectronEnv } from '@ali/ide-core-common';
import { Themable } from '@ali/ide-theme/lib/browser/workbench.theme.service';
import { PANEL_BACKGROUND } from '@ali/ide-theme/lib/common/color-registry';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { Terminal as XTerm } from 'xterm';
import * as attach from 'xterm/lib/addons/attach/attach';
import * as fit from 'xterm/lib/addons/fit/fit';
import * as fullscreen from 'xterm/lib/addons/fullscreen/fullscreen';
import * as search from 'xterm/lib/addons/search/search';
import * as webLinks from 'xterm/lib/addons/webLinks/webLinks';
import { AppConfig, getSlotLocation, ResizeEvent, ILogger, electronEnv } from '@ali/ide-core-browser';
import { observable } from 'mobx';
import {
  TerminalOptions,
  ITerminalClient,
  TerminalInfo,
  IExternlTerminalService,
} from '../common';
import { TerminalImpl } from './terminal';
import { WSChanneHandler as IWSChanneHandler } from '@ali/ide-connection';

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

  @observable
  wrapElSize: {
    height: string,
    width: string,
  } = { height: '100%', width: '100%' };

  private changeActiveTerminalEvent: Emitter<string> = new Emitter();
  private closeTerminalEvent: Emitter<string> = new Emitter();
  private openTerminalEvent: Emitter<TerminalInfo> = new Emitter();
  private wrapEl: HTMLElement;
  private cols: number = 0;
  private rows: number = 0;
  private resizeId: NodeJS.Timeout;

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
    const termBgColor = await this.getColor(PANEL_BACKGROUND);
    term.setOption('theme', {
      background: termBgColor,
    });
  }

  createTerminal = (options?: TerminalOptions, createdId?: string): TerminalImpl => {
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

    this.termMap.set(id, Terminal);
    term.open(el);
    // @ts-ignore
    term.webLinksInit();

    this.terminalService.create(
      id,
      Terminal,
      this.rows,
      this.cols,
      Object.assign({
        cwd: this.config.workspaceDir,
      },
        options,
      ));

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

  showTerm(id: string, preserveFocus?: boolean) {
    const terminal = this.termMap.get(id);
    if (!terminal) {
      return;
    }
    const handler = this.layoutService.getTabbarHandler('terminal');
    if (!handler.isVisible) {
      handler.activate();
    }
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
      (terminal.xterm as any).fit();
    }, 20);
  }

  hideTerm(id: string) {
    let preTerminalId: string = '';
    const termArray = Array.from(this.termMap);

    termArray.some((termArray, index) => {
      const termId = termArray[0];
      if (termId === id) {
        if (termArray[index - 1]) {
          preTerminalId = termArray[index - 1][0];
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
    if (!id) {
      this.termMap.forEach((term) => {
        if (id) {
          return;
        }
        if (term.isActive) {
          id = term.id;
        }
      });
    }
    if (!id) {
      return;
    }
    this.closeTerminalEvent.fire(id);
    const term = this.termMap.get(id);
    this.hideTerm(id);
    term!.dispose();
    this.termMap.delete(id);
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
  onResize(e: ResizeEvent) {
    if (e.payload.slotLocation === getSlotLocation('@ali/ide-terminal2', this.config.layoutConfig)) {
      this.wrapElSize = {
        width: e.payload.width + 'px',
        height: e.payload.height - 20 + 'px',
      };
      clearTimeout(this.resizeId);
      this.resizeId = setTimeout(() => {
        this.termMap.forEach((term) => {
          if (!term.isActive) {
            return;
          }
          (term.xterm as any).fit();
        });
      }, 50);
    }
  }

  dispose() {
    this.changeActiveTerminalEvent.dispose();
    this.openTerminalEvent.dispose();
    this.closeTerminalEvent.dispose();
  }
}

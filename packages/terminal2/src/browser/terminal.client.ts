import { Injectable, Autowired } from '@ali/common-di';
import { Emitter, OnEvent, uuid, Event, isUndefined } from '@ali/ide-core-common';
import { Themable } from '@ali/ide-theme/lib/browser/workbench.theme.service';
import { PANEL_BACKGROUND } from '@ali/ide-theme/lib/common/color-registry';
import {Terminal as XTerm} from 'xterm';
import * as attach from 'xterm/lib/addons/attach/attach';
import * as fit from 'xterm/lib/addons/fit/fit';
import * as fullscreen from 'xterm/lib/addons/fullscreen/fullscreen';
import * as search from 'xterm/lib/addons/search/search';
import * as webLinks from 'xterm/lib/addons/webLinks/webLinks';
import { AppConfig, getSlotLocation, ResizeEvent, ILogger } from '@ali/ide-core-browser';
import { observable, computed } from 'mobx';
import {
  ITerminalServicePath,
  ITerminalService,
  TerminalOptions,
  ITerminalClient,
  TerminalInfo,
  ITerminalServiceClient,
} from '../common';
import { TerminalImpl } from './terminal';
import { WSChanneHandler } from '@ali/ide-connection';

XTerm.applyAddon(attach);
XTerm.applyAddon(fit);
XTerm.applyAddon(fullscreen);
XTerm.applyAddon(search);
XTerm.applyAddon(webLinks);

@Injectable()
export class TerminalClient extends Themable implements ITerminalClient {
  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(WSChanneHandler)
  private wsChannelHandler: WSChanneHandler;
  // 增加 setClient 方法，用于消息标识
  @Autowired(ITerminalServicePath)
  private terminalService: ITerminalServiceClient;

  @Autowired(AppConfig)
  private config: AppConfig;

  private changeActiveTerminalEvent: Emitter<string> = new Emitter();
  private closeTerminalEvent: Emitter<string> = new Emitter();
  private openTerminalEvent: Emitter<TerminalInfo> = new Emitter();
  private eventMap: Map<string, Emitter<any>> = new Map();
  private wrapEl: HTMLElement;

  get onDidChangeActiveTerminal(): Event<string>  {
    return this.changeActiveTerminalEvent.event;
  }

  get onDidCloseTerminal(): Event<string> {
    return this.closeTerminalEvent.event;
  }

  get onDidOpenTerminal(): Event<TerminalInfo> {
    return this.openTerminalEvent.event;
  }

  @observable
  termMap: Map<string, TerminalImpl> = new Map();

  @observable
  activeId: string;

  @observable
  wrapElSize: {
    height: string,
    width: string,
  } = { height: '100%', width: '100%' };

  private cols: number = 0;
  private rows: number = 0;
  private resizeId: NodeJS.Timeout;

  setWrapEl(el: HTMLElement) {
    this.wrapEl = el;
  }

  sendText(id, text: string, addNewLine?: boolean) {
    const terminal = this.termMap.get(id);

    if (!terminal) {
      return this.logger.error(`没有找到终端`);
    }
    if (isUndefined(addNewLine)) {
      addNewLine = true;
    }
    if (terminal.serviceInitPromise) {
      terminal.serviceInitPromise.then(() => {
       this.send(id, text + (addNewLine ? `\r` : ''));
      });
    } else {
      this.send(id, text + (addNewLine ? `\r` : ''));
    }
  }

  private send(id, message) {
    const terminal = this.termMap.get(id);

    if (!terminal) {
      return this.logger.error(`没有找到终端`);
    }
    this.terminalService.onMessage(id, message);
  }

  private onMessage(id, message) {
    if (this.eventMap.has(id + 'message')) {
      this.eventMap.get(id + 'message')!.fire({
        data: message,
      });
    } else {
      this.logger.debug('message event not found');
    }

    // 第一次收到消息时，标志对应terminal服务启动完成，但是实际并未完成，暂时用延迟函数解决
    const terminal = this.termMap.get(id);
    if (terminal &&
      terminal.serviceInitPromise) {
      setTimeout(() => {
        terminal.finishServiceInitPromise();
      }, 200);
    }
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
    const id = this.wsChannelHandler.clientId + '|' + (createdId || uuid());
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
    const mockSocket = this.createMockSocket(id);
    // @ts-ignore
    term.attach(mockSocket);

    this.terminalService.create(id, this.rows, this.cols, Object.assign({
      cwd: this.config.workspaceDir,
    }, options)).then((pty) => {
      Terminal.setName(pty.process);
      Terminal.setProcessId(pty.pid);
    });

    term.on('resize', (size) => {
      const {cols, rows} = size;
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

  showTerm(id: string, preserveFocus?: boolean) {
    const terminal = this.termMap.get(id);
    if (!terminal) {
      return;
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
    }, 0);
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

  onSelectChange = (e) => {
    if (!e.currentTarget || !e.currentTarget.value) {
      return;
    }
    this.showTerm(e.currentTarget.value);
  }

  async getProcessId(id) {
    return await this.terminalService.getProcessId(id);
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

  private createMockSocket(id) {
    const self = this;
    return {
      addEventListener: (type: string, handler) => {
        this.logger.debug('terminal2 type', type);
        const emitter = new Emitter<any>();
        emitter.event(handler);
        self.eventMap.set(id + type, emitter);
      },
      send: (message) => {
        self.send(id, message);
      },
      readyState: 1,
    };
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

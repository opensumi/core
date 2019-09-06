import { Injectable, Autowired } from '@ali/common-di';
import { Emitter, OnEvent, uuid } from '@ali/ide-core-common';
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
} from '../common';
import { TerminalImpl } from './terminal';

XTerm.applyAddon(attach);
XTerm.applyAddon(fit);
XTerm.applyAddon(fullscreen);
XTerm.applyAddon(search);
XTerm.applyAddon(webLinks);

@Injectable()
export class TerminalClient extends Themable implements ITerminalClient {
  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(ITerminalServicePath)
  private terminalService: ITerminalService;

  @Autowired(AppConfig)
  private config: AppConfig;

  private eventMap: Map<string, Emitter<any>> = new Map();
  private wrapEl: HTMLElement;

  @observable
  termMap: Map<string, TerminalImpl> = new Map();

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

  send(id, message) {
    this.terminalService.onMessage(id, message);
  }

  onMessage(id, message) {
    if ( this.eventMap.has(id + 'message')) {
      this.eventMap.get(id + 'message')!.fire({
        data: message,
      });
    } else {
      this.logger.debug('message event not found');
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

  createTerminal = (options?: TerminalOptions): TerminalImpl => {
    if (!this.wrapEl) {
      this.logger.error('没有设置 wrapEl');
    }

    const el = this.createEl();
    const id = uuid();
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
    setTimeout(async () => {
      // @ts-ignore
      // term.fit();
      const pty = await this.terminalService.create(id, this.rows, this.cols, Object.assign({
        cwd: this.config.workspaceDir,
      }, options));
      Terminal.setName(pty.process);
      Terminal.setProcessId(pty.pid);
    }, 0);

    term.on('resize', (size) => {
      const {cols, rows} = size;
      this.cols = cols;
      this.rows = rows;
      this.terminalService.resize(id, rows, cols);
    });

    this.styleById(id);
    if (!options || !options.hideFromUser) {
      this.showTerm(id);
    }
    return Terminal;
  }

  showTerm(id: string, preserveFocus?: boolean) {
    const terminal = this.termMap.get(id);
    if (!terminal) {
      return;
    }
    Array.from(this.wrapEl.children).forEach((el: HTMLElement) => {
      el.style.display = 'none';
      terminal.isShow = false;
    });
    terminal.el.style.display = 'block';
    terminal.el.focus();
    if (!preserveFocus) {
      terminal.isShow = true;
    }
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
        if (term.isShow) {
          id = term.id;
        }
      });
    }
    if (!id) {
      return;
    }
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

  // FIXME: 未触发 resize 事件
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
          if (!term.isShow) {
            return;
          }
          (term.xterm as any).fit();
        });
      }, 50);
    }
  }
}

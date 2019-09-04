import {Injectable, Autowired} from '@ali/common-di';
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
import { ITerminalServicePath, ITerminalService } from '../common';

XTerm.applyAddon(attach);
XTerm.applyAddon(fit);
XTerm.applyAddon(fullscreen);
XTerm.applyAddon(search);
XTerm.applyAddon(webLinks);

@Injectable()
export class TerminalClient extends Themable {
  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(ITerminalServicePath)
  private terminalService: ITerminalService;

  @Autowired(AppConfig)
  private config: AppConfig;

  private eventMap: Map<string, Emitter<any>> = new Map();
  private termMap: Map<string, XTerm> = new Map();
  private wrapEl: HTMLElement;

  cols: number = 0;
  rows: number = 0;
  resizeId: NodeJS.Timeout;

  setWrapEl(el) {
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

  createMockSocket(id) {
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

  createTerminal() {
    if (!this.wrapEl) {
      return this.logger.error('没有设置 wrapEl');
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

    this.termMap.set(id, term);

    term.open(el);
    // @ts-ignore
    term.webLinksInit();
    const mockSocket = this.createMockSocket(id);
    // @ts-ignore
    term.attach(mockSocket);
    // FIXME terminal面板初始化非展开状态报错修复
    setTimeout(() => {
      // @ts-ignore
      term.fit();
      this.logger.debug(term);
      this.logger.debug('terminal2 ', 'rows', this.rows, 'cols', this.cols, 'workspaceDir', this.config.workspaceDir);
      this.terminalService.create(id, this.rows, this.cols, this.config.workspaceDir);
    }, 0);

    term.on('resize', (size) => {
      const {cols, rows} = size;
      this.cols = cols;
      this.rows = rows;
      this.terminalService.resize(id, rows, cols);
    });

    this.styleById(id);
  }

  private getTerm(id: string) {
    return this.termMap.get(id);
  }

  private createEl(): HTMLElement {
    const el = document.createElement('div');
    this.wrapEl.appendChild(el);
    return el;
  }

  // FIXME: 未触发 resize 事件
  @OnEvent(ResizeEvent)
  onResize(e: ResizeEvent) {
    if (e.payload.slotLocation === getSlotLocation('@ali/ide-terminal2', this.config.layoutConfig)) {

      clearTimeout(this.resizeId);
      this.resizeId = setTimeout(() => {
        this.termMap.forEach((term) => {
          (term as any).fit();
        });
      }, 20);
    }
  }
}

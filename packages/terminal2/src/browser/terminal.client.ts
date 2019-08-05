import {Injectable, Autowired} from '@ali/common-di';
import { Emitter, OnEvent} from '@ali/ide-core-common';
import { Themable } from '@ali/ide-theme/lib/browser/workbench.theme.service';
import { PANEL_BACKGROUND } from '@ali/ide-theme/lib/common/color-registry';
import {Terminal as XTerm} from 'xterm';
import * as attach from 'xterm/lib/addons/attach/attach';
import * as fit from 'xterm/lib/addons/fit/fit';
import * as fullscreen from 'xterm/lib/addons/fullscreen/fullscreen';
import * as search from 'xterm/lib/addons/search/search';
import * as webLinks from 'xterm/lib/addons/webLinks/webLinks';
import { AppConfig, getSlotLocation } from '@ali/ide-core-browser';
import { ResizeEvent } from '@ali/ide-main-layout';

XTerm.applyAddon(attach);
XTerm.applyAddon(fit);
XTerm.applyAddon(fullscreen);
XTerm.applyAddon(search);
XTerm.applyAddon(webLinks);

@Injectable()
export class TerminalClient extends Themable {
  private emitter: Emitter<any>;
  private eventMap: Map<string, Emitter<any>> = new Map();
  private term: XTerm;

  @Autowired('terminalService')
  private terminalService;

  @Autowired(AppConfig)
  private config: AppConfig;

  cols: number = 0;
  rows: number = 0;
  resizeId: NodeJS.Timeout;

  send(message) {
    this.terminalService.onMessage(message);
  }
  onMessage(message) {
    if ( this.eventMap.has('message')) {
      this.eventMap.get('message')!.fire({
        data: message,
      });
    } else {
      console.log('message event not found');
    }
  }

  createMockSocket(id) {
    const self = this;
    return {
      addEventListener: (type: string, handler) => {
        console.log('terminal2 type', type);
        const emitter = new Emitter<any>();
        emitter.event(handler);
        self.eventMap.set(type, emitter);
      },
      send: self.send.bind(this),
      readyState: 1,
    };
  }
  async style() {
    const termBgColor = await this.getColor(PANEL_BACKGROUND);
    this.term.setOption('theme', {
      background: termBgColor,
    });
  }
  initTerminal(terminalContainerEl: HTMLElement) {
    while (terminalContainerEl.children.length) {
      terminalContainerEl.removeChild(terminalContainerEl.children[0]);
    }

    this.term = new XTerm({
      macOptionIsMeta: false,
      cursorBlink: false,
      scrollback: 2500,
      tabStopWidth: 8,
      fontSize: 12,
    });

    this.term.open(terminalContainerEl);
    // @ts-ignore
    this.term.webLinksInit();
    const mockSocket = this.createMockSocket(1);
    // @ts-ignore
    this.term.attach(mockSocket);
    setTimeout(() => {
      // @ts-ignore
      this.term.fit();
      console.log(this.term);
      console.log('terminal2 ', 'rows', this.rows, 'cols', this.cols, 'workspaceDir', this.config.workspaceDir);
      this.terminalService.init(this.rows, this.cols, this.config.workspaceDir);
    }, 0);

    this.term.on('resize', (size) => {
      console.log('terminal2 resize', size);
      const {cols, rows} = size;
      this.cols = cols;
      this.rows = rows;
      this.terminalService.resize(rows, cols);
    });

    this.style();
  }

  // FIXME: 未触发 resize 事件
  @OnEvent(ResizeEvent)
  onResize(e: ResizeEvent) {
    console.log('terminal2 resize event', 'e.payload.slotLocation', e.payload.slotLocation, getSlotLocation('@ali/ide-terminal2', this.config.layoutConfig));

    if (e.payload.slotLocation === getSlotLocation('@ali/ide-terminal2', this.config.layoutConfig)) {

      clearTimeout(this.resizeId);
      this.resizeId = setTimeout(() => {
        if (this.term) {
          // @ts-ignore
          this.term.fit();
        }
      }, 20);
    }
  }
}

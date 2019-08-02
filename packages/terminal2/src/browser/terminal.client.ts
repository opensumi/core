import {Injectable, Autowired} from '@ali/common-di';
import {Emitter} from '@ali/ide-core-common';
import {Terminal as XTerm} from 'xterm';
import * as attach from 'xterm/lib/addons/attach/attach';
import * as fit from 'xterm/lib/addons/fit/fit';
import * as fullscreen from 'xterm/lib/addons/fullscreen/fullscreen';
import * as search from 'xterm/lib/addons/search/search';
import * as webLinks from 'xterm/lib/addons/webLinks/webLinks';
import { getSlotLocation, AppConfig } from '@ali/ide-core-browser';

XTerm.applyAddon(attach);
XTerm.applyAddon(fit);
XTerm.applyAddon(fullscreen);
XTerm.applyAddon(search);
XTerm.applyAddon(webLinks);

@Injectable()
export class TerminalClient {
  private emitter: Emitter<any>;
  private eventMap: Map<string, Emitter<any>> = new Map();
  private term: XTerm;

  @Autowired('terminalService')
  private terminalService;

  @Autowired(AppConfig)
  private config: AppConfig;

  cols: number = 0;
  rows: number = 0;

  send(message) {
    console.log('terminal client send message', message);
    this.terminalService.onMessage(message);
  }
  onMessage(message) {
    console.log('terminal client onMessage', message);
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
    }, 0);

    this.term.on('resize', (size) => {
      console.log('terminal2 resize', size);
      const {cols, rows} = size;
      this.cols = cols;
      this.rows = rows;
    });
    console.log(this.term);
    console.log('terminal2 ', 'rows', this.rows, 'cols', this.cols, 'workspaceDir', this.config.workspaceDir);
    this.terminalService.init(this.rows, this.cols, this.config.workspaceDir);
  }
}

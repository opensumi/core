import {Injectable, Autowired} from '@ali/common-di';
import {Emitter} from '@ali/ide-core-common';
import {Terminal as XTerm} from 'xterm';

@Injectable()
export class TerminalClients {
  private emitter: Emitter<any>;
  private eventMap: Map<string, Emitter<any>>;
  private term: XTerm;

  @Autowired('terminalService')
  private terminalService;

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
    return {
      addEventListener: (type: string, handler) => {
        const emitter = new Emitter<any>();
        emitter.event(handler);
        this.eventMap.set(type, emitter);
      },
      send: this.send.bind(this),
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

  }
}

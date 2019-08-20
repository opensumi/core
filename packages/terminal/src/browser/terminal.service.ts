import { Injectable, Autowired } from '@ali/common-di';
import { Themable } from '@ali/ide-theme/lib/browser/workbench.theme.service';
import {Terminal as XTerm} from 'xterm';
import { OnEvent } from '@ali/ide-core-common';
import { getSlotLocation, AppConfig, ResizeEvent } from '@ali/ide-core-browser';
import { PANEL_BACKGROUND } from '@ali/ide-theme/lib/common/color-registry';
const pkgName = require('../../package.json').name;

@Injectable()
export class TerminalService extends Themable {

  @Autowired(AppConfig)
  private config: AppConfig;

  term: XTerm;
  windowTerminalResizeId: NodeJS.Timeout;
  cols: number;
  rows: number;

  connectSocket: WebSocket;

  constructor() {
    super();
    this.connectRemote();
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
    // TODO 首次触发应该被自动调用
    this.style();
  }

  listenResize() {
    this.term.on('resize', (size) => {
      const {cols, rows} = size;
      this.cols = cols;
      this.rows = rows;
      if (this.connectSocket && this.connectSocket.readyState === WebSocket.OPEN) {
        this.connectSocket.send(JSON.stringify({
          action: 'resize',
          payload: {
            cols, rows,
          },
        }));
      }
    });
  }

  async style() {
    const termBgColor = await this.getColor(PANEL_BACKGROUND);
    this.term.setOption('theme', {
      background: termBgColor,
    });
  }

  @OnEvent(ResizeEvent)
  onResize(e: ResizeEvent) {
    if (e.payload.slotLocation === getSlotLocation(pkgName, this.config.layoutConfig)) {
      clearTimeout(this.windowTerminalResizeId);
      this.windowTerminalResizeId = setTimeout(() => {
        if (this.term) {
          // @ts-ignore
          this.term.fit();
        }
      }, 20);
    }
  }

  connectRemote() {
    // TODO: 根据窗口进行划分
    const recordId = 1;
    this.connectSocket = new WebSocket(`${this.config.wsPath}/terminal/connect/${recordId}`);
    this.connectSocket.addEventListener('open', (e) => {
      this.connectSocket.send(JSON.stringify({
        action: 'create',
        payload: {
          cols: this.cols,
          rows: this.rows,
          cwd: this.config.workspaceDir,
        },
      }));
    });
    this.connectSocket.addEventListener('message', (e) => {
      let msg = e.data;
      try {
        msg = JSON.parse(msg);
      } catch (err) {
        console.log(err);
      }

      if (msg.action === 'create') {
        const connectDataSocket = new WebSocket(`${this.config.wsPath}/terminal/data/connect/${recordId}`);

        connectDataSocket.addEventListener('open', () => {
          // @ts-ignore
          this.term.attach(connectDataSocket);
        }, false);
        connectDataSocket.addEventListener('close', (e) => {
          console.log('connect_data_socket close', e);
        });
        connectDataSocket.addEventListener('error', (e) => {
          console.log('connect_data_socket error', e);
        });
      }

    }, false);
    this.connectSocket.addEventListener('close', (e) => {
      console.log('connect_socket close');
    });
  }
}

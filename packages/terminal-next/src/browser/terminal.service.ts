import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { isElectronEnv, uuid } from '@ali/ide-core-common';
import { electronEnv } from '@ali/ide-core-browser';
import { WSChanneHandler as IWSChanneHandler } from '@ali/ide-connection';
import { Terminal } from 'xterm';
import { ITerminalExternalService } from '../common';

@Injectable()
export class NodeTerminalServiceProxy implements ITerminalExternalService {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  makeId() {
    if (isElectronEnv()) {
      return electronEnv.metadata.windowClientId + '|' + uuid();
    } else {
      const WSChanneHandler = this.injector.get(IWSChanneHandler);
      return WSChanneHandler.clientId + '|' + uuid();
    }
  }

  getOptions() {
    return {};
  }

  async sendText() {

  }

  async attach(term: Terminal, attachMethod: (s: WebSocket) => void) {
    return new Promise<void>((resolve) => {
      // Open the websocket connection to the backend
      const protocol = (location.protocol === 'https:') ? 'wss://' : 'ws://';
      const port = 3000;
      const socketUrl = `${protocol}${location.hostname}:${port}/shell`;
      const socket = new WebSocket(socketUrl);
      // Attach the socket to the terminal
      socket.onopen = () => {
        attachMethod(socket);
        resolve();
      };
    });
  }

  async resize() {

  }
}

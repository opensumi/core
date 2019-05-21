export interface IWebSocket {
  send(content: string): void;
  onMessage(cb: (data: any) => void): void;
  onError(cb: (reason: any) => void): void;
  onClose(cb: (code: number, reason: string) => void): void;
}

export class WebSocketChannel implements IWebSocket {
  public id: number;
  public servicePath: string;
  public serviceType: 'client' | 'server';

  private connectionSend: (content: string) => void;
  private fireMessage: (data: any) => void;
  private fireOpen: () => void;
  private stubClientId: string;

  constructor(connectionSend: any, path: string, id: number, stubClientId: string) {
    this.connectionSend = connectionSend;
    this.servicePath = path;
    this.id = id;
    this.stubClientId = stubClientId;
  }
  // server
  onMessage(cb: (data: any) => any) {
    this.fireMessage = cb;
  }
  onOpen(cb: () => void) {
    this.fireOpen = cb;
  }
  ready() {
    this.connectionSend(JSON.stringify({
      kind: 'ready',
      id: this.id,
    }));
  }

  handleMessage(msg: { kind: string; content: any; }) {
    if (msg.kind === 'ready') {
      this.fireOpen();
    } else if (msg.kind === 'data') {
      this.fireMessage(msg.content);
    }
  }

  // client
  open() {
    this.connectionSend(JSON.stringify({
      kind: 'open',
      id: this.id,
      path: this.servicePath,
      stubClientId: this.stubClientId,
    }));
  }
  send(content: string) {
    this.connectionSend(JSON.stringify({
      kind: 'data',
      id: this.id,
      content,
    }));
  }
  onError() {}
  onClose() {}
}

import { EventEmitter } from 'events';

export class MockedElectronIpcRenderer  extends EventEmitter implements Electron.IpcRenderer {


  eventNames() {
    return super.eventNames().map(s => s.toString());
  }

  public targetHost:EventEmitter = new EventEmitter();

  send(channel: string, ...args: any[]): void {
    this.targetHost.emit('send', {channel}, args);
  }  
  
  sendSync(channel: string, ...args: any[]) {
    this.targetHost.emit('sendSync', {channel}, args);
  }
  sendTo(webContentsId: number, channel: string, ...args: any[]): void {
    this.targetHost.emit('sendTo', {webContentsId, channel}, args);
  }
  
  sendToHost(channel: string, ...args: any[]): void {
    this.targetHost.emit('sendToHost', channel, ...args);
  }

}
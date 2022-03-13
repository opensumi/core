import type net from 'net';

export interface ElectronWindow extends Window {
  ElectronIpcRenderer: Electron.IpcRenderer;
  createNetConnection: (connectPath: any) => net.Socket;
  createRPCNetConnection: () => net.Socket;
  platform: NodeJS.Platform;
  BufferBridge: Buffer;
  currentWindowId: number;
  currentWebContentsId: number;
  onigWasmPath: string;
}

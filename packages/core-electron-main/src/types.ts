import type net from 'net';

import type { MessageConnection } from '@opensumi/vscode-jsonrpc';

export interface ElectronWindow extends Window {
  ElectronIpcRenderer: Electron.IpcRenderer;
  createNetConnection: (connectPath: any) => net.Socket;
  createRPCNetConnection: () => net.Socket;
  getMessageConnection: (connectPath?: any) => MessageConnection;
  platform: NodeJS.Platform;
  BufferBridge: Buffer;
  currentWindowId: number;
  currentWebContentsId: number;
  onigWasmPath: string;
}

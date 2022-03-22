import { IDisposable } from '@opensumi/ide-core-common';
import { IElectronMainApi } from '@opensumi/ide-core-common/lib/electron';
import type { MessageConnection } from '@opensumi/vscode-jsonrpc';

declare const ElectronIpcRenderer: IElectronIpcRenderer;

export interface IElectronIpcRenderer {
  on(channel: string, listener: (event: any, ...args: any[]) => void);
  once(channel: string, listener: (event: any, ...args: any[]) => void);
  removeListener(channel: string, listener: (event: any, ...args: any[]) => void);
  removeAllListeners(channel?: string);
  send(channel: string, ...args: any[]): void;
}

export function createElectronMainApi(name: string): IElectronMainApi<any> {
  let id = 0;
  return new Proxy(
    {
      on: (event: string, listener: (...args) => void): IDisposable => {
        const wrappedListener = (e, eventName, ...args) => {
          if (eventName === event) {
            return listener(...args);
          }
        };
        ElectronIpcRenderer.on('event:' + name, wrappedListener);
        return {
          dispose: () => {
            ElectronIpcRenderer.removeListener('event:' + name, wrappedListener);
          },
        };
      },
    },
    {
      get: (target, method) => {
        if (method === 'on') {
          return target[method];
        } else {
          return async (...args: any) =>
            new Promise((resolve, reject) => {
              const requestId = id++;
              ElectronIpcRenderer.send('request:' + name, method, requestId, ...args);
              const listener = (event, id, error, result) => {
                if (id === requestId) {
                  ElectronIpcRenderer.removeListener('response:' + name, listener);
                  if (error) {
                    const e = new Error(error.message);
                    e.stack = error.stack;
                    reject(e);
                  } else {
                    resolve(result);
                  }
                }
              };
              ElectronIpcRenderer.on('response:' + name, listener);
            });
        }
      },
    },
  );
}

export const electronEnv: {
  currentWindowId: number;
  currentWebContentsId: number;
  ipcRenderer: IElectronIpcRenderer;
  webviewPreload: string;
  plainWebviewPreload: string;
  [key: string]: any;
} = (global as any) || {};

if (typeof ElectronIpcRenderer !== 'undefined') {
  electronEnv.ipcRenderer = ElectronIpcRenderer;
}

export interface IElectronNativeDialogService {
  showOpenDialog(options: Electron.OpenDialogOptions): Promise<string[] | undefined>;

  showSaveDialog(options: Electron.SaveDialogOptions): Promise<string | undefined>;
}

export const IElectronNativeDialogService = Symbol('IElectronNativeDialogService');

export function createElectronClientConnection(connectPath?: string): MessageConnection {
  let socket;
  if (connectPath) {
    socket = electronEnv.createNetConnection(connectPath);
  } else {
    socket = electronEnv.createRPCNetConnection();
  }
  const { createSocketConnection } = require('@opensumi/ide-connection/lib/node/connect');
  return createSocketConnection(socket);
}

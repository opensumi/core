import { IDisposable } from '@opensumi/ide-core-common';
import { IElectronMainApi } from '@opensumi/ide-core-common/lib/electron';
import type { MessageConnection } from '@opensumi/vscode-jsonrpc';

declare const ElectronIpcRenderer: IElectronIpcRenderer;

const getCapturer = () => {
  if (window.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__?.captureIPC) {
    return window.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__.captureIPC;
  }
  return;
};

const capture = (message) => {
  const capturer = getCapturer();
  if (capturer !== undefined) {
    capturer(message);
  }
};

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
            // capture event:xxx
            capture({ ipcMethod: 'ipcRenderer.on', channel: `event:${name}`, args: [eventName, ...args] });
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

              // capture request:xxx
              capture({
                ipcMethod: 'ipcRenderer.send',
                channel: `request:${name}`,
                args: [method, requestId, ...args],
              });

              const listener = (event, id, error, result) => {
                if (id === requestId) {
                  // capture response:xxx
                  capture({ ipcMethod: 'ipcRenderer.on', channel: `response:${name}`, args: [id, error, result] });
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

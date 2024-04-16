import { NetSocketConnection } from '@opensumi/ide-connection/lib/common/connection';
import { IDisposable } from '@opensumi/ide-core-common';
import { IElectronMainApi } from '@opensumi/ide-core-common/lib/electron';

declare const ElectronIpcRenderer: IElectronIpcRenderer;

export interface IElectronIpcRenderer {
  on(channel: string, listener: (event: any, ...args: any[]) => void);
  once(channel: string, listener: (event: any, ...args: any[]) => void);
  removeListener(channel: string, listener: (event: any, ...args: any[]) => void);
  removeAllListeners(channel?: string);
  send(channel: string, ...args: any[]): void;
}

interface IPCMessage {
  type: 'event' | 'request' | 'response';
  service: string;
  method: string;
  requestId?: number; // for connecting 'requst' and 'response'
  args: any[];
}

const getCapturer = () => {
  if (window.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__?.captureIPC) {
    return window.__OPENSUMI_DEVTOOLS_GLOBAL_HOOK__.captureIPC;
  }
  return;
};

export function createElectronMainApi(name: string, enableCaptured?: boolean): IElectronMainApi<any> {
  let id = 0;
  const capturer = getCapturer();
  const capture = (message: IPCMessage) => {
    if (capturer) {
      capturer(message);
    }
  };

  return new Proxy(
    {
      on: (event: string, listener: (...args) => void): IDisposable => {
        const wrappedListener = (e, eventName, ...args) => {
          if (eventName === event) {
            enableCaptured && capture({ type: 'event', service: name, method: event, args });
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
        if (!target[method]) {
          target[method] = async (...args: any) =>
            new Promise((resolve, reject) => {
              const requestId = id++;
              ElectronIpcRenderer.send('request:' + name, method, requestId, ...args);
              enableCaptured && capture({ type: 'request', service: name, method: String(method), requestId, args });

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
                  enableCaptured &&
                    capture({
                      type: 'response',
                      service: name,
                      method: String(method),
                      requestId,
                      args: [error, result],
                    });
                }
              };

              switch (method) {
                case 'dispose':
                  return resolve(undefined);
                default:
                  ElectronIpcRenderer.on('response:' + name, listener);
              }
            });
        }
        return target[method];
      },
    },
  );
}

export interface IElectronEnvMetadata {
  windowClientId: string;
  [key: string]: any;
}

export const electronEnv: {
  currentWindowId: number;
  currentWebContentsId: number;
  ipcRenderer: IElectronIpcRenderer;
  webviewPreload: string;
  plainWebviewPreload: string;
  metadata: IElectronEnvMetadata;
  osRelease: string;
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

export function createNetSocketConnection(connectPath?: string): NetSocketConnection {
  let socket;
  if (connectPath) {
    socket = electronEnv.createNetConnection(connectPath);
  } else {
    socket = electronEnv.createRPCNetConnection();
  }
  return new NetSocketConnection(socket);
}

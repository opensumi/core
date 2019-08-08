import { IDisposable } from '@ali/ide-core-common';
import { IElectronMainApi } from '@ali/ide-core-common/lib/electron';

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
  return new Proxy({
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
  }, {
    get: (target, method) => {
      if (method === 'on') {
        return target[method];
      } else {
        return async (...args: any) => {
          const requestId = id ++;
          ElectronIpcRenderer.send('request:' + name, method, requestId, ...args);
          const listener = (event, id, error, result) => {
            if (id === requestId) {
              ElectronIpcRenderer.removeListener('response:' + name, listener);
              if (error) {
                const e =  new Error(error.message);
                e.stack = error.stack;
                throw e;
              } else {
                return result;
              }
            }
          };
          ElectronIpcRenderer.on('response:' + name, listener);
        };
      }
    },
  });
}

export const electronEnv: {
  currentWindowId: number,
  currentWebContentsId: number,
  ipcRenderer: IElectronIpcRenderer
  [key: string]: any,
} = (global as any) || {};

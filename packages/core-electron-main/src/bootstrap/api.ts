import { ipcMain } from 'electron';

import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { IDisposable, Disposable, getDebugLogger } from '@opensumi/ide-core-common';
import { IElectronURLService, IURLHandler } from '@opensumi/ide-core-common/lib/electron';

import {
  ElectronMainApiRegistry,
  ElectronURLHandlerRegistry,
  IElectronMainApiProvider,
  IElectronMainApp,
} from './types';

@Injectable()
export class ElectronMainApiRegistryImpl implements ElectronMainApiRegistry {
  private apis: Map<string, ElectronMainApiProxy> = new Map();

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  constructor() {}

  registerMainApi(name: string, api: IElectronMainApiProvider): IDisposable {
    if (this.apis.has(name)) {
      this.apis.get(name)!.dispose();
    }
    const proxy = this.injector.get(ElectronMainApiProxy, [name, api]);
    getDebugLogger().log('注册Electron Main Api: ' + name);
    this.apis.set(name, proxy);

    return {
      dispose: () => {
        if (this.apis.get(name) === proxy) {
          this.apis.delete(name);
        }
        proxy.dispose();
      },
    };
  }
}

@Injectable()
export class ElectronURLHandlerRegistryImpl implements ElectronURLHandlerRegistry {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  registerURLDefaultHandler(handler: IURLHandler): IDisposable {
    const urlService: IElectronURLService = this.injector.get(IElectronURLService);
    urlService.registerDefaultHandler(handler);

    return {
      dispose: () => {},
    };
  }

  registerURLHandler(handler: IURLHandler): IDisposable {
    const urlService: IElectronURLService = this.injector.get(IElectronURLService);
    urlService.registerHandler(handler);

    return {
      dispose: () => {
        urlService.deregisterHandler(handler);
      },
    };
  }
}

@Injectable({ multiple: true })
export class ElectronMainApiProxy extends Disposable {
  @Autowired(IElectronMainApp)
  app: IElectronMainApp;

  constructor(name: string, target: IElectronMainApiProvider) {
    super();
    const requestHandler = async (event, method: string, requestId: number, ...args: any[]) => {
      try {
        if (!target[method] || typeof target[method] !== 'function') {
          throw new Error(`No Request Handler for ${name}.${method}`);
        }
        const result = await target[method](...args);
        if (!event.sender.isDestroyed()) {
          event.sender.send('response:' + name, requestId, undefined, result);
        }
      } catch (e) {
        getDebugLogger().error(e);
        const err = {
          message: e.message || e.toString(),
          stack: e.stack,
        };
        if (!event.sender.isDestroyed()) {
          event.sender.send('response:' + name, requestId, err);
        }
      }
    };
    ipcMain.on('request:' + name, requestHandler);

    target.eventEmitter = {
      fire: (event: string, ...args: any[]) => {
        this.app.getCodeWindows().forEach((window) => {
          const browser = window.getBrowserWindow();
          if (!browser.isDestroyed()) {
            browser.webContents.send('event:' + name, event, ...args);
          }
        });
      },
    };

    this.addDispose({
      dispose: () => {
        ipcMain.removeAllListeners('request:' + name);
      },
    });
  }
}

import { app, BrowserWindow } from 'electron';

import { Injector, INJECTOR_TOKEN, Injectable, Autowired } from '@opensumi/di';
import { Disposable, Domain } from '@opensumi/ide-core-common';
import { IElectronURLService, IURLHandler } from '@opensumi/ide-core-common/lib/electron';

import {
  ElectronAppConfig,
  ElectronMainApiRegistry,
  ElectronMainContribution,
  ElectronURLHandlerRegistry,
} from '../types';

@Injectable()
export class ElectronURLService extends Disposable implements IElectronURLService {
  private defaultHandler: IURLHandler;

  private handlers = new Set<IURLHandler>();

  getHandlers() {
    return Array.from(this.handlers)
      .filter((handler) => handler.handleURL)
      .reverse();
  }

  async open(url: string): Promise<boolean> {
    for (const handler of this.getHandlers()) {
      if (await handler.handleURL(url)) {
        return true;
      }
    }

    if (this.defaultHandler) {
      await this.defaultHandler.handleURL(url);
      return true;
    }

    return false;
  }

  registerHandler(handler: IURLHandler) {
    this.handlers.add(handler);
  }

  registerDefaultHandler(handler: IURLHandler) {
    this.defaultHandler = handler;
  }

  deregisterHandler(handler: IURLHandler) {
    if (this.handlers.has(handler)) {
      this.handlers.delete(handler);
      return true;
    }
    return false;
  }
}

@Domain(ElectronMainContribution)
export class UrlElectronMainContribution implements ElectronMainContribution {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(ElectronAppConfig)
  private readonly appConfig: ElectronAppConfig;

  registerMainApi(registry: ElectronMainApiRegistry) {
    this.injector.addProviders({
      token: IElectronURLService,
      useClass: ElectronURLService,
    });

    registry.registerMainApi(IElectronURLService, this.injector.get(IElectronURLService));
  }

  registerURLHandler(registry: ElectronURLHandlerRegistry) {
    this.protocolInit();

    registry.registerURLDefaultHandler({
      async handleURL(url: string) {
        let browserWindow = BrowserWindow.getFocusedWindow();
        if (!browserWindow) {
          const browserWindows = BrowserWindow.getAllWindows();
          if (browserWindows.length) {
            browserWindow = browserWindows[0];
          }
        }
        ins.eventEmitter.fire('open-url', {
          url,
          windowId: browserWindow?.id,
        });
        return true;
      },
    });

    const ins = this.injector.get(IElectronURLService);
    app.on('open-url', (event, url) => {
      ins.open(url);
    });
  }

  protocolInit() {
    if (!this.appConfig.uriScheme) {
      return;
    }
    const uriScheme = this.appConfig.uriScheme;
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(uriScheme, process.execPath, [process.argv[1]]);
      }
    } else {
      app.setAsDefaultProtocolClient(uriScheme);
    }
  }
}

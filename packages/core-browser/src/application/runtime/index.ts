import { Injector } from '@opensumi/di';

import { AppConfig } from '../../react-providers';

import { BaseConnectionHelper } from './base-socket';
import { WebConnectionHelper } from './browser/socket';
import { ESupportRuntime } from './constants';
import { ElectronConnectionHelper } from './electron-renderer/socket';

export * from './browser/socket';
export * from './electron-renderer/socket';
export * from './base-socket';

export * from './constants';

export type ConnectionHelperFactory = ReturnType<typeof ConnectionHelperFactory>;
export function ConnectionHelperFactory(injector: Injector) {
  return (type: string) => {
    const appConfig = injector.get(AppConfig) as AppConfig;

    let connectionHelper: BaseConnectionHelper;

    switch (type) {
      case ESupportRuntime.Electron:
        connectionHelper = injector.get(ElectronConnectionHelper);
        break;
      case ESupportRuntime.Web:
        connectionHelper = injector.get(WebConnectionHelper, [
          {
            connectionPath: appConfig.connectionPath,
            connectionProtocols: appConfig.connectionProtocols,
          },
        ]);
        break;
      default: {
        throw new Error(`Unknown backend type: ${type}`);
      }
    }

    return connectionHelper;
  };
}

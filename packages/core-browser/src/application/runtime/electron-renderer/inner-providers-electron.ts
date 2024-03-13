import { Injector } from '@opensumi/di';
import { IElectronMainMenuService } from '@opensumi/ide-core-common';
import {
  IElectronMainLifeCycleService,
  IElectronMainUIService,
  IElectronURLService,
} from '@opensumi/ide-core-common/lib/electron';

import { ICtxMenuRenderer } from '../../../menu/next';
import {
  ElectronCtxMenuRenderer,
  ElectronMenuBarService,
  ElectronMenuFactory,
  IElectronMenuBarService,
  IElectronMenuFactory,
} from '../../../menu/next/renderer/ctxmenu/electron';
import { AppConfig } from '../../../react-providers/config-provider';
import { createElectronMainApi } from '../../../utils/electron';

export function injectElectronInnerProviders(injector: Injector) {
  const appConfig: AppConfig = injector.get(AppConfig);

  // Add special API services for Electron, mainly services that make calls to `Electron Main` process.
  injector.addProviders(
    {
      token: IElectronMainMenuService,
      useValue: createElectronMainApi(IElectronMainMenuService, appConfig.devtools),
    },
    {
      token: IElectronMainUIService,
      useValue: createElectronMainApi(IElectronMainUIService, appConfig.devtools),
    },
    {
      token: IElectronMainLifeCycleService,
      useValue: createElectronMainApi(IElectronMainLifeCycleService, appConfig.devtools),
    },
    {
      token: IElectronURLService,
      useValue: createElectronMainApi(IElectronURLService, appConfig.devtools),
    },
    {
      token: IElectronMenuFactory,
      useClass: ElectronMenuFactory,
    },
    {
      token: IElectronMenuBarService,
      useClass: ElectronMenuBarService,
    },
    {
      token: ICtxMenuRenderer,
      useClass: ElectronCtxMenuRenderer,
    },
  );
}

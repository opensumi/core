import { Injectable, Autowired } from '@opensumi/di';
import { URI, Schemes } from '@opensumi/ide-core-common';

import { AppConfig } from '../react-providers/config-provider';
import { IWindowService } from '../window';

import { IOpener } from '.';

@Injectable()
export class DefaultOpener implements IOpener {
  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(IWindowService)
  private readonly windowService: IWindowService;

  handleScheme(scheme: string) {
    return true;
  }

  async open(uri: URI) {
    if (this.appConfig.isElectronRenderer || [Schemes.http, Schemes.https].includes(uri.scheme)) {
      this.windowService.openNewWindow(uri.toString(true), {
        external: true,
      });
    } else {
      window.location.href = uri.toString(true);
    }
    return true;
  }
}

import { Injector, Autowired, INJECTOR_TOKEN } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { IElectronRendererURLService, IElectronURLService } from '@opensumi/ide-core-common/lib/electron';

import { ClientAppContribution } from '../common/common.define';
import { AppConfig } from '../react-providers/config-provider';
import { electronEnv } from '../utils/electron';

import { IOpenerService } from '.';

@Domain(ClientAppContribution)
export class ElectronOpenerContributionClient implements ClientAppContribution {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IOpenerService)
  private readonly openerService: IOpenerService;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  onStart() {
    if (this.appConfig.isElectronRenderer) {
      const electronRendererURLService: IElectronRendererURLService = this.injector.get(IElectronURLService);
      electronRendererURLService.on('open-url', (payload) => {
        if (electronEnv.currentWindowId === payload.windowId) {
          this.openerService.open(payload.url);
        }
      });
    }
  }
}

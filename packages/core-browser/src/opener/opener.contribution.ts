import { Injector, Autowired, INJECTOR_TOKEN } from '@opensumi/di';
import { Domain, ContributionProvider } from '@opensumi/ide-core-common';
import { IElectronRendererURLService, IElectronURLService } from '@opensumi/ide-core-common/lib/electron';

import { ClientAppContribution } from '../common/common.define';
import { AppConfig } from '../react-providers';
import { electronEnv } from '../utils/electron';

import { CommandOpener } from './command-opener';
import { HttpOpener } from './http-opener';

import { OpenerContribution, IOpenerService } from '.';

@Domain(OpenerContribution)
export class DefaultOpenerContribution implements OpenerContribution {
  @Autowired()
  private readonly commandOpener: CommandOpener;

  @Autowired()
  private readonly httpOpener: HttpOpener;

  registerOpener(register: IOpenerService): void {
    register.registerOpener(this.commandOpener);
    register.registerOpener(this.httpOpener);
  }
}

@Domain(ClientAppContribution)
export class OpenerContributionClient implements ClientAppContribution {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(OpenerContribution)
  private readonly contributionProvider: ContributionProvider<OpenerContribution>;

  @Autowired(IOpenerService)
  private readonly openerService: IOpenerService;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  onStart() {
    const contributions = this.contributionProvider.getContributions();
    for (const contribution of contributions) {
      contribution.registerOpener(this.openerService);
    }

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

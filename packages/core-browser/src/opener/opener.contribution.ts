import { Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { ContributionProvider, Domain } from '@opensumi/ide-core-common';

import { ClientAppContribution } from '../common/common.define';
import { AppConfig } from '../react-providers/config-provider';

import { CommandOpener } from './command-opener';
import { HttpOpener } from './http-opener';

import { IOpenerService, OpenerContribution } from '.';

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
  }
}

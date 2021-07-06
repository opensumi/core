import { Autowired } from '@ali/common-di';
import { ClientAppContribution } from '../common/common.define';
import { Domain, ContributionProvider } from '@ali/ide-core-common';
import { OpenerContribution, IOpenerService } from '.';
import { CommandOpener } from './command-opener';
import { HttpOpener } from './http-opener';

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

  @Autowired(OpenerContribution)
  private readonly contributionProvider: ContributionProvider<OpenerContribution>;

  @Autowired(IOpenerService)
  private readonly openerService: IOpenerService;

  onStart() {
    const contributions = this.contributionProvider.getContributions();
    for (const contribution of contributions) {
      contribution.registerOpener(this.openerService);
    }
  }
}

import { Autowired } from '@opensumi/di';
import { ClientAppContribution } from '@opensumi/ide-core-browser';
import { Domain, ILogger } from '@opensumi/ide-core-common';

@Domain(ClientAppContribution)
export class CollaborationContribution implements ClientAppContribution {
  @Autowired(ILogger)
  private logger: ILogger;

  initialize() {
    this.logger.log('Collaboration Contribution initialized');
  }
}

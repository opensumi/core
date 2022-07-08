import { Autowired } from '@opensumi/di';
import { ClientAppContribution } from '@opensumi/ide-core-browser';
import { Domain, ILogger } from '@opensumi/ide-core-common';

import { ICollaborationService } from '../common';

@Domain(ClientAppContribution)
export class CollaborationContribution implements ClientAppContribution {
  @Autowired(ILogger)
  private logger: ILogger;

  @Autowired(ICollaborationService)
  private collaborationService: ICollaborationService;

  onDidStart() {
    this.logger.log('Collaboration Contribution initialized');
    this.collaborationService.initialize();
  }

  onStop() {}
}

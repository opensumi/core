import { Autowired, Injectable } from '@opensumi/di';
import { INodeLogger } from '@opensumi/ide-core-node';

import { ICollaborationServiceForClient } from '../common';

@Injectable()
export class CollaborationServiceForClient implements ICollaborationServiceForClient {
  @Autowired(INodeLogger)
  private logger: INodeLogger;

  setInitContent(uri: string, initContent: string): void {
    this.logger.debug('pong', uri, initContent.slice(0, 20));
  }
}

import { Autowired, Injectable } from '@opensumi/di';

import { ConnectionBackServicePath, IConnectionBackService } from '../common';

export const ConnectionRTTBrowserServiceToken = Symbol('ConnectionRTTBrowserService');

@Injectable()
export class ConnectionRTTBrowserService {
  @Autowired(ConnectionBackServicePath)
  protected readonly connectionBackService: IConnectionBackService;

  async measure() {
    await this.connectionBackService.$measure();
  }
}

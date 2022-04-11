import { Injectable } from '@opensumi/di';

import { IConnectionBackService } from '../common';

@Injectable()
export class ConnectionRTTBackService implements IConnectionBackService {
  $measure(): Promise<void> {
    return Promise.resolve();
  }
}

import { Injectable } from '@opensumi/di';

import { createNetSocketConnection, electronEnv } from '../../utils/electron';
import { BaseConnectionHelper } from '../base';

@Injectable()
export class ElectronConnectionHelper extends BaseConnectionHelper {
  generateNewClientId() {
    return electronEnv.metadata.windowClientId;
  }

  createConnection() {
    return createNetSocketConnection();
  }
}

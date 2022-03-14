import { Injectable } from '@opensumi/di';

import { ITopbarNodeServer } from '../common';

@Injectable()
export class TopbarNodeServer implements ITopbarNodeServer {
  topbarHello() {
    // eslint-disable-next-line no-console
    console.log('you click topbar');
  }
}

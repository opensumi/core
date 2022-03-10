import { Injectable } from '@opensumi/di';
import { BackService, NodeModule } from '@opensumi/ide-core-node';

import { RemoteOpenerClientToken, RemoteOpenerServicePath, RemoteOpenerServiceToken } from '../common';

import { RemoteOpenerClientImpl } from './opener.client';
import { RemoteOpenerServiceImpl } from './opener.service';

export * from './opener.service';

@Injectable()
export class OpenerModule extends NodeModule {
  providers = [
    {
      token: RemoteOpenerServiceToken,
      useClass: RemoteOpenerServiceImpl,
    },
    {
      token: RemoteOpenerClientToken,
      useClass: RemoteOpenerClientImpl,
    },
  ];
  backServices: BackService[] = [
    {
      servicePath: RemoteOpenerServicePath,
      token: RemoteOpenerServiceToken,
    },
  ];
}

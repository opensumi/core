import { Injectable } from '@opensumi/di';
import {
  ICommonServer,
  CommonServerPath,
  INativeCredentialService,
  KeytarServicePath,
  INativeCryptrService,
  CryptrServicePath,
} from '@opensumi/ide-core-common';

import { HashCalculateContribution } from '../hash-calculate/hash-calculate.contribution';
import { NodeModule } from '../node-module';

import { CommonServer } from './common.server';
import { CredentialService } from './credential.server';
import { CryptrService } from './cryptr.server';

@Injectable()
export class ServerCommonModule extends NodeModule {
  providers = [
    HashCalculateContribution,
    {
      token: ICommonServer,
      useClass: CommonServer,
    },
    {
      token: INativeCredentialService,
      useClass: CredentialService,
    },
    {
      token: INativeCryptrService,
      useClass: CryptrService,
    },
  ];
  backServices = [
    {
      servicePath: CommonServerPath,
      token: ICommonServer,
    },
    {
      servicePath: KeytarServicePath,
      token: INativeCredentialService,
    },
    {
      servicePath: CryptrServicePath,
      token: INativeCryptrService,
    },
  ];
}

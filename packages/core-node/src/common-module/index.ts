import { Injectable } from '@opensumi/di';
import { CommonServerProtocol } from '@opensumi/ide-connection/lib/common/protocols/common-server';
import {
  CommonServerPath,
  CryptoServicePath,
  ICommonServer,
  INativeCredentialService,
  INativeCryptoService,
  KeytarServicePath,
} from '@opensumi/ide-core-common';

import { HashCalculateContribution } from '../hash-calculate/hash-calculate.contribution';
import { NodeModule } from '../node-module';

import { CommonServer } from './common.server';
import { CredentialService } from './credential.server';
import { CryptoService } from './crypto.server';

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
      token: INativeCryptoService,
      useClass: CryptoService,
    },
  ];
  backServices = [
    {
      servicePath: CommonServerPath,
      token: ICommonServer,
      protocol: CommonServerProtocol,
    },
    {
      servicePath: KeytarServicePath,
      token: INativeCredentialService,
    },
    {
      servicePath: CryptoServicePath,
      token: INativeCryptoService,
    },
  ];
}

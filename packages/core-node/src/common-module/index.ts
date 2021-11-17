import { Injectable } from '@ide-framework/common-di';
import { ICommonServer, CommonServerPath, INativeCredentialService, KeytarServicePath, INativeCryptrService, CryptrServicePath } from '@ide-framework/ide-core-common';
import { NodeModule } from '../node-module';
import { CryptrService } from './cryptr.server';
import { CommonServer } from './common.server';
import { CredentialService } from './credential.server';
import { HashCalculateContribution } from '../hash-calculate/hash-calculate.contribution';

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

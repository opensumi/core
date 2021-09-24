import { Injectable } from '@ali/common-di';
import { ICommonServer, CommonServerPath, INativeCredentialService, KeytarServicePath, INativeCryptrService, CryptrServicePath } from '@ali/ide-core-common';
import { NodeModule } from '../node-module';
import { CryptrService } from './cryptr.server';
import { CommonServer } from './common.server';
import { CredentialService } from './credential.server';

@Injectable()
export class ServerCommonModule extends NodeModule {
  providers = [
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

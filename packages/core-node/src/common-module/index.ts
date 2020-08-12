import { Injectable } from '@ali/common-di';
import { ICommonServer, CommonServerPath } from '@ali/ide-core-common';
import { NodeModule } from '../node-module';
import { CommonServer } from './common.server';

@Injectable()
export class ServerCommonModule extends NodeModule {
  providers = [
    {
      token: ICommonServer,
      useClass: CommonServer,
    },
  ];
  backServices = [
    {
      servicePath: CommonServerPath,
      token: ICommonServer,
    },
  ];
}

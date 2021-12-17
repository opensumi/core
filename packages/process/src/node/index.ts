import { Provider, Injectable } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';
import { ProcessManage } from './process-manager';
import { ProcessFactory } from './process';
import { IProcessManage, processManageServicePath, IProcessFactory } from '../common/';

@Injectable()
export class ProcessModule extends NodeModule {
  providers: Provider[] = [
    { token: IProcessManage, useClass: ProcessManage },
    { token: IProcessFactory, useClass: ProcessFactory },
  ];

  backServices = [
    {
      servicePath: processManageServicePath,
      token: IProcessManage,
    },
  ];
}

export * from './process';
export * from './process-manager';

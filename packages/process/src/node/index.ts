import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { ProcessManage, IProcessManage, processManageServicePath  } from './process-manager';
import { ProcessFactory, IProcessFactory } from './process';

export { IProcessFactory, Process } from './process';
export { IProcessManage, processManageServicePath } from './process-manager';

@Injectable()
export class ProcessModule extends NodeModule {
  providers: Provider[] = [
    { token: IProcessManage, useClass: ProcessManage },
    { token: IProcessFactory , useClass: ProcessFactory },
  ];

  backServices = [{
    servicePath: processManageServicePath,
    token: IProcessManage,
  }];
}

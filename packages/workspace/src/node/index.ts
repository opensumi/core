import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { WorkspaceServerPath, IWorkspaceServer } from '../common';
import { WorkspaceBackendServer } from './workspace-backend-service';

@Injectable()
export class WorkspaceModule extends NodeModule {
  providers: Provider[] = [
    {
      token: IWorkspaceServer,
      useClass: WorkspaceBackendServer,
    },
  ];

  backServices = [
    {
      servicePath: WorkspaceServerPath,
      token: IWorkspaceServer,
    },
  ];
}

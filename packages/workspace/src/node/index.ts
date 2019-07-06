import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { workspaceServerPath } from '../common/index';
import { WorkspaceBackendServer } from './workspace-backend-service';

@Injectable()
export class WorkspaceModule extends NodeModule {
  providers: Provider[] = [];

  backServices = [
    {
      servicePath: workspaceServerPath,
      token: WorkspaceBackendServer,
    },
  ];
}

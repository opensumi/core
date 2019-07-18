import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadWorkspace } from '../../common';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { WorkspaceService } from '@ali/ide-workspace/lib/browser/workspace-service';
import { Uri } from '../../common/ext-types';
// import { WorkspaceConfiguration } from '../../common';

@Injectable()
export class MainThreadWorkspace implements IMainThreadWorkspace {
  private readonly proxy: any;

  @Autowired(WorkspaceService)
  workspaceService: WorkspaceService;

  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostWorkspace);
  }

  dispose() {

  }

  $updateWorkspaceFolders() {

  }

  $getWorkspaceFolders() {
    return [];
  }

  // $getConfiguration(section?: string, resource?: Uri | null): WorkspaceConfiguration {
  //   // return this.corePreferences[section]
  // }
}

import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadWorkspace } from '../../common';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { WorkspaceService } from '@ali/ide-workspace/lib/browser/workspace-service';
import { Uri } from '../../common/ext-types';
import { FileStat } from '@ali/ide-file-service';
import { URI } from '@ali/ide-core-browser';
// import { WorkspaceConfiguration } from '../../common';

@Injectable()
export class MainThreadWorkspace implements IMainThreadWorkspace {
  private readonly proxy: any;
  private roots: FileStat[];

  @Autowired(WorkspaceService)
  workspaceService: WorkspaceService;

  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostWorkspace);

    this.processWorkspaceFoldersChanged(this.workspaceService.tryGetRoots());
    this.workspaceService.onWorkspaceChanged((roots) => {
      this.processWorkspaceFoldersChanged(roots);
    });
  }

  private isAnyRootChanged(roots: FileStat[]): boolean {
    if (!this.roots || this.roots.length !== roots.length) {
        return true;
    }

    return this.roots.some((root, index) => root.uri !== roots[index].uri);
  }

  async processWorkspaceFoldersChanged(roots: FileStat[]): Promise<void> {
    console.log('processWorkspaceFoldersChanged', roots);
    if (this.isAnyRootChanged(roots) === false) {
        return;
    }
    this.roots = roots;
    this.proxy.$onWorkspaceFoldersChanged({ roots });

    // workspace变化，更新及初始化storage
  }

  dispose() {

  }

  async $updateWorkspaceFolders(start: number, deleteCount?: number, ...rootsToAdd: string[]): Promise<void> {
    await this.workspaceService.spliceRoots(start, deleteCount, ...rootsToAdd.map((root) => new URI(root)));
  }

}

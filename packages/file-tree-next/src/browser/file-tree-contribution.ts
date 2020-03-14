import { URI, ClientAppContribution, localize } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { Autowired } from '@ali/common-di';
import { FileTreeService } from './file-tree.service';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { ExplorerContainerId } from '@ali/ide-explorer/lib/browser/explorer-contribution';
import { KAITIAN_MUTI_WORKSPACE_EXT, IWorkspaceService, UNTITLED_WORKSPACE } from '@ali/ide-workspace';
import { FileTree } from './file-tree';

export const ExplorerResourceViewId = 'file-explorer';

@Domain(ClientAppContribution)
export class FileTreeContribution implements ClientAppContribution {

  @Autowired(FileTreeService)
  private filetreeService: FileTreeService;

  @Autowired(IMainLayoutService)
  private mainLayoutService: IMainLayoutService;

  @Autowired(IWorkspaceService)
  private workspaceService: IWorkspaceService;

  async onStart() {
    await this.filetreeService.init();
    this.mainLayoutService.collectViewComponent({
      id: ExplorerResourceViewId,
      name: this.getWorkspaceTitle(),
      weight: 3,
      priority: 9,
      collapsed: false,
      component: FileTree,
    }, ExplorerContainerId);
    // 监听工作区变化更新标题
    this.workspaceService.onWorkspaceChanged(() => {
      const handler = this.mainLayoutService.getTabbarHandler(ExplorerContainerId);
      if (handler) {
        handler.updateViewTitle(ExplorerResourceViewId, this.getWorkspaceTitle());
      }
    });
  }

  getWorkspaceTitle() {
    let resourceTitle = localize('file.empty.defaultTitle');
    const workspace = this.workspaceService.workspace;
    if (workspace) {
      const uri = new URI(workspace.uri);
      resourceTitle = uri.displayName;
      if (!workspace.isDirectory &&
        (resourceTitle.endsWith(`.${KAITIAN_MUTI_WORKSPACE_EXT}`))) {
        resourceTitle = resourceTitle.slice(0, resourceTitle.lastIndexOf('.'));
        if (resourceTitle === UNTITLED_WORKSPACE) {
          return localize('file.workspace.defaultTip');
        }
      }
    }
    return resourceTitle;
  }

}

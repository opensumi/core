import { Domain } from '@ali/ide-core-common';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { Autowired } from '@ali/common-di';
import { ExplorerOpenEditorPanel } from './opened-editor-panel.view';
import { ExplorerContainerId } from '@ali/ide-explorer/lib/browser/explorer-contribution';
import { ClientAppContribution } from '@ali/ide-core-browser';

export const ExplorerOpenedEditorViewId = 'file-opened-editor';

@Domain(ClientAppContribution)
export class OpenedEditorContribution implements ClientAppContribution {

  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  onStart() {
    this.mainLayoutService.collectViewComponent({
      id: ExplorerOpenedEditorViewId,
      name: 'OPEN EDITORS',
      weight: 1,
      priority: 3,
      collapsed: true,
      component: ExplorerOpenEditorPanel,
    }, ExplorerContainerId);
  }
}

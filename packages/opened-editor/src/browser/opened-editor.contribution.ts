import { Domain, localize } from '@ali/ide-core-browser';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { Autowired } from '@ali/common-di';
import { ExplorerOpenEditorPanel } from './opened-editor-panel.view';
import { ExplorerContainerId } from '@ali/ide-explorer/lib/browser/explorer-contribution';

export const ExplorerOpenedEditorViewId = 'file-opened-editor';

@Domain(MainLayoutContribution)
export class OpenedEditorContribution implements MainLayoutContribution {

  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  onDidUseConfig() {
    const handler = this.mainLayoutService.getTabbarHandler(ExplorerContainerId);
    if (handler) {
      handler.registerView({
        id: ExplorerOpenedEditorViewId,
        name: localize('open.editors.title'),
        weight: 1,
        collapsed: true,
      }, ExplorerOpenEditorPanel);
    }
  }
}

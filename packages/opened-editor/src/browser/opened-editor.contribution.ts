import { Domain, localize, Command, CommandContribution, CommandRegistry } from '@ali/ide-core-browser';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { Autowired } from '@ali/common-di';
import { ExplorerOpenEditorPanel } from './opened-editor-panel.view';
import { ExplorerContainerId } from '@ali/ide-explorer/lib/browser/explorer-contribution';
import { TabBarToolbarRegistry, TabBarToolbarContribution } from '@ali/ide-core-browser/lib/layout';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { ClientAppContribution } from '@ali/ide-core-browser';

export const ExplorerOpenedEditorViewId = 'file-opened-editor';

export namespace OPEN_EDITORS_COMMANDS {
  const CATEGORY = localize('openeditors');
  export const SAVE_ALL: Command = {
    id: 'open.editors.save.all',
    category: CATEGORY,
    label: '%open.editors.save.all%',
    iconClass: getIcon('save-all'),
  };

  export const CLOSE_ALL: Command = {
    id: 'open.editors.close.all',
    category: CATEGORY,
    label: '%open.editors.close.all%',
    iconClass: getIcon('close-all'),
  };
}

@Domain(ClientAppContribution, TabBarToolbarContribution, CommandContribution)
export class OpenedEditorContribution implements ClientAppContribution, TabBarToolbarContribution, CommandContribution {

  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  @Autowired(WorkbenchEditorService)
  workbenchEditorService: WorkbenchEditorService;

  onStart() {
    this.mainLayoutService.collectViewComponent({
      id: ExplorerOpenedEditorViewId,
      name: 'OPEN EDITORS',
      weight: 1,
      priority: 10,
      collapsed: true,
      component: ExplorerOpenEditorPanel,
    }, ExplorerContainerId);
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(OPEN_EDITORS_COMMANDS.SAVE_ALL, {
      execute: () => {
        this.workbenchEditorService.saveAll();
      },
    });

    commands.registerCommand(OPEN_EDITORS_COMMANDS.CLOSE_ALL, {
      execute: () => {
        this.workbenchEditorService.closeAll();
      },
    });
  }

  registerToolbarItems(registry: TabBarToolbarRegistry) {
    registry.registerItem({
      id: OPEN_EDITORS_COMMANDS.SAVE_ALL.id,
      command: OPEN_EDITORS_COMMANDS.SAVE_ALL.id,
      viewId: ExplorerOpenedEditorViewId,
    });
    registry.registerItem({
      id: OPEN_EDITORS_COMMANDS.CLOSE_ALL.id,
      command: OPEN_EDITORS_COMMANDS.CLOSE_ALL.id,
      viewId: ExplorerOpenedEditorViewId,
    });

  }
}

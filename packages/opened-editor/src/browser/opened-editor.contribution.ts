import { Domain, localize, Command, CommandContribution, CommandRegistry } from '@ali/ide-core-browser';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { Autowired } from '@ali/common-di';
import { ExplorerOpenEditorPanel } from './opened-editor-panel.view';
import { ExplorerContainerId } from '@ali/ide-explorer/lib/browser/explorer-contribution';
import { TabBarToolbarRegistry, TabBarToolbarContribution } from '@ali/ide-activity-panel/lib/browser/tab-bar-toolbar';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import { WorkbenchEditorService } from '@ali/ide-editor';

export const ExplorerOpenedEditorViewId = 'file-opened-editor';

export namespace OPEN_EDITORS_COMMANDS {
  const CATEGORY = localize('openeditors');
  export const SAVE_ALL: Command = {
    id: 'open.editors.save.all',
    category: CATEGORY,
    label: localize('open.editors.save.all'),
    iconClass: getIcon('save-all'),
  };

  export const CLOSE_ALL: Command = {
    id: 'open.editors.close.all',
    category: CATEGORY,
    label: localize('open.editors.close.all'),
    iconClass: getIcon('close-all'),
  };
}

@Domain(MainLayoutContribution, TabBarToolbarContribution, CommandContribution)
export class OpenedEditorContribution implements MainLayoutContribution, TabBarToolbarContribution, CommandContribution {

  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  @Autowired(WorkbenchEditorService)
  workbenchEditorService: WorkbenchEditorService;

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
    iconClass: getIcon('save-all'),
    });
    registry.registerItem({
      id: OPEN_EDITORS_COMMANDS.CLOSE_ALL.id,
      command: OPEN_EDITORS_COMMANDS.CLOSE_ALL.id,
      viewId: ExplorerOpenedEditorViewId,
    });

  }
}

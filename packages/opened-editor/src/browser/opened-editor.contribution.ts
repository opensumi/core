import { Domain, localize, Command, CommandContribution, CommandRegistry, OPEN_EDITORS_COMMANDS, URI, CommandService, FILE_COMMANDS, EDITOR_COMMANDS } from '@ali/ide-core-browser';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { Autowired } from '@ali/common-di';
import { ExplorerOpenEditorPanel } from './opened-editor-panel.view';
import { ExplorerContainerId } from '@ali/ide-explorer/lib/browser/explorer-contribution';
import { ToolbarRegistry, TabBarToolbarContribution } from '@ali/ide-core-browser/lib/layout';
import { getIcon } from '@ali/ide-core-browser';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { ClientAppContribution } from '@ali/ide-core-browser';
import { ExplorerOpenedEditorService } from './explorer-opened-editor.service';
import { NextMenuContribution, IMenuRegistry, MenuId } from '@ali/ide-core-browser/lib/menu/next';

export const ExplorerOpenedEditorViewId = 'file-opened-editor';

@Domain(ClientAppContribution, TabBarToolbarContribution, CommandContribution, NextMenuContribution)
export class OpenedEditorContribution implements ClientAppContribution, TabBarToolbarContribution, CommandContribution, NextMenuContribution {

  @Autowired(IMainLayoutService)
  private readonly mainLayoutService: IMainLayoutService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(ExplorerOpenedEditorService)
  private readonly openEditorService: ExplorerOpenedEditorService;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  onStart() {
    this.mainLayoutService.collectViewComponent({
      id: ExplorerOpenedEditorViewId,
      name: localize('open.editors.title'),
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
        this.openEditorService.clearStatus();
      },
    });

    commands.registerCommand(OPEN_EDITORS_COMMANDS.CLOSE_BY_GROUP_ID, {
      execute: (id) => {
        this.openEditorService.closeByGroupId(id);
      },
    });

    commands.registerCommand(OPEN_EDITORS_COMMANDS.SAVE_BY_GROUP_ID, {
      execute: (id) => {
        this.openEditorService.saveByGroupId(id);
      },
    });

    commands.registerCommand(OPEN_EDITORS_COMMANDS.OPEN, {
      execute: (uri: URI, groupIndex?: number) => {
        this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { groupIndex });
      },
    });

    commands.registerCommand(OPEN_EDITORS_COMMANDS.OPEN_TO_THE_SIDE, {
      execute: (uri: URI, groupIndex?: number) => {
        this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { groupIndex, split: 4 /** right */ });
      },
    });

    commands.registerCommand(OPEN_EDITORS_COMMANDS.COMPARE_SELECTED, {
      execute: (uri: URI) => {
        this.commandService.executeCommand(FILE_COMMANDS.COMPARE_SELECTED.id, '', [uri]);
      },
    });

    commands.registerCommand(OPEN_EDITORS_COMMANDS.COPY_PATH, {
      execute: (uri: URI) => {
        this.commandService.executeCommand(FILE_COMMANDS.COPY_PATH.id, '', [uri]);
      },
    });

    commands.registerCommand(OPEN_EDITORS_COMMANDS.COPY_RELATIVE_PATH, {
      execute: (uri: URI) => {
        this.commandService.executeCommand(FILE_COMMANDS.COPY_RELATIVE_PATH.id, '', [uri]);
      },
    });
  }

  registerToolbarItems(registry: ToolbarRegistry) {
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

  registerNextMenus(menuRegistry: IMenuRegistry): void {
    menuRegistry.registerMenuItem(MenuId.OpenEditorsContext, {
      command: OPEN_EDITORS_COMMANDS.OPEN.id,
      order: 1,
      group: '1_open',
    });

    menuRegistry.registerMenuItem(MenuId.OpenEditorsContext, {
      command: OPEN_EDITORS_COMMANDS.OPEN_TO_THE_SIDE.id,
      order: 2,
      group: '1_open',
    });

    menuRegistry.registerMenuItem(MenuId.OpenEditorsContext, {
      command: OPEN_EDITORS_COMMANDS.COMPARE_SELECTED.id,
      group: '2_operator',
    });

    menuRegistry.registerMenuItem(MenuId.OpenEditorsContext, {
      command: OPEN_EDITORS_COMMANDS.COPY_PATH.id,
      group: '3_path',
    });
    menuRegistry.registerMenuItem(MenuId.OpenEditorsContext, {
      command: OPEN_EDITORS_COMMANDS.COPY_RELATIVE_PATH.id,
      group: '3_path',
    });
  }
}

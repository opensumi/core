import { Autowired } from '@opensumi/di';
import {
  Domain,
  localize,
  CommandContribution,
  CommandRegistry,
  OPEN_EDITORS_COMMANDS,
  CommandService,
  FILE_COMMANDS,
  EDITOR_COMMANDS,
} from '@opensumi/ide-core-browser';
import { ClientAppContribution } from '@opensumi/ide-core-browser';
import { ToolbarRegistry, TabBarToolbarContribution } from '@opensumi/ide-core-browser/lib/layout';
import { MenuContribution, IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { ExplorerContainerId } from '@opensumi/ide-explorer/lib/browser/explorer-contribution';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { ExplorerOpenEditorPanel } from './opened-editor';
import { EditorFile, EditorFileGroup } from './opened-editor-node.define';
import { OpenedEditorModelService } from './services/opened-editor-model.service';

export const ExplorerOpenedEditorViewId = 'file-opened-editor';

@Domain(ClientAppContribution, TabBarToolbarContribution, CommandContribution, MenuContribution)
export class OpenedEditorContribution
  implements ClientAppContribution, TabBarToolbarContribution, CommandContribution, MenuContribution
{
  @Autowired(IMainLayoutService)
  private readonly mainLayoutService: IMainLayoutService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(OpenedEditorModelService)
  private readonly openedEditorModelService: OpenedEditorModelService;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  async onStart() {
    this.mainLayoutService.collectViewComponent(
      {
        id: ExplorerOpenedEditorViewId,
        name: localize('opened.editors.title'),
        weight: 1,
        priority: 10,
        collapsed: true,
        component: ExplorerOpenEditorPanel,
      },
      ExplorerContainerId,
    );
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

    commands.registerCommand(OPEN_EDITORS_COMMANDS.CLOSE_BY_GROUP, {
      execute: (node: EditorFileGroup) => {
        this.openedEditorModelService.closeAllByGroup(node);
      },
    });

    commands.registerCommand(OPEN_EDITORS_COMMANDS.SAVE_BY_GROUP, {
      execute: (node: EditorFileGroup) => {
        this.openedEditorModelService.saveAllByGroup(node);
      },
    });

    commands.registerCommand(OPEN_EDITORS_COMMANDS.CLOSE, {
      execute: async (node: EditorFile) => {
        let group;
        if (node.parent && EditorFileGroup.is(node.parent as EditorFileGroup)) {
          group = (node.parent as EditorFileGroup).group;
        }
        await this.commandService.executeCommand(EDITOR_COMMANDS.CLOSE.id, { group, uri: node.uri });
        // 提前移除节点
        (node.parent as EditorFileGroup).unlinkItem(node);
      },
    });

    commands.registerCommand(OPEN_EDITORS_COMMANDS.OPEN, {
      execute: (node: EditorFile) => {
        let groupIndex = 0;
        if (node.parent && EditorFileGroup.is(node.parent as EditorFileGroup)) {
          groupIndex = (node.parent as EditorFileGroup).group.index;
        }
        this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, node.uri, { groupIndex });
      },
    });

    commands.registerCommand(OPEN_EDITORS_COMMANDS.OPEN_TO_THE_SIDE, {
      execute: (node: EditorFile) => {
        let groupIndex = 0;
        if (node.parent && EditorFileGroup.is(node.parent as EditorFileGroup)) {
          groupIndex = (node.parent as EditorFileGroup).group.index;
        }
        this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, node.uri, {
          groupIndex,
          split: 4 /** right */,
        });
      },
    });

    commands.registerCommand(OPEN_EDITORS_COMMANDS.COMPARE_SELECTED, {
      execute: (node: EditorFile) => {
        this.commandService.executeCommand(FILE_COMMANDS.COMPARE_SELECTED.id, node.uri, [node.uri]);
      },
    });

    commands.registerCommand(OPEN_EDITORS_COMMANDS.COPY_PATH, {
      execute: (node: EditorFile) => {
        this.commandService.executeCommand(FILE_COMMANDS.COPY_PATH.id, node.uri, [node.uri]);
      },
    });

    commands.registerCommand(OPEN_EDITORS_COMMANDS.COPY_RELATIVE_PATH, {
      execute: (node: EditorFile) => {
        this.commandService.executeCommand(FILE_COMMANDS.COPY_RELATIVE_PATH.id, node.uri, [node.uri]);
      },
    });
  }

  registerToolbarItems(registry: ToolbarRegistry) {
    registry.registerItem({
      id: OPEN_EDITORS_COMMANDS.SAVE_ALL.id,
      command: OPEN_EDITORS_COMMANDS.SAVE_ALL.id,
      viewId: ExplorerOpenedEditorViewId,
      label: localize('opened.editors.save.all'),
    });
    registry.registerItem({
      id: OPEN_EDITORS_COMMANDS.CLOSE_ALL.id,
      command: OPEN_EDITORS_COMMANDS.CLOSE_ALL.id,
      viewId: ExplorerOpenedEditorViewId,
      label: localize('opened.editors.close.all'),
    });
  }

  registerMenus(menuRegistry: IMenuRegistry): void {
    menuRegistry.registerMenuItem(MenuId.OpenEditorsContext, {
      command: {
        id: OPEN_EDITORS_COMMANDS.OPEN.id,
        label: localize('opened.editors.open'),
      },
      order: 1,
      group: '1_open',
    });

    menuRegistry.registerMenuItem(MenuId.OpenEditorsContext, {
      command: {
        id: OPEN_EDITORS_COMMANDS.OPEN_TO_THE_SIDE.id,
        label: localize('opened.editors.openToTheSide'),
      },
      order: 2,
      group: '1_open',
    });

    menuRegistry.registerMenuItem(MenuId.OpenEditorsContext, {
      command: {
        id: OPEN_EDITORS_COMMANDS.COMPARE_SELECTED.id,
        label: localize('opened.editors.compare'),
      },
      group: '2_operator',
    });

    menuRegistry.registerMenuItem(MenuId.OpenEditorsContext, {
      command: {
        id: OPEN_EDITORS_COMMANDS.COPY_PATH.id,
        label: localize('opened.editors.copyPath'),
      },
      group: '3_path',
    });
    menuRegistry.registerMenuItem(MenuId.OpenEditorsContext, {
      command: {
        id: OPEN_EDITORS_COMMANDS.COPY_RELATIVE_PATH.id,
        label: localize('opened.editors.copyRelativePath'),
      },
      group: '3_path',
    });
  }
}

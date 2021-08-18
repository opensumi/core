import { CONTEXT_IN_DEBUG_MODE } from './../../../common/constants';
import { MenuContribution } from '@ali/ide-core-browser/lib/menu/next';
import { Autowired } from '@ali/common-di';
import { Domain, CommandContribution, CommandRegistry, TabBarToolbarContribution, localize, ToolbarRegistry, ClientAppContribution } from '@ali/ide-core-browser';
import { DEBUG_COMMANDS } from '../../debug-contribution';
import { DEBUG_WATCH_ID } from '../../../common';
import { DebugWatchModelService } from './debug-watch-tree.model.service';
import { MenuId, IMenuRegistry } from '@ali/ide-core-browser/lib/menu/next';
import { DebugWatchNode } from '../../tree/debug-tree-node.define';

@Domain(ClientAppContribution, MenuContribution, CommandContribution, TabBarToolbarContribution)
export class WatchPanelContribution implements ClientAppContribution, MenuContribution, CommandContribution, TabBarToolbarContribution {

  @Autowired(DebugWatchModelService)
  private readonly debugWatchModelService: DebugWatchModelService;

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(DEBUG_COMMANDS.ADD_WATCHER, {
      execute: () => {
        this.debugWatchModelService.newDebugWatchNodePrompt();
      },
    });
    registry.registerCommand(DEBUG_COMMANDS.COLLAPSE_ALL_WATCHER, {
      execute: () => {
        this.debugWatchModelService.collapsedAll();
      },
    });
    registry.registerCommand(DEBUG_COMMANDS.REMOVE_ALL_WATCHER, {
      execute: () => {
        this.debugWatchModelService.clearAllExpression();
      },
    });
    registry.registerCommand(DEBUG_COMMANDS.REMOVE_WATCHER, {
      execute: (node: DebugWatchNode) => {
        this.debugWatchModelService.removeDebugWatchNode(node);
      },
    });
    registry.registerCommand(DEBUG_COMMANDS.EDIT_WATCHER, {
      execute: (node: DebugWatchNode) => {
        this.debugWatchModelService.renameDebugWatchNodePrompt(node);
      },
    });
    registry.registerCommand(DEBUG_COMMANDS.COPY_WATCHER_VALUE, {
      execute: (node: DebugWatchNode) => {
        this.debugWatchModelService.copyValue(node);
      },
    });
  }

  registerToolbarItems(registry: ToolbarRegistry) {
    /**
     * Watch 面板菜单
     */
    registry.registerItem({
      id: DEBUG_COMMANDS.REMOVE_ALL_WATCHER.id,
      command: DEBUG_COMMANDS.REMOVE_ALL_WATCHER.id,
      viewId: DEBUG_WATCH_ID,
      tooltip: localize('debug.watch.removeAll'),
    });

    registry.registerItem({
      id: DEBUG_COMMANDS.COLLAPSE_ALL_WATCHER.id,
      command: DEBUG_COMMANDS.COLLAPSE_ALL_WATCHER.id,
      viewId: DEBUG_WATCH_ID,
      tooltip: localize('debug.watch.collapseAll'),
      when: CONTEXT_IN_DEBUG_MODE.raw,
    });

    registry.registerItem({
      id: DEBUG_COMMANDS.ADD_WATCHER.id,
      command: DEBUG_COMMANDS.ADD_WATCHER.id,
      viewId: DEBUG_WATCH_ID,
      tooltip: localize('debug.watch.add'),
      when: CONTEXT_IN_DEBUG_MODE.raw,
    });
  }

  registerMenus(registry: IMenuRegistry) {
    registry.registerMenuItem(MenuId.DebugWatchContext, {
      command: {
        id: DEBUG_COMMANDS.ADD_WATCHER.id,
        label: localize('debug.watch.add'),
      },
      when: CONTEXT_IN_DEBUG_MODE.raw,
      group: '0_operator',
    });
    registry.registerMenuItem(MenuId.DebugWatchContext, {
      command: {
        id: DEBUG_COMMANDS.EDIT_WATCHER.id,
        label: localize('debug.watch.edit'),
      },
      group: '0_operator',
    });
    registry.registerMenuItem(MenuId.DebugWatchContext, {
      command: {
        id: DEBUG_COMMANDS.COPY_WATCHER_VALUE.id,
        label: localize('debug.watch.copyValue'),
      },
      when: CONTEXT_IN_DEBUG_MODE.raw,
      group: '0_operator',
    });
    registry.registerMenuItem(MenuId.DebugWatchContext, {
      command: {
        id: DEBUG_COMMANDS.REMOVE_WATCHER.id,
        label: localize('debug.watch.remove'),
      },
      group: '1_operator',
    });
    registry.registerMenuItem(MenuId.DebugWatchContext, {
      command: {
        id: DEBUG_COMMANDS.REMOVE_ALL_WATCHER.id,
        label: localize('debug.watch.removeAll'),
      },
      group: '1_operator',
    });
  }

  onStart() {
    this.debugWatchModelService.load();
  }
}

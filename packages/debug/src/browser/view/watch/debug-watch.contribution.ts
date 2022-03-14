import { Autowired } from '@opensumi/di';
import {
  Domain,
  CommandContribution,
  CommandRegistry,
  TabBarToolbarContribution,
  localize,
  ToolbarRegistry,
  ClientAppContribution,
  KeybindingContribution,
  KeybindingRegistry,
} from '@opensumi/ide-core-browser';
import { MenuContribution } from '@opensumi/ide-core-browser/lib/menu/next';
import { MenuId, IMenuRegistry } from '@opensumi/ide-core-browser/lib/menu/next';

import { DEBUG_WATCH_ID } from '../../../common';
import { DEBUG_COMMANDS } from '../../debug-contribution';
import { DebugWatchNode } from '../../tree/debug-tree-node.define';

import {
  CONTEXT_IN_DEBUG_MODE,
  CONTEXT_WATCH_EXPRESSIONS_FOCUSED,
  CONTEXT_WATCH_ITEM_TYPE,
} from './../../../common/constants';
import { DebugWatchModelService } from './debug-watch-tree.model.service';

@Domain(ClientAppContribution, MenuContribution, CommandContribution, TabBarToolbarContribution, KeybindingContribution)
export class WatchPanelContribution
  implements
    ClientAppContribution,
    MenuContribution,
    CommandContribution,
    TabBarToolbarContribution,
    KeybindingContribution
{
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
      execute: (node: DebugWatchNode | unknown) => {
        if (node instanceof DebugWatchNode) {
          this.debugWatchModelService.removeDebugWatchNode(node);
        }

        const [selectedNode] = this.debugWatchModelService.selectedNodes;
        if (selectedNode instanceof DebugWatchNode) {
          this.debugWatchModelService.removeDebugWatchNode(selectedNode);
        }
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
      order: 10,
      group: '3_modification',
    });
    registry.registerMenuItem(MenuId.DebugWatchContext, {
      command: {
        id: DEBUG_COMMANDS.EDIT_WATCHER.id,
        label: localize('debug.watch.edit'),
      },
      when: CONTEXT_WATCH_ITEM_TYPE.equalsTo('expression'),
      order: 20,
      group: '3_modification',
    });
    registry.registerMenuItem(MenuId.DebugWatchContext, {
      command: {
        id: DEBUG_COMMANDS.COPY_WATCHER_VALUE.id,
        label: localize('debug.watch.copyValue'),
      },
      when: `${CONTEXT_WATCH_ITEM_TYPE.equalsTo('expression')} || ${CONTEXT_WATCH_ITEM_TYPE.equalsTo('variable')} && ${
        CONTEXT_IN_DEBUG_MODE.raw
      }`,
      order: 30,
      enabledWhen: CONTEXT_IN_DEBUG_MODE.raw,
      group: '3_modification',
    });
    registry.registerMenuItem(MenuId.DebugWatchContext, {
      command: {
        id: DEBUG_COMMANDS.REMOVE_WATCHER.id,
        label: localize('debug.watch.remove'),
      },
      when: CONTEXT_WATCH_ITEM_TYPE.equalsTo('expression'),
      order: 10,
      group: 'z_commands',
    });
    registry.registerMenuItem(MenuId.DebugWatchContext, {
      command: {
        id: DEBUG_COMMANDS.REMOVE_ALL_WATCHER.id,
        label: localize('debug.watch.removeAll'),
      },
      order: 20,
      group: 'z_commands',
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry) {
    keybindings.registerKeybinding({
      command: DEBUG_COMMANDS.REMOVE_WATCHER.id,
      keybinding: 'ctrlcmd+backspace',
      when: CONTEXT_WATCH_EXPRESSIONS_FOCUSED.raw,
    });
  }

  onStart() {
    this.debugWatchModelService.load();
  }
}

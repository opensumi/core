import {
  Domain,
  localize,
  ToolbarRegistry,
  ComponentRegistry,
  ComponentContribution,
  TabBarToolbarContribution,
} from '@opensumi/ide-core-browser';

import { TERMINAL_COMMANDS, TerminalContainerId } from '../../common';
import TerminalTabs from '../component/tab.view';
import TerminalView from '../component/terminal.view';

@Domain(ComponentContribution, TabBarToolbarContribution)
export class TerminalRenderContribution implements ComponentContribution, TabBarToolbarContribution {
  static viewId = TerminalContainerId;

  registerToolbarItems(registry: ToolbarRegistry) {
    registry.registerItem({
      id: TERMINAL_COMMANDS.OPEN_SEARCH.id,
      command: TERMINAL_COMMANDS.OPEN_SEARCH.id,
      viewId: TerminalRenderContribution.viewId,
      tooltip: localize('terminal.search'),
    });
    registry.registerItem({
      id: TERMINAL_COMMANDS.CLEAR_CONTENT.id,
      command: TERMINAL_COMMANDS.CLEAR_CONTENT.id,
      viewId: TerminalRenderContribution.viewId,
      tooltip: localize('terminal.menu.clearGroups'),
    });
    registry.registerItem({
      id: TERMINAL_COMMANDS.SPLIT.id,
      command: TERMINAL_COMMANDS.SPLIT.id,
      viewId: TerminalRenderContribution.viewId,
      tooltip: localize('terminal.split'),
    });
    registry.registerItem({
      id: TERMINAL_COMMANDS.REMOVE.id,
      command: TERMINAL_COMMANDS.REMOVE.id,
      viewId: TerminalRenderContribution.viewId,
      tooltip: localize('terminal.remove'),
    });
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register(
      '@opensumi/ide-terminal-next',
      {
        component: TerminalView,
        id: 'ide-terminal-next',
      },
      {
        title: localize('terminal.name'),
        priority: 1,
        activateKeyBinding: 'ctrl+`',
        containerId: TerminalRenderContribution.viewId,
        titleComponent: TerminalTabs,
      },
    );
  }
}

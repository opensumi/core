import { CommandRegistry, SlotLocation, TERMINAL_COMMANDS } from '@opensumi/ide-core-browser';
import { TERMINAL_CONTAINER_ID } from '@opensumi/ide-core-browser/lib/common/container-id';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { TOGGLE_PANEL_COMMAND } from '@opensumi/ide-main-layout/lib/browser/command';

import { AIPanelLayoutService } from './panel-layout.service';

export const TERMINAL_VIEW_COMMAND_ID = `workbench.view.${TERMINAL_CONTAINER_ID}`;
export const TERMINAL_CONTAINER_TOGGLE_COMMAND_ID = `container.toggle.${TERMINAL_CONTAINER_ID}`;

export function registerAgenticWorkbenchRevealCommandInterceptors(
  commands: CommandRegistry,
  panelLayoutService: AIPanelLayoutService,
  mainLayoutService: IMainLayoutService,
): void {
  const revealCollapsedWorkbench = (args: any[]) => {
    if (panelLayoutService.isAgenticWorkbenchVisible() !== false) {
      return args;
    }

    panelLayoutService.revealAgenticWorkbench();
    return args;
  };
  const revealPanelFromCollapsedWorkbench = (args: any[]) => {
    if (args[0] === false || panelLayoutService.isAgenticWorkbenchVisible() !== false) {
      return args;
    }

    panelLayoutService.revealAgenticWorkbench();
    mainLayoutService.toggleSlot(SlotLocation.panel, true, args[1]);
    return false;
  };
  const revealTerminalFromCollapsedWorkbench = (args: any[]) => {
    if (panelLayoutService.isAgenticWorkbenchVisible() !== false) {
      return args;
    }

    panelLayoutService.revealAgenticWorkbench();
    mainLayoutService.getTabbarHandler(TERMINAL_CONTAINER_ID)?.activate();
    return false;
  };

  commands.beforeExecuteCommand(TOGGLE_PANEL_COMMAND.id, revealPanelFromCollapsedWorkbench);
  commands.beforeExecuteCommand(TERMINAL_CONTAINER_TOGGLE_COMMAND_ID, revealTerminalFromCollapsedWorkbench);
  commands.beforeExecuteCommand(TERMINAL_VIEW_COMMAND_ID, revealTerminalFromCollapsedWorkbench);
  commands.beforeExecuteCommand(TERMINAL_COMMANDS.TOGGLE_TERMINAL.id, revealTerminalFromCollapsedWorkbench);
  commands.beforeExecuteCommand(TERMINAL_COMMANDS.ADD.id, revealCollapsedWorkbench);
}

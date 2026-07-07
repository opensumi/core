import { SlotLocation, TERMINAL_COMMANDS } from '@opensumi/ide-core-browser';
import { TERMINAL_CONTAINER_ID } from '@opensumi/ide-core-browser/lib/common/container-id';
import { TOGGLE_PANEL_COMMAND } from '@opensumi/ide-main-layout/lib/browser/command';

import { registerAgenticWorkbenchRevealCommandInterceptors } from '../../src/browser/layout/agentic-workbench-command-reveal';

describe('Agentic workbench command reveal', () => {
  const registerInterceptors = (agenticWorkbenchVisible: boolean | undefined) => {
    const terminalHandler = {
      activate: jest.fn(),
    };
    const panelLayoutService = {
      isAgenticWorkbenchVisible: jest.fn(() => agenticWorkbenchVisible),
      revealAgenticWorkbench: jest.fn(() => true),
    };
    const mainLayoutService = {
      getTabbarHandler: jest.fn(() => terminalHandler),
      toggleSlot: jest.fn(),
    };
    const interceptors = new Map<string, (args: any[]) => any[] | boolean>();
    const commands = {
      beforeExecuteCommand: jest.fn((commandId: string, interceptor: (args: any[]) => any[] | boolean) => {
        interceptors.set(commandId, interceptor);
        return { dispose: jest.fn() };
      }),
    };

    registerAgenticWorkbenchRevealCommandInterceptors(
      commands as any,
      panelLayoutService as any,
      mainLayoutService as any,
    );

    return {
      commands,
      interceptors,
      mainLayoutService,
      panelLayoutService,
      terminalHandler,
    };
  };

  it('should not reveal the workbench outside collapsed Agentic Layout', () => {
    const { interceptors, mainLayoutService, panelLayoutService } = registerInterceptors(undefined);
    const args = [undefined, 320];

    expect(interceptors.get(TOGGLE_PANEL_COMMAND.id)?.(args)).toBe(args);
    expect(panelLayoutService.revealAgenticWorkbench).not.toHaveBeenCalled();
    expect(mainLayoutService.toggleSlot).not.toHaveBeenCalled();
  });

  it('should reveal and force-show the bottom panel from collapsed Agentic Layout', () => {
    const { interceptors, mainLayoutService, panelLayoutService } = registerInterceptors(false);

    expect(interceptors.get(TOGGLE_PANEL_COMMAND.id)?.([undefined, 320])).toBe(false);
    expect(panelLayoutService.revealAgenticWorkbench).toHaveBeenCalledTimes(1);
    expect(mainLayoutService.toggleSlot).toHaveBeenCalledWith(SlotLocation.panel, true, 320);
  });

  it('should respect explicit panel hide requests from collapsed Agentic Layout', () => {
    const { interceptors, mainLayoutService, panelLayoutService } = registerInterceptors(false);
    const args = [false];

    expect(interceptors.get(TOGGLE_PANEL_COMMAND.id)?.(args)).toBe(args);
    expect(panelLayoutService.revealAgenticWorkbench).not.toHaveBeenCalled();
    expect(mainLayoutService.toggleSlot).not.toHaveBeenCalled();
  });

  it('should reveal and force-activate terminal toggle targets from collapsed Agentic Layout', () => {
    const { interceptors, mainLayoutService, panelLayoutService, terminalHandler } = registerInterceptors(false);

    expect(interceptors.get(`container.toggle.${TERMINAL_CONTAINER_ID}`)?.([])).toBe(false);
    expect(panelLayoutService.revealAgenticWorkbench).toHaveBeenCalledTimes(1);
    expect(mainLayoutService.getTabbarHandler).toHaveBeenCalledWith(TERMINAL_CONTAINER_ID);
    expect(terminalHandler.activate).toHaveBeenCalledTimes(1);
  });

  it('should reveal and continue terminal creation from collapsed Agentic Layout', () => {
    const { interceptors, mainLayoutService, panelLayoutService } = registerInterceptors(false);
    const args: any[] = [];

    expect(interceptors.get(TERMINAL_COMMANDS.ADD.id)?.(args)).toBe(args);
    expect(panelLayoutService.revealAgenticWorkbench).toHaveBeenCalledTimes(1);
    expect(mainLayoutService.getTabbarHandler).not.toHaveBeenCalled();
  });
});

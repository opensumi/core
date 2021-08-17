import { CONTEXT_IN_DEBUG_REPL, CONTEXT_IN_DEBUG_MODE } from './../../../common/constants';
import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, ComponentContribution, ComponentRegistry, getIcon, localize, TabBarToolbarContribution, ToolbarRegistry, KeybindingContribution, KeybindingRegistry, IContextKeyService } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { DEBUG_CONSOLE_CONTAINER_ID } from '../../../common';
import { DebugConsoleView } from './debug-console.view';
import { DebugConsoleInputDocumentProvider, DebugConsoleService } from './debug-console.service';
import { BrowserEditorContribution, IEditorDocumentModelContentRegistry } from '@ali/ide-editor/lib/browser';
import { DebugConsoleFilterView } from './debug-console-filter.view';
import { DEBUG_COMMANDS } from '../../debug-contribution';
import { DebugConsoleModelService } from './debug-console-tree.model.service';
import { IMenuRegistry, MenuContribution, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { DebugConsoleNode } from '../../tree';

export const DEBUG_CONSOLE_VIEW_ID = 'debug-console-view';

@Domain(ComponentContribution, BrowserEditorContribution, TabBarToolbarContribution, CommandContribution, MenuContribution, KeybindingContribution)
export class DebugConsoleContribution implements ComponentContribution, BrowserEditorContribution, TabBarToolbarContribution, CommandContribution, MenuContribution, KeybindingContribution {

  @Autowired()
  private readonly debugConsoleModelService: DebugConsoleModelService;

  @Autowired()
  private debugConsoleInputDocumentProvider: DebugConsoleInputDocumentProvider;

  @Autowired(IContextKeyService)
  protected readonly contextKeyService: IContextKeyService;

  @Autowired(DebugConsoleService)
  protected readonly debugConsoleService: DebugConsoleService;

  registerComponent(registry: ComponentRegistry) {
    registry.register('debug-console', {
      id: DEBUG_CONSOLE_VIEW_ID,
      component: DebugConsoleView,
    }, {
      title: localize('debug.console.panel.title'),
      priority: 8,
      containerId: DEBUG_CONSOLE_CONTAINER_ID,
      iconClass: getIcon('debug'),
      titleComponent: DebugConsoleFilterView,
    });
  }

  registerToolbarItems(registry: ToolbarRegistry) {
    registry.registerItem({
      id: DEBUG_COMMANDS.CLEAR_CONSOLE.id,
      command: DEBUG_COMMANDS.CLEAR_CONSOLE.id,
      iconClass: getIcon('clear'),
      viewId: DEBUG_CONSOLE_CONTAINER_ID,
      tooltip: DEBUG_COMMANDS.CLEAR_CONSOLE.label,
    });
  }

  registerEditorDocumentModelContentProvider(registry: IEditorDocumentModelContentRegistry) {
    registry.registerEditorDocumentModelContentProvider(this.debugConsoleInputDocumentProvider);
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(DEBUG_COMMANDS.CLEAR_CONSOLE, {
      execute: () => {
        this.debugConsoleModelService.clear();
      },
    });
    registry.registerCommand(DEBUG_COMMANDS.COPY_CONSOLE_ITEM, {
      execute: (node: DebugConsoleNode) => {
        this.debugConsoleModelService.copy(node);
      },
    });
    registry.registerCommand(DEBUG_COMMANDS.COPY_CONSOLE_ALL, {
      execute: () => {
        this.debugConsoleModelService.copyAll();
      },
    });
    registry.registerCommand(DEBUG_COMMANDS.COLLAPSE_ALL_CONSOLE_ITEM, {
      execute: () => {
        this.debugConsoleModelService.collapseAll();
      },
    });
    registry.registerCommand(DEBUG_COMMANDS.CONSOLE_ENTER_EVALUATE, {
      execute: () => {
        this.debugConsoleService.runExecute();
      },
    });
    registry.registerCommand(DEBUG_COMMANDS.CONSOLE_INPUT_DOWN_ARROW, {
      execute: () => {
        this.debugConsoleService.showNextValue();
      },
    });
    registry.registerCommand(DEBUG_COMMANDS.CONSOLE_INPUT_UP_ARROW, {
      execute: () => {
        this.debugConsoleService.showPreviousValue();
      },
    });
  }

  registerMenus(registry: IMenuRegistry): void {
    registry.registerMenuItem(MenuId.DebugConsoleContext, {
      command: {
        id: DEBUG_COMMANDS.COPY_CONSOLE_ITEM.id,
        label: localize('debug.console.copy'),
      },
      group: 'copy',
    });
    registry.registerMenuItem(MenuId.DebugConsoleContext, {
      command: {
        id: DEBUG_COMMANDS.COPY_CONSOLE_ALL.id,
        label: localize('debug.console.copyAll'),
      },
      group: 'copy',
    });
    registry.registerMenuItem(MenuId.DebugConsoleContext, {
      command: {
        id: DEBUG_COMMANDS.CLEAR_CONSOLE.id,
        label: localize('debug.console.clear'),
      },
      group: 'other',
    });
    registry.registerMenuItem(MenuId.DebugConsoleContext, {
      command: {
        id: DEBUG_COMMANDS.COLLAPSE_ALL_CONSOLE_ITEM.id,
        label: localize('debug.console.collapseAll'),
      },
      group: 'other',
    });
  }

  registerKeybindings(bindings: KeybindingRegistry) {
    bindings.registerKeybinding({
      command: DEBUG_COMMANDS.CONSOLE_ENTER_EVALUATE.id,
      keybinding: 'enter',
      when: `${CONTEXT_IN_DEBUG_REPL.raw} && ${CONTEXT_IN_DEBUG_MODE.raw}`,
    });
    bindings.registerKeybinding({
      command: DEBUG_COMMANDS.CONSOLE_INPUT_DOWN_ARROW.id,
      keybinding: 'down',
      when: `${CONTEXT_IN_DEBUG_REPL.raw} && ${CONTEXT_IN_DEBUG_MODE.raw}`,
    });
    bindings.registerKeybinding({
      command: DEBUG_COMMANDS.CONSOLE_INPUT_UP_ARROW.id,
      keybinding: 'up',
      when: `${CONTEXT_IN_DEBUG_REPL.raw} && ${CONTEXT_IN_DEBUG_MODE.raw}`,
    });
  }
}

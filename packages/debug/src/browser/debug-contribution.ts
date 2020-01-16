import { Domain, ClientAppContribution, isElectronRenderer, localize, CommandContribution, CommandRegistry, KeybindingContribution, JsonSchemaContribution, ISchemaRegistry, PreferenceSchema, PreferenceContribution, IContextKeyService } from '@ali/ide-core-browser';
import { ComponentContribution, ComponentRegistry, Command } from '@ali/ide-core-browser';
import { DebugBreakpointView } from './view/debug-breakpoints.view';
import { DebugStackFrameView } from './view/debug-stack-frames.view';
import { DebugVariableView } from './view/debug-variable.view';
import { DebubgConfigurationView } from './view/debug-configuration.view';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { Autowired } from '@ali/common-di';
import { DebugModelManager } from './editor/debug-model-manager';
import { BreakpointManager, SelectedBreakpoint } from './breakpoint';
import { DebugConfigurationManager } from './debug-configuration-manager';
import { launchSchema } from './debug-schema-updater';
import { DebugWatchView } from './view/debug-watch.view';

import { getIcon } from '@ali/ide-core-browser';
import { ToolbarRegistry, TabBarToolbarContribution } from '@ali/ide-core-browser/lib/layout';
import { DebugWatchService } from './view/debug-watch.service';
import { DebugBreakpointsService } from './view/debug-breakpoints.service';
import { DebugConfigurationService } from './view/debug-configuration.service';
import { DebugViewModel } from './view/debug-view-model';
import { DebugSession } from './debug-session';
import { DebugSessionManager } from './debug-session-manager';
import { DebugPreferences, debugPreferencesSchema } from './debug-preferences';
import { IDebugSessionManager, launchSchemaUri } from '../common';
import { DebugConsoleService } from './view/debug-console.service';
import { IStatusBarService } from '@ali/ide-status-bar';
import { DebugToolbarService } from './view/debug-toolbar.service';
import { NextMenuContribution, MenuId, IMenuRegistry } from '@ali/ide-core-browser/lib/menu/next';
import { BrowserEditorContribution, IEditorFeatureRegistry } from '@ali/ide-editor/lib/browser';
import { EditorHoverContribution } from './editor/editor-hover-contribution';

export namespace DEBUG_COMMANDS {
  export const ADD_WATCHER = {
    id: 'debug.watch.add.handler',
    iconClass: getIcon('plus'),
  };
  export const COLLAPSE_ALL_WATCHER = {
    id: 'debug.watch.collapse.handler',
    iconClass: getIcon('collapse-all'),
  };
  export const REMOVE_ALL_WATCHER = {
    id: 'debug.watch.close.handler',
    iconClass: getIcon('close-all'),
  };
  export const REMOVE_ALL_BREAKPOINTS = {
    id: 'debug.breakpoints.remove.all',
    iconClass: getIcon('close-all'),
  };
  export const TOGGLE_BREAKPOINTS = {
    id: 'debug.breakpoints.toggle',
    iconClass: getIcon('toggle-breakpoints'),
  };
  export const START = {
    id: 'debug.start',
  };
  export const NEXT = {
    id: 'debug.next',
  };
  export const PREV = {
    id: 'debug.prev',
  };
  export const OVER = {
    id: 'debug.over',
  };
  export const STOP = {
    id: 'debug.stop',
  };
  export const CONTINUE = {
    id: 'debug.continue',
  };
  export const RESTART = {
    id: 'debug.restart',
  };
  // menu commands
  export const DELETE_BREAKPOINT = {
    id: 'debug.delete.breakpoint',
    label: localize('debug.menu.delete.breakpoint'),
  };
  export const EDIT_BREAKPOINT = {
    id: 'debug.edit.breakpoint',
    label: localize('debug.menu.edit.breakpoint'),
  };
  export const DISABLE_BREAKPOINT = {
    id: 'debug.disable.breakpoint',
    label: localize('debug.menu.disable.breakpoint'),
  };
  export const ENABLE_BREAKPOINT = {
    id: 'debug.enable.breakpoint',
    label: localize('debug.menu.enable.breakpoint'),
  };
  export const ENABLE_LOGPOINT = {
    id: 'debug.enable.logpoint',
    label: localize('debug.menu.enable.logpoint'),
  };
  export const ADD_BREAKPOINT = {
    id: 'debug.add.breakpoint',
    label: localize('debug.menu.add.breakpoint'),
  };
  export const ADD_LOGPOINT = {
    id: 'debug.add.logpoint',
    label: localize('debug.menu.add.logpoint'),
  };
  export const ADD_CONDITIONAL_BREAKPOINT = {
    id: 'debug.add.conditional',
    label: localize('debug.menu.add.conditional'),
  };
}

export namespace DebugBreakpointWidgetCommands {
  export const ACCEPT = {
    id: 'debug.breakpointWidget.accept',
  };
  export const CLOSE = {
    id: 'debug.breakpointWidget.close',
  };
}

@Domain(ClientAppContribution, ComponentContribution, TabBarToolbarContribution, CommandContribution, KeybindingContribution, JsonSchemaContribution, PreferenceContribution, NextMenuContribution, BrowserEditorContribution)
export class DebugContribution implements ComponentContribution, TabBarToolbarContribution, CommandContribution, KeybindingContribution, JsonSchemaContribution, PreferenceContribution, NextMenuContribution, BrowserEditorContribution {

  static DEBUG_THREAD_ID: string = 'debug-thread';
  static DEBUG_WATCH_ID: string = 'debug-watch';
  static DEBUG_VARIABLES_ID: string = 'debug-variable';
  static DEBUG_BREAKPOINTS_ID: string = 'debug-breakpoints';
  static DEBUG_STACK_ID: string = 'debug-stack';
  static DEBUG_CONTAINER_ID: string = 'debug';
  static DEBUG_CONSOLE_CONTAINER_ID: string = 'debug-console-constainer';

  schema: PreferenceSchema = debugPreferencesSchema;

  @Autowired(IMainLayoutService)
  protected readonly mainlayoutService: IMainLayoutService;

  @Autowired(BreakpointManager)
  protected readonly breakpointManager: BreakpointManager;

  @Autowired(DebugConfigurationManager)
  protected readonly configurations: DebugConfigurationManager;

  @Autowired(DebugModelManager)
  protected debugEditorController: DebugModelManager;

  @Autowired(DebugWatchService)
  protected debugWatchService: DebugWatchService;

  @Autowired(DebugBreakpointsService)
  protected debugBreakpointsService: DebugBreakpointsService;

  @Autowired(DebugViewModel)
  protected readonly debugModel: DebugViewModel;

  @Autowired(DebugPreferences)
  protected readonly preferences: DebugPreferences;

  @Autowired(DebugConsoleService)
  protected readonly debugConsole: DebugConsoleService;

  @Autowired(DebugConfigurationService)
  protected readonly debugConfigurationService: DebugConfigurationService;

  @Autowired(IDebugSessionManager)
  protected readonly sessionManager: DebugSessionManager;

  @Autowired(IStatusBarService)
  protected readonly statusBar: IStatusBarService;

  @Autowired(DebugToolbarService)
  protected readonly debugToolbarService: DebugToolbarService;

  @Autowired()
  private editorHoverContribution: EditorHoverContribution;

  private firstSessionStart: boolean = true;

  get selectedBreakpoint(): SelectedBreakpoint | undefined {
    const { selectedBreakpoint } = this.breakpointManager;
    return selectedBreakpoint;
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-debug', [
      {
        component: DebugWatchView,
        id: DebugContribution.DEBUG_WATCH_ID,
        name: localize('debug.watch.title'),
        collapsed: false,
      },
      {
        component: DebugStackFrameView,
        id: DebugContribution.DEBUG_STACK_ID,
        name: localize('debug.callStack.title'),
        collapsed: false,
      },
      {
        component: DebugVariableView,
        id: DebugContribution.DEBUG_VARIABLES_ID,
        name: localize('debug.variables.title'),
        collapsed: false,
      },
      {
        component: DebugBreakpointView,
        id: DebugContribution.DEBUG_BREAKPOINTS_ID,
        name: localize('debug.breakpoints.title'),
        collapsed: false,
      },
    ], {
      iconClass: getIcon('debug'),
      priority: 7,
      title: localize('debug.container.title'),
      containerId: DebugContribution.DEBUG_CONTAINER_ID,
      titleComponent: DebubgConfigurationView,
      activateKeyBinding: 'ctrlcmd+shift+d',
    });
  }

  async onStart() {
    this.sessionManager.onDidCreateDebugSession((session: DebugSession) => {
      this.debugModel.init(session);
    });
    this.sessionManager.onDidStartDebugSession((session: DebugSession) => {
      const { noDebug, internalConsole } = session.configuration;
      const openDebug = session.configuration.openDebug || this.preferences['debug.openDebug'];
      if (!noDebug && (openDebug === 'openOnSessionStart' || (openDebug === 'openOnFirstSessionStart' && this.firstSessionStart && (internalConsole === 'internalConsole' || !internalConsole)))) {
        this.openView();
        this.debugModel.init(session);
      }
      this.firstSessionStart = false;
      this.statusBar.setBackgroundColor('var(--statusBar-debuggingBackground)');
      this.statusBar.setColor('var(--statusBar-debuggingForeground)');
    });
    this.sessionManager.onDidStopDebugSession((session) => {
      const { openDebug } = session.configuration;
      if (openDebug === 'openOnDebugBreak') {
        this.openView();
      }
    });
    this.sessionManager.onDidDestroyDebugSession((session) => {
      if (this.sessionManager.sessions.length === 0) {
        this.statusBar.setBackgroundColor('var(--statusBar-background)');
        this.statusBar.setColor('var(--statusBar-foreground)');
      }
    });
    this.debugEditorController.init();
    await this.configurations.load();
    await this.breakpointManager.load();
    this.configurations.onDidChange(() => {
      this.configurations.save();
    });
    this.breakpointManager.onDidChangeBreakpoints(() => {
      this.breakpointManager.save();
    });
    this.debugWatchService.onDidChange(() => {
      this.debugWatchService.save();
    });
  }

  openView() {
    const handler = this.mainlayoutService.getTabbarHandler(DebugContribution.DEBUG_CONTAINER_ID);
    if (handler && !handler.isVisible) {
      handler.activate();
    }
    if (!this.debugConsole.isVisible) {
      this.debugConsole.activate();
    }
  }

  onDidRender() {
    const handler = this.mainlayoutService.getTabbarHandler(DebugContribution.DEBUG_CONTAINER_ID);
    if (handler) {
      handler!.setTitleComponent(DebubgConfigurationView);
    }
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(DEBUG_COMMANDS.ADD_WATCHER, {
      execute: () => {
        this.debugWatchService.addWatchHandler();
      },
      isVisible: () => {
        const handler = this.mainlayoutService.getTabbarHandler(DebugContribution.DEBUG_CONTAINER_ID);
        return handler ? handler.isVisible : false;
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.COLLAPSE_ALL_WATCHER, {
      execute: (data) => {
        this.debugWatchService.collapseAll();
      },
      isVisible: () => {
        const handler = this.mainlayoutService.getTabbarHandler(DebugContribution.DEBUG_CONTAINER_ID);
        return handler ? handler.isVisible : false;
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.REMOVE_ALL_WATCHER, {
      execute: (data) => {
        this.debugWatchService.removeAll();
      },
      isVisible: () => {
        const handler = this.mainlayoutService.getTabbarHandler(DebugContribution.DEBUG_CONTAINER_ID);
        return handler ? handler.isVisible : false;
      },
    });

    commands.registerCommand(DEBUG_COMMANDS.REMOVE_ALL_BREAKPOINTS, {
      execute: (data) => {
        this.debugBreakpointsService.removeAllBreakpoints();
      },
      isVisible: () => {
        const handler = this.mainlayoutService.getTabbarHandler(DebugContribution.DEBUG_CONTAINER_ID);
        return handler ? handler.isVisible : false;
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.START, {
      execute: (data) => {
        this.debugConfigurationService.start();
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.STOP, {
      execute: (data) => {
        this.debugToolbarService.doStop();
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.NEXT, {
      execute: (data) => {
        this.debugToolbarService.doStepIn();
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.PREV, {
      execute: (data) => {
        this.debugToolbarService.doStepOut();
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.CONTINUE, {
      execute: (data) => {
        this.debugToolbarService.doContinue();
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.OVER, {
      execute: (data) => {
        this.debugToolbarService.doStepOver();
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.RESTART, {
      execute: (data) => {
        this.debugToolbarService.doRestart();
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.TOGGLE_BREAKPOINTS, {
      execute: (data) => {
        this.debugBreakpointsService.toggleBreakpoints();
      },
      isVisible: () => {
        const handler = this.mainlayoutService.getTabbarHandler(DebugContribution.DEBUG_CONTAINER_ID);
        return handler ? handler.isVisible : false;
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.EDIT_BREAKPOINT, {
      execute: async (position: monaco.Position) => {
        const { selectedBreakpoint } = this;
        if (selectedBreakpoint) {
          const { openBreakpointView } = selectedBreakpoint.model;
          openBreakpointView(position, selectedBreakpoint.breakpoint && selectedBreakpoint.breakpoint.raw);
        }
      },
      isVisible: () => !!this.selectedBreakpoint && !!this.selectedBreakpoint.breakpoint,
      isEnabled: () => !!this.selectedBreakpoint && !!this.selectedBreakpoint.breakpoint,
    });
    commands.registerCommand(DEBUG_COMMANDS.DISABLE_BREAKPOINT, {
      execute: async (position: monaco.Position) => {
        const { selectedBreakpoint } = this;
        if (selectedBreakpoint) {
          const { uri } = selectedBreakpoint.model;
          const breakpoint = this.sessionManager.getBreakpoint(uri, position.lineNumber);
          if (breakpoint) {
            breakpoint.setEnabled(false);
          }
        }
      },
      isVisible: () => !!this.selectedBreakpoint && !!this.selectedBreakpoint.breakpoint && this.selectedBreakpoint.breakpoint.enabled,
      isEnabled: () => !!this.selectedBreakpoint && !!this.selectedBreakpoint.breakpoint && this.selectedBreakpoint.breakpoint.enabled,
    });
    commands.registerCommand(DEBUG_COMMANDS.ENABLE_BREAKPOINT, {
      execute: async (position: monaco.Position) => {
        const { selectedBreakpoint } = this;
        if (selectedBreakpoint) {
          const { uri } = selectedBreakpoint.model;
          const breakpoint = this.sessionManager.getBreakpoint(uri, position.lineNumber);
          if (breakpoint) {
            breakpoint.setEnabled(true);
          }
        }
      },
      isVisible: () => !!this.selectedBreakpoint && !!this.selectedBreakpoint.breakpoint && !this.selectedBreakpoint.breakpoint.enabled,
      isEnabled: () => !!this.selectedBreakpoint && !!this.selectedBreakpoint.breakpoint && !this.selectedBreakpoint.breakpoint.enabled,
    });
    commands.registerCommand(DEBUG_COMMANDS.DELETE_BREAKPOINT, {
      execute: async (position: monaco.Position) => {
        const { selectedBreakpoint } = this;
        if (selectedBreakpoint) {
          const { uri } = selectedBreakpoint.model;
          const breakpoint = this.sessionManager.getBreakpoint(uri, position.lineNumber);
          if (breakpoint) {
            breakpoint.remove();
          }
        }
      },
      isVisible: () => !!this.selectedBreakpoint && !!this.selectedBreakpoint.breakpoint,
      isEnabled: () => !!this.selectedBreakpoint && !!this.selectedBreakpoint.breakpoint,
    });

    commands.registerCommand(DEBUG_COMMANDS.ADD_CONDITIONAL_BREAKPOINT, {
      execute: async (position: monaco.Position) => {
        const { selectedBreakpoint } = this;
        if (selectedBreakpoint) {
          const { uri, openBreakpointView, toggleBreakpoint } = selectedBreakpoint.model;
          toggleBreakpoint(position);
          const breakpoint = this.breakpointManager.getBreakpoint(uri, position!.lineNumber);
          // 更新当前右键选中的断点
          if (breakpoint) {
            this.breakpointManager.selectedBreakpoint = {
              breakpoint,
              model: selectedBreakpoint.model,
            };
          }
          openBreakpointView(position, selectedBreakpoint.breakpoint && selectedBreakpoint.breakpoint.raw, 'condition');
        }
      },
      isVisible: () => !!this.selectedBreakpoint && !this.selectedBreakpoint.breakpoint,
      isEnabled: () => !!this.selectedBreakpoint && !this.selectedBreakpoint.breakpoint,
    });
    commands.registerCommand(DEBUG_COMMANDS.ADD_LOGPOINT, {
      execute: async (position: monaco.Position) => {
        const { selectedBreakpoint } = this;
        if (selectedBreakpoint) {
          const { openBreakpointView, toggleBreakpoint, uri } = selectedBreakpoint.model;
          toggleBreakpoint(position);
          const breakpoint = this.breakpointManager.getBreakpoint(uri, position!.lineNumber);
          // 更新当前右键选中的断点
          if (breakpoint) {
            this.breakpointManager.selectedBreakpoint = {
              breakpoint,
              model: selectedBreakpoint.model,
            };
          }
          openBreakpointView(position, selectedBreakpoint.breakpoint && selectedBreakpoint.breakpoint.raw, 'logMessage');
        }
      },
      isVisible: () => !!this.selectedBreakpoint && !this.selectedBreakpoint.breakpoint,
      isEnabled: () => !!this.selectedBreakpoint && !this.selectedBreakpoint.breakpoint,
    });
    commands.registerCommand(DEBUG_COMMANDS.ADD_BREAKPOINT, {
      execute: async (position: monaco.Position) => {
        const { selectedBreakpoint } = this;
        if (selectedBreakpoint) {
          const { toggleBreakpoint } = selectedBreakpoint.model;
          toggleBreakpoint(position);
        }
      },
      isVisible: () => !!this.selectedBreakpoint && !this.selectedBreakpoint.breakpoint,
      isEnabled: () => !!this.selectedBreakpoint && !this.selectedBreakpoint.breakpoint,
    });

    commands.registerCommand(DebugBreakpointWidgetCommands.ACCEPT, {
      execute: () => {
        const { selectedBreakpoint } = this;
        if (selectedBreakpoint) {
          const { acceptBreakpoint } = selectedBreakpoint.model;
          acceptBreakpoint();
        }
      },
      isVisible: () => !!this.selectedBreakpoint && !!this.selectedBreakpoint.breakpoint,
      isEnabled: () => !!this.selectedBreakpoint && !!this.selectedBreakpoint.breakpoint,
    });
    commands.registerCommand(DebugBreakpointWidgetCommands.CLOSE, {
      execute: () => {
        const { selectedBreakpoint } = this;
        if (selectedBreakpoint) {
          const { closeBreakpointView } = selectedBreakpoint.model;
          closeBreakpointView();
        }
      },
      isVisible: () => !!this.selectedBreakpoint && !!this.selectedBreakpoint.breakpoint,
      isEnabled: () => !!this.selectedBreakpoint && !!this.selectedBreakpoint.breakpoint,
    });
  }

  registerToolbarItems(registry: ToolbarRegistry) {
    // Watch 面板菜单
    registry.registerItem({
      id: DEBUG_COMMANDS.REMOVE_ALL_WATCHER.id,
      command: DEBUG_COMMANDS.REMOVE_ALL_WATCHER.id,
      viewId: DebugContribution.DEBUG_WATCH_ID,
      tooltip: localize('debug.watch.removeAll'),
    });

    registry.registerItem({
      id: DEBUG_COMMANDS.COLLAPSE_ALL_WATCHER.id,
      command: DEBUG_COMMANDS.COLLAPSE_ALL_WATCHER.id,
      viewId: DebugContribution.DEBUG_WATCH_ID,
      tooltip: localize('debug.watch.collapseAll'),
    });

    registry.registerItem({
      id: DEBUG_COMMANDS.ADD_WATCHER.id,
      command: DEBUG_COMMANDS.ADD_WATCHER.id,
      viewId: DebugContribution.DEBUG_WATCH_ID,
      tooltip: localize('debug.watch.add'),
    });

    registry.registerItem({
      id: DEBUG_COMMANDS.REMOVE_ALL_BREAKPOINTS.id,
      command: DEBUG_COMMANDS.REMOVE_ALL_BREAKPOINTS.id,
      viewId: DebugContribution.DEBUG_BREAKPOINTS_ID,
      tooltip: localize('debug.breakpoint.removeAll'),
    });

    registry.registerItem({
      id: DEBUG_COMMANDS.TOGGLE_BREAKPOINTS.id,
      command: DEBUG_COMMANDS.TOGGLE_BREAKPOINTS.id,
      viewId: DebugContribution.DEBUG_BREAKPOINTS_ID,
      tooltip: localize('debug.breakpoint.toggle'),
    });

  }

  registerSchema(registry: ISchemaRegistry) {
    registry.registerSchema(`${launchSchemaUri}/default`, launchSchema, ['launch.json']);
  }

  registerKeybindings(keybindings) {
    keybindings.registerKeybinding({
      command: DEBUG_COMMANDS.START.id,
      keybinding: 'f5',
      when: '!inDebugMode',
    });
    keybindings.registerKeybinding({
      command: DEBUG_COMMANDS.CONTINUE.id,
      keybinding: 'f5',
      when: 'inDebugMode',
    });
    keybindings.registerKeybinding({
      command: DEBUG_COMMANDS.STOP.id,
      keybinding: 'shift+f5',
      when: 'inDebugMode',
    });
    keybindings.registerKeybinding({
      command: DEBUG_COMMANDS.NEXT.id,
      keybinding: 'f11',
      when: 'inDebugMode',
    });
    keybindings.registerKeybinding({
      command: DEBUG_COMMANDS.PREV.id,
      keybinding: 'shift+f11',
      when: 'inDebugMode',
    });
    keybindings.registerKeybinding({
      command: DEBUG_COMMANDS.OVER.id,
      keybinding: 'f10',
      when: 'inDebugMode',
    });
    keybindings.registerKeybinding({
      command: DEBUG_COMMANDS.RESTART.id,
      keybinding: 'shift+ctrlcmd+f5',
      when: 'inDebugMode',
    });

    keybindings.registerKeybinding({
      command: DebugBreakpointWidgetCommands.ACCEPT.id,
      keybinding: 'enter',
      when: 'breakpointWidgetInputFocus',
    });
    keybindings.registerKeybinding({
      command: DebugBreakpointWidgetCommands.CLOSE.id,
      keybinding: 'esc',
      when: 'breakpointWidgetInputFocus',
    });
  }

  registerNextMenus(menuRegistry: IMenuRegistry) {
    menuRegistry.registerMenuItem(MenuId.DebugBreakpointsContext, {
      command: DEBUG_COMMANDS.DELETE_BREAKPOINT.id,
      group: '1_has_breakpoint',
      order: 1,
    });
    menuRegistry.registerMenuItem(MenuId.DebugBreakpointsContext, {
      command: DEBUG_COMMANDS.EDIT_BREAKPOINT.id,
      group: '1_has_breakpoint',
      order: 2,
    });
    menuRegistry.registerMenuItem(MenuId.DebugBreakpointsContext, {
      command: DEBUG_COMMANDS.DISABLE_BREAKPOINT.id,
      group: '1_has_breakpoint',
      order: 3,
    });
    menuRegistry.registerMenuItem(MenuId.DebugBreakpointsContext, {
      command: DEBUG_COMMANDS.ENABLE_BREAKPOINT.id,
      group: '1_has_breakpoint',
      order: 4,
    });

    menuRegistry.registerMenuItem(MenuId.DebugBreakpointsContext, {
      command: DEBUG_COMMANDS.ADD_BREAKPOINT.id,
      group: '2_has_not_breakpoint',
    });
    menuRegistry.registerMenuItem(MenuId.DebugBreakpointsContext, {
      command: DEBUG_COMMANDS.ADD_CONDITIONAL_BREAKPOINT.id,
      group: '2_has_not_breakpoint',
    });
    menuRegistry.registerMenuItem(MenuId.DebugBreakpointsContext, {
      command: DEBUG_COMMANDS.ADD_LOGPOINT.id,
      group: '2_has_not_breakpoint',
    });
  }

  protected isPosition(position: monaco.Position): boolean {
    return (position instanceof monaco.Position);
  }

  registerEditorFeature(registry: IEditorFeatureRegistry) {
    registry.registerEditorFeatureContribution(this.editorHoverContribution);
  }
}

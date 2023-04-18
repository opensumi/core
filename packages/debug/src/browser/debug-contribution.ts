import { Injector, Autowired, INJECTOR_TOKEN } from '@opensumi/di';
import {
  Domain,
  ClientAppContribution,
  localize,
  CommandContribution,
  CommandRegistry,
  KeybindingContribution,
  JsonSchemaContribution,
  IJSONSchemaRegistry,
  PreferenceSchema,
  PreferenceContribution,
  CommandService,
  IReporterService,
  formatLocalize,
  CoreConfiguration,
  ComponentContribution,
  ComponentRegistry,
  KeybindingRegistry,
  getIcon,
  PreferenceService,
  IPreferenceSettingsService,
  COMMON_COMMANDS,
} from '@opensumi/ide-core-browser';
import { browserViews } from '@opensumi/ide-core-browser/lib/extensions/schema/browserViews';
import { ToolbarRegistry, TabBarToolbarContribution } from '@opensumi/ide-core-browser/lib/layout';
import { MenuContribution, MenuId, IMenuRegistry } from '@opensumi/ide-core-browser/lib/menu/next';
import { IExtensionsSchemaService, runWhenIdle, URI } from '@opensumi/ide-core-common';
import {
  BrowserEditorContribution,
  IEditorFeatureRegistry,
  EditorComponentRegistry,
  IEditor,
} from '@opensumi/ide-editor/lib/browser';
import { IFileServiceClient, IShadowFileProvider } from '@opensumi/ide-file-service';
import { FileServiceClient } from '@opensumi/ide-file-service/lib/browser/file-service-client';
import { IMainLayoutService, IViewsRegistry } from '@opensumi/ide-main-layout';
import { WelcomeView } from '@opensumi/ide-main-layout/lib/browser/welcome.view';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import {
  IDebugSessionManager,
  launchSchemaUri,
  DEBUG_CONTAINER_ID,
  DEBUG_WATCH_ID,
  DEBUG_VARIABLES_ID,
  DEBUG_STACK_ID,
  DEBUG_BREAKPOINTS_ID,
  DEBUG_FLOATING_CLICK_WIDGET,
  DEBUG_REPORT_NAME,
  DEBUG_WELCOME_ID,
  DEBUG_SCHEME,
  TSourceBrekpointProperties,
  DEBUG_COMMANDS,
  IDebugModelManager,
} from '../common';

import {
  CONTEXT_DEBUGGERS_AVAILABLE,
  CONTEXT_IN_DEBUG_MODE,
  CONTEXT_BREAKPOINT_INPUT_FOCUSED,
  CONTEXT_EXCEPTION_WIDGET_VISIBLE,
} from './../common/constants';
import { BreakpointManager, SelectedBreakpoint } from './breakpoint';
import { FloatingClickWidget } from './components/floating-click-widget';
import { DebugContextKey } from './contextkeys/debug-contextkey.service';
import { DebugConfigurationManager } from './debug-configuration-manager';
import { DebugPreferences, debugPreferencesSchema } from './debug-preferences';
import { DebugProgressService } from './debug-progress.service';
import { launchSchema } from './debug-schema-updater';
import { DebugSession } from './debug-session';
import { DebugSessionManager } from './debug-session-manager';
import { DebugEditorContribution } from './editor/debug-editor-contribution';
import { DebugRunToCursorService } from './editor/debug-run-to-cursor.service';
import { DebugBreakpointsService } from './view/breakpoints/debug-breakpoints.service';
import { DebugBreakpointView } from './view/breakpoints/debug-breakpoints.view';
import { DebugConfigurationService } from './view/configuration/debug-configuration.service';
import { DebugConfigurationContainerView } from './view/configuration/debug-configuration.view';
import { DebugToolbarService } from './view/configuration/debug-toolbar.service';
import { DebugConsoleService } from './view/console/debug-console.service';
import { DebugViewModel } from './view/debug-view-model';
import { DebugCallStackView } from './view/frames/debug-call-stack.view';
import { DebugVariableView } from './view/variables/debug-variables.view';
import { DebugWatchView } from './view/watch/debug-watch.view';

const LAUNCH_JSON_REGEX = /launch\.json$/;

export namespace DebugBreakpointWidgetCommands {
  export const ACCEPT = {
    id: 'debug.breakpointWidget.accept',
  };
  export const CLOSE = {
    id: 'debug.breakpointWidget.close',
  };
}

@Domain(
  ClientAppContribution,
  ComponentContribution,
  TabBarToolbarContribution,
  CommandContribution,
  KeybindingContribution,
  JsonSchemaContribution,
  PreferenceContribution,
  MenuContribution,
  BrowserEditorContribution,
)
export class DebugContribution
  implements
    ComponentContribution,
    TabBarToolbarContribution,
    CommandContribution,
    KeybindingContribution,
    JsonSchemaContribution,
    PreferenceContribution,
    MenuContribution,
    BrowserEditorContribution
{
  schema: PreferenceSchema = debugPreferencesSchema;

  @Autowired(IMainLayoutService)
  protected readonly mainlayoutService: IMainLayoutService;

  @Autowired(BreakpointManager)
  protected readonly breakpointManager: BreakpointManager;

  @Autowired(DebugConfigurationManager)
  protected readonly configurations: DebugConfigurationManager;

  @Autowired(IDebugModelManager)
  protected debugEditorController: IDebugModelManager;

  @Autowired(DebugBreakpointsService)
  protected debugBreakpointsService: DebugBreakpointsService;

  @Autowired(DebugViewModel)
  protected readonly debugModel: DebugViewModel;

  @Autowired(DebugPreferences)
  protected readonly debugPreferences: DebugPreferences;

  @Autowired(DebugConsoleService)
  protected readonly debugConsole: DebugConsoleService;

  @Autowired(DebugConfigurationService)
  protected readonly debugConfigurationService: DebugConfigurationService;

  @Autowired(IDebugSessionManager)
  protected readonly sessionManager: DebugSessionManager;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @Autowired(DebugToolbarService)
  protected readonly debugToolbarService: DebugToolbarService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(PreferenceService)
  protected readonly preferences: PreferenceService;

  @Autowired(IReporterService)
  private readonly reporterService: IReporterService;

  @Autowired(IViewsRegistry)
  private viewsRegistry: IViewsRegistry;

  @Autowired(IShadowFileProvider)
  private shadowFileServiceProvider: IShadowFileProvider;

  @Autowired(IFileServiceClient)
  protected readonly fileSystem: FileServiceClient;

  @Autowired(IPreferenceSettingsService)
  protected readonly preferenceSettings: IPreferenceSettingsService;

  @Autowired(DebugProgressService)
  protected readonly debugProgressService: DebugProgressService;

  @Autowired(DebugRunToCursorService)
  protected readonly debugRunToCursorService: DebugRunToCursorService;

  @Autowired(DebugContextKey)
  protected readonly debugContextKey: DebugContextKey;

  @Autowired(IExtensionsSchemaService)
  protected readonly extensionsPointService: IExtensionsSchemaService;

  private firstSessionStart = true;
  private openedViewSessions = new Set();

  get selectedBreakpoint(): SelectedBreakpoint | undefined {
    const { selectedBreakpoint } = this.breakpointManager;
    return selectedBreakpoint;
  }

  registerEditorComponent(registry: EditorComponentRegistry) {
    registry.registerEditorSideWidget({
      id: DEBUG_FLOATING_CLICK_WIDGET,
      component: FloatingClickWidget as any,
      displaysOnResource: (r) => {
        const { configUri } = this.preferences.resolve('launch');
        if (!configUri) {
          return false;
        }
        return configUri.isEqual(r.uri) && LAUNCH_JSON_REGEX.test(r.uri.toString());
      },
    });
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register(
      '@opensumi/ide-debug',
      [
        {
          component: DebugWatchView,
          id: DEBUG_WATCH_ID,
          name: localize('debug.watch.title'),
          when: `${CONTEXT_DEBUGGERS_AVAILABLE.equalsTo(true)} || ${CONTEXT_IN_DEBUG_MODE.equalsTo(true)}`,
          collapsed: false,
        },
        {
          component: DebugCallStackView,
          id: DEBUG_STACK_ID,
          name: localize('debug.callStack.title'),
          when: `${CONTEXT_DEBUGGERS_AVAILABLE.equalsTo(true)} || ${CONTEXT_IN_DEBUG_MODE.equalsTo(true)}`,
          collapsed: false,
        },
        {
          component: DebugVariableView,
          id: DEBUG_VARIABLES_ID,
          name: localize('debug.variables.title'),
          when: `${CONTEXT_DEBUGGERS_AVAILABLE.equalsTo(true)} || ${CONTEXT_IN_DEBUG_MODE.equalsTo(true)}`,
          collapsed: false,
        },
        {
          component: DebugBreakpointView,
          id: DEBUG_BREAKPOINTS_ID,
          name: localize('debug.breakpoints.title'),
          when: `${CONTEXT_DEBUGGERS_AVAILABLE.equalsTo(true)} || ${CONTEXT_IN_DEBUG_MODE.equalsTo(true)}`,
          collapsed: false,
        },
        {
          component: WelcomeView,
          id: DEBUG_WELCOME_ID,
          name: 'Debug Welcome',
          when: `${CONTEXT_DEBUGGERS_AVAILABLE.equalsTo(false)} && ${CONTEXT_IN_DEBUG_MODE.equalsTo(false)}`,
          initialProps: { viewId: DEBUG_WELCOME_ID },
        },
      ],
      {
        iconClass: getIcon('debug'),
        priority: 7,
        title: localize('debug.container.title'),
        containerId: DEBUG_CONTAINER_ID,
        titleComponent: DebugConfigurationContainerView,
        activateKeyBinding: 'ctrlcmd+shift+d',
      },
    );
  }

  async initialize() {
    this.fileSystem.registerProvider(DEBUG_SCHEME, this.shadowFileServiceProvider);
    this.debugEditorController.init();
    this.debugProgressService.run(this.sessionManager);
  }

  onStart() {
    this.viewsRegistry.registerViewWelcomeContent(DEBUG_WELCOME_ID, {
      content: formatLocalize('welcome-view.noLaunchJson', DEBUG_COMMANDS.START.id),
      when: 'default',
    });
    this.sessionManager.onDidCreateDebugSession((session: DebugSession) => {
      this.debugModel.init(session);
    });
    this.sessionManager.onDidStartDebugSession((session: DebugSession) => {
      const { internalConsoleOptions } = session.configuration;
      const openDebug = session.configuration.openDebug || this.debugPreferences['debug.openDebug'];
      if (openDebug === 'openOnSessionStart' || openDebug === 'openOnFirstSessionStart') {
        if (this.firstSessionStart) {
          this.openDebugView();
        }
      } else if (openDebug !== 'neverOpen') {
        const parentSession = session.parentSession;
        const sessionId = parentSession?.id || session.id;
        if (!this.openedViewSessions.has(sessionId)) {
          this.openedViewSessions.add(sessionId);
          this.openDebugView();
        }
      }

      if (
        internalConsoleOptions === 'openOnSessionStart' ||
        (internalConsoleOptions === 'openOnFirstSessionStart' && this.firstSessionStart)
      ) {
        this.openDebugConsoleView();
      }
      this.firstSessionStart = false;
      this.commandService.tryExecuteCommand('statusbar.changeBackgroundColor', 'var(--statusBar-debuggingBackground)');
      this.commandService.tryExecuteCommand('statusbar.changeColor', 'var(--statusBar-debuggingForeground)');
    });
    this.sessionManager.onDidStopDebugSession((session) => {
      const { openDebug } = session.configuration;
      if (openDebug === 'openOnDebugBreak') {
        this.openDebugView();
      }
    });
    this.sessionManager.onDidDestroyDebugSession(() => {
      if (this.sessionManager.sessions.length === 0) {
        this.commandService.tryExecuteCommand('statusbar.changeBackgroundColor', 'var(--statusBar-background)');
        this.commandService.tryExecuteCommand('statusbar.changeColor');
      }
    });
    this.configurations.whenReady.then(() => {
      this.configurations.load();
      this.configurations.onDidChange(() => this.configurations.save());
    });
    this.breakpointManager.load().then(() => {
      this.breakpointManager.onDidChangeBreakpoints(() => this.breakpointManager.save());
      this.breakpointManager.onDidChangeExceptionsBreakpoints(() => this.breakpointManager.save());
      this.breakpointManager.onDidChangeMarkers(() => this.breakpointManager.save());
    });
    this.extensionsPointService.appendExtensionPoint(['browserViews', 'properties'], {
      extensionPoint: DEBUG_CONTAINER_ID,
      frameworkKind: ['opensumi'],
      jsonSchema: {
        ...browserViews.properties,
        description: formatLocalize('sumiContributes.browserViews.location.custom', localize('menu-bar.title.debug')),
      },
    });
  }

  // 左侧调试面板
  openDebugView() {
    const handler = this.mainlayoutService.getTabbarHandler(DEBUG_CONTAINER_ID);
    if (handler && !handler.isVisible) {
      handler.activate();
    }
  }

  // 底部调试控制台面板
  openDebugConsoleView() {
    if (!this.debugConsole.isVisible) {
      this.debugConsole.activate();
    }
  }

  onDidRender() {
    const handler = this.mainlayoutService.getTabbarHandler(DEBUG_CONTAINER_ID);
    if (handler) {
      handler!.setTitleComponent(DebugConfigurationContainerView);
    }
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(COMMON_COMMANDS.OPEN_LAUNCH_CONFIGURATION, {
      execute: () => {
        this.debugConfigurationService.openConfiguration();
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.REMOVE_ALL_BREAKPOINTS, {
      execute: () => {
        this.debugBreakpointsService.removeAllBreakpoints();
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.START, {
      execute: () => {
        this.debugConfigurationService.start();
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.STOP, {
      execute: () => {
        this.debugToolbarService.doStop();
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.NEXT, {
      execute: () => {
        this.debugToolbarService.doStepIn();
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.PREV, {
      execute: () => {
        this.debugToolbarService.doStepOut();
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.CONTINUE, {
      execute: () => {
        this.debugToolbarService.doContinue();
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.PAUSE, {
      execute: () => {
        this.debugToolbarService.doPause();
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.OVER, {
      execute: () => {
        this.debugToolbarService.doStepOver();
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.RESTART, {
      execute: () => {
        this.debugToolbarService.doRestart();
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.TOGGLE_BREAKPOINTS, {
      execute: () => {
        this.debugBreakpointsService.toggleBreakpoints();
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.EDIT_BREAKPOINT, {
      execute: async (position: monaco.Position) => {
        this.reporterService.point(DEBUG_REPORT_NAME?.DEBUG_BREAKPOINT, 'edit');
        const { selectedBreakpoint } = this;
        if (selectedBreakpoint) {
          const { openBreakpointView } = selectedBreakpoint.model;
          let defaultContext: TSourceBrekpointProperties = 'condition';
          if (selectedBreakpoint.breakpoint) {
            const raw = selectedBreakpoint.breakpoint.raw;
            if (raw.condition) {
              defaultContext = 'condition';
            } else if (raw.hitCondition) {
              defaultContext = 'hitCondition';
            } else if (raw.logMessage) {
              defaultContext = 'logMessage';
            }
          }
          openBreakpointView(
            position,
            selectedBreakpoint.breakpoint && selectedBreakpoint.breakpoint.raw,
            defaultContext,
          );
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
          const breakpoint = this.breakpointManager.getBreakpoint(uri, position.lineNumber);
          if (breakpoint) {
            breakpoint.enabled = false;
            this.breakpointManager.updateBreakpoint(breakpoint);
          }
        }
      },
      isVisible: () =>
        !!this.selectedBreakpoint && !!this.selectedBreakpoint.breakpoint && this.selectedBreakpoint.breakpoint.enabled,
      isEnabled: () =>
        !!this.selectedBreakpoint && !!this.selectedBreakpoint.breakpoint && this.selectedBreakpoint.breakpoint.enabled,
    });
    commands.registerCommand(DEBUG_COMMANDS.ENABLE_BREAKPOINT, {
      execute: async (position: monaco.Position) => {
        const { selectedBreakpoint } = this;
        if (selectedBreakpoint) {
          const { uri } = selectedBreakpoint.model;
          const breakpoint = this.breakpointManager.getBreakpoint(uri, position.lineNumber);
          if (breakpoint) {
            breakpoint.enabled = true;
            this.breakpointManager.updateBreakpoint(breakpoint);
          }
        }
      },
      isVisible: () =>
        !!this.selectedBreakpoint &&
        !!this.selectedBreakpoint.breakpoint &&
        !this.selectedBreakpoint.breakpoint.enabled,
      isEnabled: () =>
        !!this.selectedBreakpoint &&
        !!this.selectedBreakpoint.breakpoint &&
        !this.selectedBreakpoint.breakpoint.enabled,
    });
    commands.registerCommand(DEBUG_COMMANDS.DELETE_BREAKPOINT, {
      execute: async (position: monaco.Position) => {
        const { selectedBreakpoint } = this;
        if (selectedBreakpoint) {
          const { uri } = selectedBreakpoint.model;
          const breakpoint = this.breakpointManager.getBreakpoint(uri, position.lineNumber);
          if (breakpoint) {
            this.breakpointManager.delBreakpoint(breakpoint);
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
          openBreakpointView(
            position,
            selectedBreakpoint.breakpoint && selectedBreakpoint.breakpoint.raw,
            'logMessage',
          );
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
    commands.registerCommand(DEBUG_COMMANDS.RUN_TO_CURSOR, {
      execute: (uri: URI) => {
        this.debugRunToCursorService.run(uri);
      },
      isEnabled: () => this.debugContextKey.contextDebugState.get() === 'Stopped',
    });
    commands.registerCommand(DEBUG_COMMANDS.FORCE_RUN_TO_CURSOR, {
      execute: (uri: URI) => {
        this.debugRunToCursorService.run(uri, true);
      },
      isEnabled: () => this.debugContextKey.contextDebugState.get() === 'Stopped',
    });
  }

  registerToolbarItems(registry: ToolbarRegistry) {
    /**
     * end
     */

    /**
     * 断点面板菜单
     */
    registry.registerItem({
      id: DEBUG_COMMANDS.REMOVE_ALL_BREAKPOINTS.id,
      command: DEBUG_COMMANDS.REMOVE_ALL_BREAKPOINTS.id,
      iconClass: getIcon('close-all'),
      viewId: DEBUG_BREAKPOINTS_ID,
      tooltip: localize('debug.breakpoint.removeAll'),
    });

    registry.registerItem({
      id: DEBUG_COMMANDS.TOGGLE_BREAKPOINTS.id,
      command: DEBUG_COMMANDS.TOGGLE_BREAKPOINTS.id,
      iconClass: getIcon('deactivate-breakpoints'),
      viewId: DEBUG_BREAKPOINTS_ID,
      tooltip: localize('debug.breakpoint.toggle'),
    });
    /**
     * end
     */
  }

  registerSchema(registry: IJSONSchemaRegistry) {
    registry.registerSchema(`${launchSchemaUri}/default`, launchSchema, ['launch.json']);
  }

  registerKeybindings(keybindings: KeybindingRegistry) {
    keybindings.registerKeybinding({
      command: DEBUG_COMMANDS.START.id,
      keybinding: 'f5',
      when: `!${CONTEXT_IN_DEBUG_MODE.raw}`,
    });
    keybindings.registerKeybinding({
      command: DEBUG_COMMANDS.CONTINUE.id,
      keybinding: 'f5',
      when: CONTEXT_IN_DEBUG_MODE.raw,
    });
    keybindings.registerKeybinding({
      command: DEBUG_COMMANDS.STOP.id,
      keybinding: 'shift+f5',
      when: CONTEXT_IN_DEBUG_MODE.raw,
    });
    keybindings.registerKeybinding({
      command: DEBUG_COMMANDS.NEXT.id,
      keybinding: 'f11',
      when: CONTEXT_IN_DEBUG_MODE.raw,
    });
    keybindings.registerKeybinding({
      command: DEBUG_COMMANDS.PREV.id,
      keybinding: 'shift+f11',
      when: CONTEXT_IN_DEBUG_MODE.raw,
    });
    keybindings.registerKeybinding({
      command: DEBUG_COMMANDS.OVER.id,
      keybinding: 'f10',
      when: CONTEXT_IN_DEBUG_MODE.raw,
    });
    keybindings.registerKeybinding({
      command: DEBUG_COMMANDS.RESTART.id,
      keybinding: 'shift+ctrlcmd+f5',
      when: CONTEXT_IN_DEBUG_MODE.raw,
    });

    keybindings.registerKeybinding({
      command: DebugBreakpointWidgetCommands.ACCEPT.id,
      keybinding: 'enter',
      when: CONTEXT_BREAKPOINT_INPUT_FOCUSED.raw,
    });
    keybindings.registerKeybinding({
      command: DebugBreakpointWidgetCommands.CLOSE.id,
      keybinding: 'esc',
      when: CONTEXT_BREAKPOINT_INPUT_FOCUSED.raw,
    });
    keybindings.registerKeybinding({
      command: DEBUG_COMMANDS.EXCEPTION_WIDGET_CLOSE.id,
      keybinding: 'esc',
      when: CONTEXT_EXCEPTION_WIDGET_VISIBLE.raw,
    });
  }

  registerMenus(menuRegistry: IMenuRegistry) {
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

    // editor/context
    menuRegistry.registerMenuItem(MenuId.EditorContext, {
      command: {
        id: DEBUG_COMMANDS.RUN_TO_CURSOR.id,
        label: DEBUG_COMMANDS.RUN_TO_CURSOR.label || '',
      },
      when: `${CONTEXT_IN_DEBUG_MODE.raw}`,
      group: 'debug',
      order: 2,
    });
    menuRegistry.registerMenuItem(MenuId.EditorContext, {
      command: {
        id: DEBUG_COMMANDS.FORCE_RUN_TO_CURSOR.id,
        label: DEBUG_COMMANDS.FORCE_RUN_TO_CURSOR.label || '',
      },
      when: `${CONTEXT_IN_DEBUG_MODE.raw}`,
      group: 'debug',
      order: 2,
    });

    menuRegistry.registerMenuItem(MenuId.EditorTitle, {
      submenu: MenuId.EditorTitleRun,
      label: localize('debug.menu.title.run'),
      iconClass: getIcon('start'),
      group: 'navigation',
      order: -1,
    });
  }

  protected isPosition(position: monaco.Position): boolean {
    return position instanceof monaco.Position;
  }

  registerEditorFeature(registry: IEditorFeatureRegistry) {
    let debugEditorContribution: DebugEditorContribution;

    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) => {
        debugEditorContribution = this.injector.get(DebugEditorContribution, [editor]);
        return debugEditorContribution.contribute(editor);
      },
    });
    runWhenIdle(() => {
      debugEditorContribution?.registerDecorationType();
    });
    this.preferenceSettings.setEnumLabels(
      'debug.console.filter.mode' as keyof CoreConfiguration,
      {
        filter: localize('preference.debug.console.filter.mode.filter'),
        matcher: localize('preference.debug.console.filter.mode.matcher'),
      } as { [key in CoreConfiguration['debug.console.filter.mode']]: string },
    );
  }
}

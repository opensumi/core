import { Domain, ClientAppContribution, isElectronRenderer, localize, CommandContribution, CommandRegistry, JsonSchemaContribution } from '@ali/ide-core-browser';
import { ComponentContribution, ComponentRegistry, Command } from '@ali/ide-core-browser';
import { DebugThreadView } from './view/debug-threads.view';
import { DebugBreakpointView } from './view/debug-breakpoints.view';
import { DebugStackFrameView } from './view/debug-stack-frames.view';
import { DebugVariableView } from './view/debug-variable.view';
import { DebubgConfigurationView } from './view/debug-configuration.view';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { Autowired } from '@ali/common-di';
import { DebugModelManager } from './editor/debug-model-manager';
import { BreakpointManager } from './breakpoint';
import { DebugConfigurationManager } from './debug-configuration-manager';
import { DebugSchemaUpdater, launchSchemaId, launchSchema } from './debug-schema-updater';
import { DebugWatchView } from './view/debug-watch.view';

import { getIcon } from '@ali/ide-core-browser/lib/icon';
import { TabBarToolbarRegistry, TabBarToolbarContribution } from '@ali/ide-activity-panel/lib/browser/tab-bar-toolbar';
import { DebugWatchService } from './view/debug-watch.service';
import { DebugBreakpointsService } from './view/debug-breakpoints.service';
import { JSONContributionRegistry as JSONSchemaRegistry } from '@ali/ide-monaco/lib/browser/schema-registry';

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
}

@Domain(ClientAppContribution, ComponentContribution, MainLayoutContribution, TabBarToolbarContribution, CommandContribution, JsonSchemaContribution)
export class DebugContribution implements ComponentContribution, MainLayoutContribution, TabBarToolbarContribution, CommandContribution, JsonSchemaContribution {

  static DEBUG_THREAD_ID: string = 'debug-thread';
  static DEBUG_WATCH_ID: string = 'debug-watch';
  static DEBUG_VARIABLES_ID: string = 'debug-variable';
  static DEBUG_BREAKPOINTS_ID: string = 'debug-breakpoints';
  static DEBUG_STACK_ID: string = 'debug-stack';
  static DEBUG_CONTAINER_ID: string = 'debug';

  @Autowired(IMainLayoutService)
  protected readonly mainlayoutService: IMainLayoutService;

  @Autowired(BreakpointManager)
  protected readonly breakpointManager: BreakpointManager;

  @Autowired(DebugConfigurationManager)
  protected readonly configurations: DebugConfigurationManager;

  @Autowired(DebugSchemaUpdater)
  protected readonly debugSchemaUpdater: DebugSchemaUpdater;

  @Autowired(DebugModelManager)
  protected debugEditorController: DebugModelManager;

  @Autowired(DebugWatchService)
  protected debugWatchService: DebugWatchService;

  @Autowired(DebugBreakpointsService)
  protected debugBreakpointsService: DebugBreakpointsService;

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-debug', [
      {
        component: DebugThreadView,
        id: DebugContribution.DEBUG_THREAD_ID,
        name: localize('debug.threads.title'),
        collapsed: false,
      },
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
    });
  }

  async onStart() {
    this.debugEditorController.init();
    if (!isElectronRenderer()) {
      this.debugSchemaUpdater.update();
      this.configurations.load();
      await this.breakpointManager.load();
    }
  }

  onStop(): void {
    this.configurations.save();
    this.breakpointManager.save();
    this.debugWatchService.save();
  }

  onDidUseConfig() {
    const handler = this.mainlayoutService.getTabbarHandler(DebugContribution.DEBUG_CONTAINER_ID);
    if (handler) {
      handler!.setTitleComponent(DebubgConfigurationView, 85);
    }
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(DEBUG_COMMANDS.ADD_WATCHER, {
      execute: () => {
        this.debugWatchService.addWatchHandler();
      },
      isVisible: () => {
        const handler = this.mainlayoutService.getTabbarHandler(DebugContribution.DEBUG_CONTAINER_ID);
        return handler && handler.isVisible;
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.COLLAPSE_ALL_WATCHER, {
      execute: (data) => {
        this.debugWatchService.collapseAll();
      },
      isVisible: () => {
        const handler = this.mainlayoutService.getTabbarHandler(DebugContribution.DEBUG_CONTAINER_ID);
        return handler && handler.isVisible;
      },
    });
    commands.registerCommand(DEBUG_COMMANDS.REMOVE_ALL_WATCHER, {
      execute: (data) => {
        this.debugWatchService.removeAll();
      },
      isVisible: () => {
        const handler = this.mainlayoutService.getTabbarHandler(DebugContribution.DEBUG_CONTAINER_ID);
        return handler && handler.isVisible;
      },
    });

    commands.registerCommand(DEBUG_COMMANDS.REMOVE_ALL_BREAKPOINTS, {
      execute: (data) => {
        this.debugBreakpointsService.removeAllBreakpoints();
      },
      isVisible: () => {
        const handler = this.mainlayoutService.getTabbarHandler(DebugContribution.DEBUG_CONTAINER_ID);
        return handler && handler.isVisible;
      },
    });
  }

  registerToolbarItems(registry: TabBarToolbarRegistry) {
    // Watch 面板菜单
    registry.registerItem({
      id: DEBUG_COMMANDS.REMOVE_ALL_WATCHER.id,
      command: DEBUG_COMMANDS.REMOVE_ALL_WATCHER.id,
      viewId: DebugContribution.DEBUG_WATCH_ID,
    });

    registry.registerItem({
      id: DEBUG_COMMANDS.COLLAPSE_ALL_WATCHER.id,
      command: DEBUG_COMMANDS.COLLAPSE_ALL_WATCHER.id,
      viewId: DebugContribution.DEBUG_WATCH_ID,
    });

    registry.registerItem({
      id: DEBUG_COMMANDS.ADD_WATCHER.id,
      command: DEBUG_COMMANDS.ADD_WATCHER.id,
      viewId: DebugContribution.DEBUG_WATCH_ID,
    });

    registry.registerItem({
      id: DEBUG_COMMANDS.REMOVE_ALL_BREAKPOINTS.id,
      command: DEBUG_COMMANDS.REMOVE_ALL_BREAKPOINTS.id,
      viewId: DebugContribution.DEBUG_BREAKPOINTS_ID,
    });
  }

  registerSchema(registry: JSONSchemaRegistry) {
    registry.registerSchema(launchSchemaId, launchSchema);
  }
}

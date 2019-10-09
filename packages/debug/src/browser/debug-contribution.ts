import { Domain, ClientAppContribution, isElectronRenderer, localize } from '@ali/ide-core-browser';
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
import { DebugSchemaUpdater } from './debug-schema-updater';
import { DebugWatchView } from './view/debug-watch.view';

import { getIcon } from '@ali/ide-core-browser/lib/icon';

const DEBUG_SETTING_COMMAND: Command = {
  id: 'debug.setting',
  iconClass: getIcon('setting'),
};

@Domain(ClientAppContribution, ComponentContribution, MainLayoutContribution)
export class DebugContribution implements ComponentContribution, MainLayoutContribution {

  @Autowired(IMainLayoutService)
  protected readonly mainlayoutService: IMainLayoutService;

  @Autowired(BreakpointManager)
  protected readonly breakpointManager: BreakpointManager;

  @Autowired(DebugConfigurationManager)
  protected readonly configurations: DebugConfigurationManager;

  @Autowired(DebugSchemaUpdater)
  protected readonly debugSchemaUpdater: DebugSchemaUpdater;

  @Autowired()
  protected debugEditorController: DebugModelManager;

  containerId: string = 'debug';

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-debug', [
      {
        component: DebugThreadView,
        id: 'debug-thread',
        name: localize('debug.threads.title'),
        collapsed: false,
      },
      {
        component: DebugWatchView,
        id: 'debug-watch',
        name: localize('debug.watch.title'),
        collapsed: false,
      },
      {
        component: DebugStackFrameView,
        id: 'debug-stack-frame',
        name: localize('debug.callStack.title'),
        collapsed: false,
      },
      {
        component: DebugVariableView,
        id: 'debug-variable',
        name: localize('debug.variables.title'),
        collapsed: false,
      },
      {
        component: DebugBreakpointView,
        id: 'debug-breakpoints',
        name: localize('debug.breakpoints.title'),
        collapsed: false,
      },
    ], {
      iconClass: getIcon('debug'),
      priority: 7,
      title: 'DEBUG',
      containerId: this.containerId,
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
  }

  onDidUseConfig() {
    const handler = this.mainlayoutService.getTabbarHandler(this.containerId);
    if (handler) {
      handler!.setTitleComponent(DebubgConfigurationView, 85);
    }
  }
}

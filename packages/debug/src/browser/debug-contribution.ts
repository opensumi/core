import { Domain, ClientAppContribution } from '@ali/ide-core-browser';
import { ComponentContribution, ComponentRegistry, Command } from '@ali/ide-core-browser';
import { DebugThreadView } from './view/debug-threads.view';
import { DebugBreakpointView } from './view/debug-breakpoints.view';
import { DebugStackFrameView } from './view/debug-stack-frames.view';
import { DebugVariableView } from './view/debug-variable.view';
import { DebubgConfigurationView } from './view/debug-configuration.view';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { Autowired } from '@ali/common-di';
import { DebugModelController } from './editor/debug-controller';

const DEBUG_SETTING_COMMAND: Command = {
  id: 'debug.setting',
  iconClass: 'volans_icon icon-file_setting',
};

@Domain(ClientAppContribution, ComponentContribution, MainLayoutContribution)
export class DebugContribution implements ComponentContribution, MainLayoutContribution {

  @Autowired(IMainLayoutService)
  protected readonly mainlayoutService: IMainLayoutService;

  @Autowired()
  protected debugEditorController: DebugModelController;

  containerId: string = 'debug';

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-debug', [
      {
        component: DebugThreadView,
        id: 'debug-thread',
        name: 'THREADS',
      },
      {
        component: DebugStackFrameView,
        id: 'debug-stack-frame',
        name: 'CALL STACK',
      },
      {
        component: DebugVariableView,
        id: 'debug-variable',
        name: 'VARIABLES',
      },
      {
        component: DebugBreakpointView,
        id: 'debug-breakpoints',
        name: 'BREAKPOINTS',
      },
    ], {
      iconClass: 'volans_icon remote_debug',
      title: 'DEBUG',
      containerId: this.containerId,
    });
  }

  onStart() {
    this.debugEditorController.init();
  }

  onDidUseConfig() {
    const handler = this.mainlayoutService.getTabbarHandler(this.containerId);
    handler!.setTitleComponent(DebubgConfigurationView, 85);
  }
}

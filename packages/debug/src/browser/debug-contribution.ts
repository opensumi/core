import { Domain } from '@ali/ide-core-browser';
import { ComponentContribution, ComponentRegistry, Command } from '@ali/ide-core-browser';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@ali/ide-activity-panel/lib/browser/tab-bar-toolbar';
import { DebugThreadView } from './view/debug-threads.view';
import { DebugBreakpointView } from './view/debug-breakpoints.view';
import { DebugStackFrameView } from './view/debug-stack-frames.view';
import { DebugVariableView } from './view/debug-variable.view';
import { DebubgConfigurationView } from './view/debug-configuration.view';

const DEBUG_SETTING_COMMAND: Command = {
  id: 'debug.setting',
  iconClass: 'volans_icon icon-file_setting',
};

@Domain(ComponentContribution, TabBarToolbarContribution)
export class DebugContribution implements ComponentContribution, TabBarToolbarContribution {
  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-debug', [
      {
        component: DebubgConfigurationView,
        id: 'debug-toolbar',
        name: 'TOOLBAR',
      },
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
      containerId: 'debug',
    });
  }

  registerToolbarItems(registry: TabBarToolbarRegistry) {
  }
}

import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, ClientAppContribution, EXPLORER_COMMANDS, URI, Domain, KeybindingContribution, KeybindingRegistry, FILE_COMMANDS } from '@ali/ide-core-browser';
import { FileTreeService, FileUri } from '@ali/ide-file-tree';
import { ComponentContribution, ComponentRegistry, Command } from '@ali/ide-core-browser';
import { IWorkspaceService, KAITIAN_MUTI_WORKSPACE_EXT } from '@ali/ide-workspace';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@ali/ide-activity-panel/lib/browser/tab-bar-toolbar';

const DEBUG_SETTING_COMMAND: Command = {
  id: 'debug.setting',
  iconClass: 'volans_icon icon-file_setting',
};

@Domain(ComponentContribution, TabBarToolbarContribution)
export class DebugContribution implements ComponentContribution, TabBarToolbarContribution {
  registerComponent(registry: ComponentRegistry) {
    registry.register('ide-debug', [
      // {
      //   component: ExplorerOpenEditorPanel,
      //   id: 'open-editor-explorer',
      //   name: 'OPEN EDITORS',
      // },
    ], {
      iconClass: 'volans_icon icon-remote_debug',
      title: 'DEBUG',
      weight: 10,
      containerId: 'debug',
    });
  }

  registerToolbarItems(registry: TabBarToolbarRegistry) {
    // registry.registerItem({
    //   id: DEBUG_SETTING_COMMAND.id,
    //   command: DEBUG_SETTING_COMMAND.id,
    //   viewId: ,
    // });
  }
}

import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { Command, CommandContribution, Domain, localize, CommandRegistry } from '@ali/ide-core-common';
import { IExtensionManagerService, EXTENSION_SCHEME, enableExtensionsContainerId, RawExtension, EnableScope} from '../common';
import { ExtensionDetailView } from './extension-detail.view';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { Autowired } from '@ali/common-di';
import { BrowserEditorContribution, EditorComponentRegistry } from '@ali/ide-editor/lib/browser';
import { ResourceService } from '@ali/ide-editor';
import { ExtensionResourceProvider } from './extension-resource-provider';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import { MenuId, NextMenuContribution as MenuContribution, IMenuRegistry } from '@ali/ide-core-browser/lib/menu/next';

import ExtensionPanelView from './extension-panel.view';

const category = '%extension%';

namespace ExtensionCommands {
  export const ENABLE: Command = {
    id: 'extension.enable',
    category,
    label: '%marketplace.extension.enable%',
  };
  export const ENABLE_WORKSPACE: Command = {
    id: 'extension.enable.workspace',
    category,
    label: '%marketplace.extension.enable.workspace%',
  };
  export const DISABLE: Command = {
    id: 'extension.disable',
    category,
    label: '%marketplace.extension.disable%',
  };
  export const DISABLE_WORKSPACE: Command = {
    id: 'extension.disable.workspace',
    category,
    label: '%marketplace.extension.disable.workspace%',
  };
  export const UNINSTALL: Command = {
    id: 'extension.uninstall',
    category,
    label: '%marketplace.extension.uninstall%',
  };
}

@Domain(ComponentContribution, MainLayoutContribution, BrowserEditorContribution, MenuContribution, CommandContribution)
export class ExtensionManagerContribution implements MainLayoutContribution, ComponentContribution, BrowserEditorContribution, MenuContribution, CommandContribution {

  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  @Autowired(IExtensionManagerService)
  etensionManagerService: IExtensionManagerService;

  @Autowired()
  resourceProvider: ExtensionResourceProvider;

  registerResource(resourceService: ResourceService) {
    resourceService.registerResourceProvider(this.resourceProvider);
  }

  registerEditorComponent(editorComponentRegistry: EditorComponentRegistry) {
    const EXTENSIONS_DETAIL_COMPONENT_ID = `${EXTENSION_SCHEME}_detail`;
    editorComponentRegistry.registerEditorComponent({
      component: ExtensionDetailView,
      uid: EXTENSIONS_DETAIL_COMPONENT_ID,
      scheme: EXTENSION_SCHEME,
    });

    editorComponentRegistry.registerEditorComponentResolver(EXTENSION_SCHEME, (_, __, resolve) => {
      resolve!([
        {
          type: 'component',
          componentId: EXTENSIONS_DETAIL_COMPONENT_ID,
        },
      ]);
    });
  }

  registerComponent(registry: ComponentRegistry): void {
    registry.register('@ali/ide-extension-manager', [], {
      iconClass: getIcon('extension'),
      title: localize('marketplace.extension.container'),
      priority: 5,
      containerId: enableExtensionsContainerId,
      component: ExtensionPanelView,
    });
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(ExtensionCommands.ENABLE, {
      execute: (extension: RawExtension) => {
        if (extension) {
          this.etensionManagerService.toggleActiveExtension(extension, true, EnableScope.GLOBAL);
        }
      },
      isVisible: (extension: RawExtension) => {
        return !extension.enable;
      },
    });
    commands.registerCommand(ExtensionCommands.ENABLE_WORKSPACE, {
      execute: (extension: RawExtension) => {
        if (extension) {
          this.etensionManagerService.toggleActiveExtension(extension, true, EnableScope.WORKSPACE);
        }
      },
      isVisible: (extension: RawExtension) => {
        return !extension.enable;
      },
    });
    commands.registerCommand(ExtensionCommands.DISABLE, {
      execute: (extension: RawExtension) => {
        if (extension) {
          this.etensionManagerService.toggleActiveExtension(extension, false, EnableScope.GLOBAL);
        }
      },
      isVisible: (extension: RawExtension) => {
        // https://yuque.antfin-inc.com/cloud-ide/za8zpk/kpwylo#RvfMV
        return extension.enableScope === EnableScope.GLOBAL || (extension.enableScope === EnableScope.WORKSPACE && !extension.enable);
      },
    });
    commands.registerCommand(ExtensionCommands.DISABLE_WORKSPACE, {
      execute: (extension: RawExtension) => {
        if (extension) {
          this.etensionManagerService.toggleActiveExtension(extension, false, EnableScope.GLOBAL);
        }
      },
      isVisible: (extension: RawExtension) => {
        return extension.enable;
      },
    });
    commands.registerCommand(ExtensionCommands.UNINSTALL, {
      execute: (extension: RawExtension) => {
        if (extension) {
          this.etensionManagerService.uninstallExtension(extension);
        }
      },
      isVisible: (extension: RawExtension) => {
        return extension.installed;
      },
    });
  }

  registerNextMenus(menuRegistry: IMenuRegistry): void {
    menuRegistry.registerMenuItem(MenuId.ExtensionContext, {
      command: ExtensionCommands.ENABLE,
      order: 0,
      group: '1_enable',
    });
    menuRegistry.registerMenuItem(MenuId.ExtensionContext, {
      command: ExtensionCommands.ENABLE_WORKSPACE,
      order: 1,
      group: '1_enable',
    });
    menuRegistry.registerMenuItem(MenuId.ExtensionContext, {
      command: ExtensionCommands.DISABLE,
      order: 0,
      group: '2_disable',
    });
    menuRegistry.registerMenuItem(MenuId.ExtensionContext, {
      command: ExtensionCommands.DISABLE_WORKSPACE,
      order: 1,
      group: '2_disable',
    });
    menuRegistry.registerMenuItem(MenuId.ExtensionContext, {
      command: ExtensionCommands.UNINSTALL,
      order: 5,
      group: '3_unstall',
    });
  }

  onDidUseConfig() {
    const handler = this.mainLayoutService.getTabbarHandler(enableExtensionsContainerId);
    if (handler) {
      // 在激活的时候获取数据
      handler.onActivate(() => {
        this.etensionManagerService.init();
      });
    }
  }
}

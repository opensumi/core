import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { Command, CommandContribution, Domain, localize, CommandRegistry } from '@ali/ide-core-common';
import { IExtensionManagerService, EXTENSION_SCHEME, enableExtensionsContainerId, RawExtension, EnableScope} from '../common';
import { ExtensionDetailView } from './extension-detail.view';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { Autowired } from '@ali/common-di';
import { BrowserEditorContribution, EditorComponentRegistry } from '@ali/ide-editor/lib/browser';
import { ResourceService } from '@ali/ide-editor';
import { ExtensionResourceProvider } from './extension-resource-provider';
import { getIcon, IQuickInputService } from '@ali/ide-core-browser';
import { MenuId, NextMenuContribution as MenuContribution, IMenuRegistry } from '@ali/ide-core-browser/lib/menu/next';

import ExtensionPanelView from './extension-panel.view';
import { IMessageService } from '@ali/ide-overlay';
import { IStatusBarService, StatusBarAlignment } from '@ali/ide-core-browser/lib/services';

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
  export const INSTALL_EXTENSION_BY_ID: Command = {
    id: 'extension.install.id',
    category,
    label: '%marketplace.quickopen.install%',
  };
  export const INSTALL_EXTENSION_BY_RELEASE_ID: Command = {
    id: 'extension.install.releaseId',
    category,
    label: '%marketplace.quickopen.install.byReleaseId%',
  };
}

@Domain(ComponentContribution, MainLayoutContribution, BrowserEditorContribution, MenuContribution, CommandContribution)
export class ExtensionManagerContribution implements MainLayoutContribution, ComponentContribution, BrowserEditorContribution, MenuContribution, CommandContribution {

  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  @Autowired(IExtensionManagerService)
  extensionManagerService: IExtensionManagerService;

  @Autowired()
  resourceProvider: ExtensionResourceProvider;

  @Autowired(IQuickInputService)
  quickInputService: IQuickInputService;

  @Autowired(IMessageService)
  messageService: IMessageService;

  @Autowired(IStatusBarService)
  statusBarService: IStatusBarService;

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
      activateKeyBinding: 'ctrlcmd+shift+x',
    });
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(ExtensionCommands.ENABLE, {
      execute: (extension: RawExtension) => {
        if (extension) {
          this.extensionManagerService.toggleActiveExtension(extension, true, EnableScope.GLOBAL);
        }
      },
      isVisible: (extension: RawExtension) => {
        return extension && !extension.enable;
      },
    });
    commands.registerCommand(ExtensionCommands.ENABLE_WORKSPACE, {
      execute: (extension: RawExtension) => {
        if (extension) {
          this.extensionManagerService.toggleActiveExtension(extension, true, EnableScope.WORKSPACE);
        }
      },
      isVisible: (extension: RawExtension) => {
        return extension && !extension.enable;
      },
    });
    commands.registerCommand(ExtensionCommands.DISABLE, {
      execute: (extension: RawExtension) => {
        if (extension) {
          this.extensionManagerService.toggleActiveExtension(extension, false, EnableScope.GLOBAL);
        }
      },
      isVisible: (extension: RawExtension) => {
        // https://yuque.antfin-inc.com/cloud-ide/za8zpk/kpwylo#RvfMV
        return extension && extension.enable && (extension.enableScope === EnableScope.GLOBAL || (extension.enableScope === EnableScope.WORKSPACE && !extension.enable));
      },
    });
    commands.registerCommand(ExtensionCommands.DISABLE_WORKSPACE, {
      execute: (extension: RawExtension) => {
        if (extension) {
          this.extensionManagerService.toggleActiveExtension(extension, false, EnableScope.GLOBAL);
        }
      },
      isVisible: (extension: RawExtension) => {
        return extension && extension.enable;
      },
    });
    commands.registerCommand(ExtensionCommands.UNINSTALL, {
      execute: (extension: RawExtension) => {
        if (extension) {
          this.extensionManagerService.uninstallExtension(extension);
        }
      },
      isVisible: (extension: RawExtension) => {
        return extension && extension.installed && !extension.isBuiltin;
      },
    });
    commands.registerCommand(ExtensionCommands.INSTALL_EXTENSION_BY_ID, {
      execute: async () => {
        const extensionId = await this.quickInputService.open({
          prompt: localize('marketplace.quickopen.install.id'),
          placeHolder: 'group.name',
        });
        if (!extensionId) {
          this.messageService.info(localize('marketplace.quickopen.install.id.required'));
          return;
        }
        const version = await this.quickInputService.open({
          placeHolder: localize('marketplace.quickopen.install.version.placeholder'),
        });
        if (!version) {
          this.messageService.info(localize('marketplace.quickopen.install.version.required'));
          return;
        }
        try {
          const [publisher, name] = extensionId.split('.');
          this.statusBarService.addElement(ExtensionCommands.INSTALL_EXTENSION_BY_ID.id, {
            text: `$(sync~spin) ${localize('marketplace.extension.installing')}`,
            alignment: StatusBarAlignment.RIGHT,
            priority: 10000,
          });
          await this.extensionManagerService.installExtension({
            extensionId,
            name,
            publisher,
            path: '',
            version: version || '',
          });
          // 下载成功打开插件面板
          this.extensionManagerService.openExtensionDetail({
            publisher,
            name,
            version,
            preview: false,
            remote: false,
          });
        } catch (e) {
          this.messageService.error(`${localize('marketplace.quickopen.install.error')} : ${e.message}`);
        } finally {
          this.statusBarService.removeElement(ExtensionCommands.INSTALL_EXTENSION_BY_ID.id);
        }
      },
    });

    commands.registerCommand(ExtensionCommands.INSTALL_EXTENSION_BY_RELEASE_ID, {
      execute: async () => {
        const releaseId = await this.quickInputService.open({
          prompt: localize('marketplace.quickopen.install.releaseId'),
          placeHolder: 'releaseId',
        });
        if (!releaseId) {
          this.messageService.info(localize('marketplace.quickopen.install.id.required'));
          return;
        }
        try {
          this.statusBarService.addElement(ExtensionCommands.INSTALL_EXTENSION_BY_RELEASE_ID.id, {
            text: `$(sync~spin) ${localize('marketplace.extension.installing')}`,
            alignment: StatusBarAlignment.RIGHT,
            priority: 10000,
          });
          await this.extensionManagerService.installExtensionByReleaseId(releaseId);
          this.messageService.info(localize('marketplace.extension.installed'));
        } catch (e) {
          this.messageService.error(`${localize('marketplace.quickopen.install.error')} : ${e.message}`);
        } finally {
          this.statusBarService.removeElement(ExtensionCommands.INSTALL_EXTENSION_BY_RELEASE_ID.id);
        }
      },
    });
  }

  registerNextMenus(menuRegistry: IMenuRegistry): void {
    menuRegistry.registerMenuItem(MenuId.ExtensionContext, {
      command: ExtensionCommands.ENABLE.id,
      order: 0,
      group: '1_enable',
    });
    menuRegistry.registerMenuItem(MenuId.ExtensionContext, {
      command: ExtensionCommands.ENABLE_WORKSPACE.id,
      order: 1,
      group: '1_enable',
    });
    menuRegistry.registerMenuItem(MenuId.ExtensionContext, {
      command: ExtensionCommands.DISABLE.id,
      order: 0,
      group: '2_disable',
    });
    menuRegistry.registerMenuItem(MenuId.ExtensionContext, {
      command: ExtensionCommands.DISABLE_WORKSPACE.id,
      order: 1,
      group: '2_disable',
    });
    menuRegistry.registerMenuItem(MenuId.ExtensionContext, {
      command: ExtensionCommands.UNINSTALL.id,
      order: 5,
      group: '3_unstall',
    });
  }

  onDidRender() {
    const handler = this.mainLayoutService.getTabbarHandler(enableExtensionsContainerId);
    if (handler) {
      // 在激活的时候获取数据
      handler.onActivate(() => {
        this.extensionManagerService.init();
      });
    }
  }
}

import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { Command, CommandContribution, Domain, localize, CommandRegistry } from '@ali/ide-core-common';
import { IExtensionManagerService, EXTENSION_SCHEME, enableExtensionsContainerId} from '../common';
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

class ExtensionCommands {
  static UNINSTALL: Command = {
    id: 'extension.uninstall',
    category,
    label: '%explorer.location%',
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
    commands.registerCommand(ExtensionCommands.UNINSTALL, {
      execute: (...args) => {
        console.log(args, 'args');
      },
    });
  }

  registerNextMenus(menuRegistry: IMenuRegistry): void {
    menuRegistry.registerMenuItem(MenuId.ExtensionContext, {
      command: ExtensionCommands.UNINSTALL,
      order: 4,
      group: '1_open',
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

import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { Domain } from '@ali/ide-core-common';
import { tarbarHandlerId, IExtensionManagerService, EXTENSION_SCHEME } from '../common';
import { ExtensionPanel } from './extension-panel.view';
import { ExtensionDetailView } from './extension-detail.view';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { Autowired } from '@ali/common-di';
import { BrowserEditorContribution, EditorComponentRegistry } from '@ali/ide-editor/lib/browser';
import { ResourceService } from '@ali/ide-editor';
import { ExtensionResourceProvider } from './extension-resource-provider';

@Domain(ComponentContribution, MainLayoutContribution, BrowserEditorContribution)
export class ExtensionManagerContribution implements MainLayoutContribution, ComponentContribution, BrowserEditorContribution {

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
    registry.register('@ali/ide-extension-manager', {
      component: ExtensionPanel,
      id: tarbarHandlerId,
      name: 'ENABLED',
    }, {
      iconClass: 'volans_icon plug_in',
      title: 'EXTENSIONS',
      weight: 5,
      containerId: tarbarHandlerId,
    });
  }

  onDidUseConfig() {
    const handler = this.mainLayoutService.getTabbarHandler(tarbarHandlerId);
    // 在激活的时候获取数据
    handler!.onActivate(() => {
      this.etensionManagerService.init();
    });
  }

}

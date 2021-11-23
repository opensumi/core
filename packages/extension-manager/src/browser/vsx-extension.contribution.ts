import { Autowired } from '@ide-framework/common-di';
import { ClientAppContribution, ComponentContribution, ComponentRegistry, getIcon } from '@ide-framework/ide-core-browser';
import { Domain, localize, URI } from '@ide-framework/ide-core-common';
import { IMainLayoutService } from '@ide-framework/ide-main-layout';
import { BrowserEditorContribution, EditorComponentRegistry, IResource, ResourceService } from '@ide-framework/ide-editor/lib/browser';
import { IIconService, IconType } from '@ide-framework/ide-theme';

import { IVSXExtensionService, VSXExtensionServiceToken } from '../common';
import { VSXExtensionView } from './vsx-extension.view';
import { ExtensionOverview } from './extension-overview';
import { VSXExtensionRaw } from '../common/vsx-registry-types';
import { OPEN_VSX_EXTENSION_MANAGER_CONTAINER_ID, EXTENSION_SCHEME } from './const';

@Domain(ClientAppContribution, ComponentContribution, BrowserEditorContribution)
export class VSXExtensionContribution implements ClientAppContribution, ComponentContribution, BrowserEditorContribution {

  @Autowired(IMainLayoutService)
  private readonly mainLayoutService: IMainLayoutService;

  @Autowired(VSXExtensionServiceToken)
  private readonly vsxExtensionService: IVSXExtensionService;

  @Autowired(IIconService)
  private readonly iconService: IIconService;

  initialize() {
  }

  onDidRender() {
    const handler = this.mainLayoutService.getTabbarHandler(OPEN_VSX_EXTENSION_MANAGER_CONTAINER_ID);
    if (handler) {
      // 在激活的时候获取数据
      handler.onActivate(() => {
        this.vsxExtensionService.search('');
      });
    }
  }

  registerResource(service: ResourceService) {
    service.registerResourceProvider({
      scheme: EXTENSION_SCHEME,
      provideResource: async (uri: URI): Promise<IResource<VSXExtensionRaw | undefined>> => {
        const { extensionId } = uri.getParsedQuery();
        const extension = await this.vsxExtensionService.getExtension(extensionId);
        const iconClass = this.iconService.fromIcon('', extension?.files.icon, IconType.Background);
        return {
          uri,
          metadata: extension,
          icon: iconClass || getIcon('extension'),
          name: extension?.displayName || '',
        };
      },
    });
  }

  registerEditorComponent(editorComponentRegistry: EditorComponentRegistry) {
    const EXTENSIONS_DETAIL_COMPONENT_ID = `${EXTENSION_SCHEME}_detail`;
    editorComponentRegistry.registerEditorComponent({
      component: ExtensionOverview,
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
    registry.register('@ide-framework/ide-extension-manager', [], {
      iconClass: getIcon('extension'),
      title: localize('marketplace.extension.container'),
      priority: 5,
      containerId: OPEN_VSX_EXTENSION_MANAGER_CONTAINER_ID,
      component: VSXExtensionView,
      activateKeyBinding: 'ctrlcmd+shift+x',
    });
  }
}

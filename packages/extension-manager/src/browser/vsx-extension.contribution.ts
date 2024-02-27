import { Autowired } from '@opensumi/di';
import { ClientAppContribution, ComponentContribution, ComponentRegistry, getIcon } from '@opensumi/ide-core-browser';
import { Domain, URI, localize, replaceLocalizePlaceholder } from '@opensumi/ide-core-common';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  EditorOpenType,
  IResource,
  ResourceService,
} from '@opensumi/ide-editor/lib/browser';
import { IMainLayoutService, MainLayoutContribution } from '@opensumi/ide-main-layout';
import { IIconService, IconType } from '@opensumi/ide-theme';

import { IVSXExtensionService, VSXExtensionServiceToken } from '../common';

import { EXTENSION_SCHEME, OPEN_VSX_EXTENSION_MANAGER_CONTAINER_ID } from './const';
import { ExtensionOverview } from './extension-overview';
import { VSXExtensionView } from './vsx-extension.view';

@Domain(ClientAppContribution, MainLayoutContribution, ComponentContribution, BrowserEditorContribution)
export class VSXExtensionContribution
  implements ClientAppContribution, MainLayoutContribution, ComponentContribution, BrowserEditorContribution
{
  @Autowired(IMainLayoutService)
  private readonly mainLayoutService: IMainLayoutService;

  @Autowired(VSXExtensionServiceToken)
  private readonly vsxExtensionService: IVSXExtensionService;

  @Autowired(IIconService)
  private readonly iconService: IIconService;

  initialize() {}

  onDidRender() {
    const handler = this.mainLayoutService.getTabbarHandler(OPEN_VSX_EXTENSION_MANAGER_CONTAINER_ID);
    if (handler) {
      if (handler.isActivated()) {
        this.vsxExtensionService.getOpenVSXRegistry().then(() => {
          this.vsxExtensionService.search('');
        });
      } else {
        // 在激活的时候获取数据
        handler.onActivate(async () => {
          !this.vsxExtensionService.openVSXRegistry && (await this.vsxExtensionService.getOpenVSXRegistry());
          this.vsxExtensionService.search('');
        });
      }
    }
  }

  registerResource(service: ResourceService) {
    service.registerResourceProvider({
      scheme: EXTENSION_SCHEME,
      provideResource: async (uri: URI): Promise<IResource<Partial<{ [prop: string]: any }>>> => {
        const { extensionId, state } = uri.getParsedQuery();
        const extension = await this.vsxExtensionService.getLocalExtension(extensionId);
        const iconClass = this.iconService.fromIcon('', extension?.iconUrl, IconType.Background);
        return {
          uri,
          metadata: {
            ...extension,
            extensionId,
            state,
            openVSXRegistry: this.vsxExtensionService.openVSXRegistry,
          },
          icon: iconClass || getIcon('extension'),
          name: replaceLocalizePlaceholder(extension?.displayName, extensionId) || '',
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
      resolve?.([
        {
          type: EditorOpenType.component,
          componentId: EXTENSIONS_DETAIL_COMPONENT_ID,
        },
      ]);
    });
  }

  registerComponent(registry: ComponentRegistry): void {
    registry.register('@opensumi/ide-extension-manager', [], {
      iconClass: getIcon('extension'),
      title: localize('marketplace.extension.container'),
      priority: 5,
      containerId: OPEN_VSX_EXTENSION_MANAGER_CONTAINER_ID,
      component: VSXExtensionView,
      activateKeyBinding: 'ctrlcmd+shift+x',
    });
  }
}

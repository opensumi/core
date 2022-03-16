import { Autowired } from '@opensumi/di';
import { ClientAppContribution, ComponentContribution, ComponentRegistry, getIcon } from '@opensumi/ide-core-browser';
import { Domain, localize, replaceLocalizePlaceholder, URI } from '@opensumi/ide-core-common';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  IResource,
  ResourceService,
} from '@opensumi/ide-editor/lib/browser';
import { IMainLayoutService, MainLayoutContribution } from '@opensumi/ide-main-layout';
import { IIconService, IconType } from '@opensumi/ide-theme';

import { InstallState, IVSXExtensionService, VSXExtensionServiceToken } from '../common';
import { VSXExtensionRaw } from '../common/vsx-registry-types';

import { OPEN_VSX_EXTENSION_MANAGER_CONTAINER_ID, EXTENSION_SCHEME } from './const';
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
      // 在激活的时候获取数据
      handler.onActivate(() => {
        this.vsxExtensionService.search('');
      });
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
      resolve!([
        {
          type: 'component',
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

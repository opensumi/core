import { Autowired } from '@opensumi/di';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { Domain, Schemes, URI } from '@opensumi/ide-core-common';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  EditorComponentRenderMode,
  IResource,
  ResourceService,
} from '@opensumi/ide-editor/lib/browser/types';
import { IconService } from '@opensumi/ide-theme/lib/browser';
import { IWorkspaceService } from '@opensumi/ide-workspace/lib/common';

import { MCPConfigView } from './components/mcp-config.view';

const COMPONENTS_ID = 'opensumi-mcp-config-viewer';
export const MCP_CONFIG_COMPONENTS_SCHEME_ID = 'mcp-config';

export type IMCPConfigResource = IResource<{ configType: string }>;

@Domain(BrowserEditorContribution)
export class MCPConfigContribution implements BrowserEditorContribution {
  @Autowired(IWorkspaceService)
  protected readonly workspaceService: IWorkspaceService;

  @Autowired(IconService)
  protected readonly iconService: IconService;

  @Autowired()
  labelService: LabelService;

  registerEditorComponent(registry: EditorComponentRegistry) {
    registry.registerEditorComponent({
      uid: COMPONENTS_ID,
      scheme: MCP_CONFIG_COMPONENTS_SCHEME_ID,
      component: MCPConfigView,
      renderMode: EditorComponentRenderMode.ONE_PER_WORKBENCH,
    });

    registry.registerEditorComponentResolver(MCP_CONFIG_COMPONENTS_SCHEME_ID, (resource, results) => {
      results.push({
        type: 'component',
        componentId: COMPONENTS_ID,
      });
    });
  }

  registerResource(service: ResourceService) {
    service.registerResourceProvider({
      scheme: MCP_CONFIG_COMPONENTS_SCHEME_ID,
      provideResource: async (uri: URI): Promise<IMCPConfigResource> => {
        const { configType } = uri.getParsedQuery();

        return {
          uri,
          name: 'MCP Configuration',
          icon: 'settings',
          metadata: {
            configType,
          },
        };
      },
    });
  }
}

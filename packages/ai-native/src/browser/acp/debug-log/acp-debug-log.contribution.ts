import { Autowired } from '@opensumi/di';
import { getIcon } from '@opensumi/ide-components';
import { CommandContribution, CommandRegistry, Domain, URI } from '@opensumi/ide-core-common';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  EditorComponentRenderMode,
  IResource,
  ResourceService,
  WorkbenchEditorService,
} from '@opensumi/ide-editor/lib/browser/types';

import { AcpDebugLogView } from './acp-debug-log.view';

export namespace AcpDebugLogCommands {
  export const OPEN_ACP_DEBUG_LOG = {
    id: 'ai.native.acp.openDebugLog',
    label: 'Open ACP Debug Log',
  };
}

const COMPONENTS_ID = 'opensumi-acp-debug-log-viewer';
export const ACP_DEBUG_LOG_SCHEME_ID = 'acp-debug-log';

export type IAcpDebugLogResource = IResource;

@Domain(BrowserEditorContribution, CommandContribution)
export class AcpDebugLogContribution implements BrowserEditorContribution, CommandContribution {
  @Autowired(WorkbenchEditorService)
  protected readonly editorService: WorkbenchEditorService;

  registerEditorComponent(registry: EditorComponentRegistry) {
    registry.registerEditorComponent({
      uid: COMPONENTS_ID,
      scheme: ACP_DEBUG_LOG_SCHEME_ID,
      component: AcpDebugLogView,
      renderMode: EditorComponentRenderMode.ONE_PER_WORKBENCH,
    });

    registry.registerEditorComponentResolver(ACP_DEBUG_LOG_SCHEME_ID, (_, results) => {
      results.push({
        type: 'component',
        componentId: COMPONENTS_ID,
      });
    });
  }

  registerResource(service: ResourceService) {
    service.registerResourceProvider({
      scheme: ACP_DEBUG_LOG_SCHEME_ID,
      provideResource: async (uri: URI): Promise<IAcpDebugLogResource> => ({
        uri,
        name: 'ACP Debug Log',
        icon: getIcon('debug'),
      }),
    });
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(AcpDebugLogCommands.OPEN_ACP_DEBUG_LOG, {
      execute: () => {
        const uri = new URI().withScheme(ACP_DEBUG_LOG_SCHEME_ID);
        this.editorService.open(uri, {
          preview: false,
          focus: true,
        });
      },
    });
  }
}

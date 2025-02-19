import { Autowired } from '@opensumi/di';
import { CommandContribution, CommandRegistry, URI } from '@opensumi/ide-core-browser';
import { Domain } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';

import { MCP_CONFIG_COMPONENTS_SCHEME_ID } from './mcp-config.contribution';

export const OPEN_MCP_CONFIG_COMMAND = {
  id: 'opensumi-mcp.openConfig',
  label: 'Open MCP Configuration',
};

@Domain(CommandContribution)
export class MCPConfigCommandContribution implements CommandContribution {
  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(OPEN_MCP_CONFIG_COMMAND, {
      execute: () => {
        const uri = new URI().withScheme(MCP_CONFIG_COMPONENTS_SCHEME_ID);
        this.editorService.open(uri, {
          preview: false,
          focus: true,
        });
      },
    });
  }
}

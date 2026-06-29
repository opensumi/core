import { Autowired } from '@opensumi/di';
import { CommandContribution, CommandRegistry, URI } from '@opensumi/ide-core-browser';
import { Domain, MCPConfigServiceToken } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';

import { MCPConfigCommands, MCP_CONFIG_COMPONENTS_SCHEME_ID } from './mcp-config.constants';
import { MCPConfigService } from './mcp-config.service';

export { MCPConfigCommands } from './mcp-config.constants';

@Domain(CommandContribution)
export class MCPConfigCommandContribution implements CommandContribution {
  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  @Autowired(MCPConfigServiceToken)
  private readonly mcpConfigService: MCPConfigService;

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(MCPConfigCommands.OPEN_MCP_CONFIG, {
      execute: () => {
        const uri = new URI().withScheme(MCP_CONFIG_COMPONENTS_SCHEME_ID);
        this.editorService.open(uri, {
          preview: false,
          focus: true,
        });
      },
    });

    registry.registerCommand(MCPConfigCommands.OPEN_MCP_CONFIG_FILE, {
      execute: () => {
        this.mcpConfigService.openConfigFile();
      },
    });
  }
}

import { PreferenceSchema } from '@opensumi/ide-core-browser';
import { CodeSchemaId } from '@opensumi/ide-core-common';

export const MCPPreferencesSchema: PreferenceSchema = {
  type: 'object',
  scope: 'resource',
  properties: {
    mcp: {
      $ref: CodeSchemaId.mcp,
      description:
        "Global MCP configuration. Should be used as an alternative to 'mcp.json' that is shared across workspaces",
      defaultValue: { configurations: [], compounds: [] },
    },
  },
};

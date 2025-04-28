import { PreferenceSchema } from '@opensumi/ide-core-browser';
import { CodeSchemaId, IJSONSchema } from '@opensumi/ide-core-common';

export const MCPSchemaUri = `${CodeSchemaId.mcp}/user`;

export const MCPPreferencesSchema: PreferenceSchema = {
  type: 'object',
  scope: 'resource',
  properties: {
    mcp: {
      $ref: MCPSchemaUri,
      description: 'MCP configuration for Workspace.',
      defaultValue: { mcpServers: [] },
    },
  },
};

export const MCPSchema: IJSONSchema = {
  $id: MCPSchemaUri,
  type: 'object',
  title: 'MCP',
  required: [],
  default: { mcpServers: [] },
  properties: {
    mcpServers: {
      type: 'object',
      description: 'List of MCP Servers. Add new servers or edit existing ones by using IntelliSense.',
      properties: {
        command: {
          type: 'string',
          description: 'The command to start the MCP server.',
        },
        args: {
          type: 'array',
          description: 'The arguments for the command to start the MCP server.',
        },
        env: {
          type: 'object',
          description: 'The environment variables for the command to start the MCP server.',
        },
        url: {
          type: 'string',
          description: 'The SSE URL for the MCP server.',
        },
      },
    },
  },
};

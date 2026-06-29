/**
 * WebMCP group definition for discovering the built-in OpenSumi MCP transport.
 */
import { Injector } from '@opensumi/di';
import { AIBackSerivcePath, IAIBackService } from '@opensumi/ide-core-common';

import { WebMcpGroupRegistration } from '../webmcp-group-registry';
import { classifyError, errorResult, serviceUnavailableResult, successResult, tryGetService } from '../webmcp-utils';

export function createOpenSumiMcpGroup(container: Injector): WebMcpGroupRegistration {
  return {
    name: 'opensumi_mcp',
    description: 'OpenSumi built-in MCP transport discovery',
    defaultLoaded: true,
    tools: [
      {
        name: 'opensumi_get_mcp_server_connection',
        description:
          'Start the built-in opensumi-ide MCP server and return a local Streamable HTTP connection descriptor. Use redactedUrl for logs.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        execute: async () => {
          const aiBackService = tryGetService<IAIBackService>(container, AIBackSerivcePath);
          if (!aiBackService?.getOpenSumiMcpServerConnection) {
            return serviceUnavailableResult('AIBackService.getOpenSumiMcpServerConnection');
          }
          try {
            return successResult(await aiBackService.getOpenSumiMcpServerConnection());
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
    ],
  };
}

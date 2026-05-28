jest.mock('@opensumi/di', () => {
  const actual = jest.requireActual('@opensumi/di');
  const noopDecorator = () => () => {};
  return {
    ...actual,
    Injectable: () => (cls: any) => cls,
    Autowired: noopDecorator,
  };
});

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { OpenSumiMcpHttpServer } from '../../src/node/acp/opensumi-mcp-http-server';

import type { ILogger } from '@opensumi/ide-core-common';
import type { WebMcpGroupDef, WebMcpToolResult } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

(global as any).fetch = require('node-fetch');

const testGroupDefs = [
  {
    name: 'file',
    description: 'File operations',
    defaultLoaded: true,
    profile: 'default',
    tools: [
      {
        method: '_opensumi/file/read',
        description: 'Read file',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
            },
          },
          required: ['path'],
        },
      },
      {
        method: '_opensumi/file/delete',
        description: 'Delete file',
        riskLevel: 'destructive',
        exposedByDefault: false,
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
            },
          },
          required: ['path'],
        },
      },
    ],
  },
  {
    name: 'search',
    description: 'Search operations',
    defaultLoaded: true,
    profile: 'default',
    tools: [
      {
        method: '_opensumi/search/text',
        description: 'Search text',
        riskLevel: 'read',
        profiles: ['interactive', 'full'],
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
            },
          },
          required: ['query'],
        },
      },
    ],
  },
  {
    name: 'terminal',
    description: 'Terminal operations',
    defaultLoaded: true,
    profile: 'default',
    tools: [
      {
        method: '_opensumi/terminal/create',
        description: 'Create terminal',
        riskLevel: 'shell',
        profiles: ['interactive', 'full'],
        inputSchema: {
          type: 'object',
          properties: {
            cwd: {
              type: 'string',
            },
          },
        },
      },
      {
        method: '_opensumi/terminal/runCommand',
        description: 'Run command',
        riskLevel: 'shell',
        profiles: ['interactive', 'full'],
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
            command: {
              type: 'string',
            },
          },
          required: ['id', 'command'],
        },
      },
    ],
  },
  {
    name: 'acp_chat',
    description: 'ACP chat operations',
    defaultLoaded: true,
    profile: 'default',
    tools: [
      {
        method: '_opensumi/acp_chat/getSessionState',
        description: 'Get ACP chat session state',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        method: '_opensumi/acp_chat/setSessionMode',
        description: 'Set ACP session mode',
        riskLevel: 'write',
        profiles: ['full'],
        inputSchema: {
          type: 'object',
          properties: {
            modeId: {
              type: 'string',
            },
          },
          required: ['modeId'],
        },
      },
    ],
  },
] as WebMcpGroupDef[];

const mockLogger: ILogger = {
  log: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  warn: jest.fn(),
  critical: jest.fn(),
  dispose: jest.fn(),
  getLevel: jest.fn(),
  setLevel: jest.fn(),
};

function createServer(caller: {
  getGroupDefinitions: jest.Mock<Promise<WebMcpGroupDef[]>, [Record<string, unknown>?]>;
  executeTool: jest.Mock<Promise<WebMcpToolResult>, [string, string, Record<string, unknown>]>;
}): OpenSumiMcpHttpServer {
  const server = new OpenSumiMcpHttpServer();
  (server as any).caller = caller;
  (server as any).logger = mockLogger;
  return server;
}

describe('OpenSumiMcpHttpServer', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should expose WebMCP tools through MCP listTools and callTool', async () => {
    const caller = {
      getGroupDefinitions: jest.fn().mockResolvedValue(testGroupDefs),
      executeTool: jest.fn().mockResolvedValue({
        success: true,
        result: { path: 'README.md', content: 'hello' },
      }),
    };
    const server = createServer(caller);
    await server.start();

    const client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      },
    );
    const transport = new StreamableHTTPClientTransport(new URL(server.getUrl()));

    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'opensumi_discoverCapabilities',
          }),
          expect.objectContaining({
            name: 'opensumi_enableCapabilityGroup',
          }),
          expect.objectContaining({
            name: 'file_read',
            description: 'Read file',
            inputSchema: expect.objectContaining({
              type: 'object',
            }),
          }),
          expect.objectContaining({
            name: 'acp_chat_getSessionState',
          }),
        ]),
      );
      expect(tools.tools).toEqual(
        expect.not.arrayContaining([
          expect.objectContaining({
            name: 'search_text',
          }),
        ]),
      );
      expect(tools.tools).toEqual(
        expect.not.arrayContaining([
          expect.objectContaining({
            name: 'file_delete',
          }),
        ]),
      );
      expect(tools.tools).toEqual(
        expect.not.arrayContaining([
          expect.objectContaining({
            name: 'terminal_create',
          }),
          expect.objectContaining({
            name: 'acp_chat_setSessionMode',
          }),
        ]),
      );

      const discoverResult = await client.callTool({
        name: 'opensumi_discoverCapabilities',
        arguments: { task: 'search for a symbol' },
      });
      expect(discoverResult.isError).toBe(false);
      expect(JSON.parse((discoverResult.content as any)[0].text).result.recommended[0]).toEqual(
        expect.objectContaining({
          group: 'search',
        }),
      );

      const enableResult = await client.callTool({
        name: 'opensumi_enableCapabilityGroup',
        arguments: { group: 'search' },
      });
      expect(enableResult.isError).toBe(false);

      const toolsAfterEnable = await client.listTools();
      expect(toolsAfterEnable.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'search_text',
          }),
        ]),
      );

      const enableTerminalResult = await client.callTool({
        name: 'opensumi_enableCapabilityGroup',
        arguments: { group: 'terminal' },
      });
      expect(enableTerminalResult.isError).toBe(false);

      const toolsAfterTerminalEnable = await client.listTools();
      expect(toolsAfterTerminalEnable.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'terminal_create',
          }),
          expect.objectContaining({
            name: 'terminal_runCommand',
          }),
        ]),
      );

      const result = await client.callTool({
        name: 'file_read',
        arguments: { path: 'README.md' },
      });

      expect(caller.executeTool).toHaveBeenCalledWith('file', 'read', { path: 'README.md' });
      expect(result.isError).toBe(false);
      expect(result.content).toEqual([
        {
          type: 'text',
          text: JSON.stringify({ success: true, result: { path: 'README.md', content: 'hello' } }),
        },
      ]);

      const hiddenResult = await client.callTool({
        name: 'file_delete',
        arguments: { path: 'README.md' },
      });
      expect(hiddenResult.isError).toBe(true);
      expect(caller.executeTool).toHaveBeenCalledTimes(1);

      const fallbackResult = await client.callTool({
        name: 'opensumi_invokeCapabilityTool',
        arguments: { tool: 'search_text', arguments: { query: 'foo' } },
      });
      expect(fallbackResult.isError).toBe(false);
      expect(caller.executeTool).toHaveBeenCalledWith('search', 'text', { query: 'foo' });
    } finally {
      await client.close();
      await server.dispose();
    }
  });
});

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

const LOWER_SNAKE_TOOL_NAME = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

const testGroupDefs = [
  {
    name: 'file',
    description: 'File operations',
    defaultLoaded: true,
    profile: 'default',
    tools: [
      {
        name: 'file_read',
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
        name: 'file_delete',
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
        name: 'search_text',
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
        name: 'terminal_create',
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
        name: 'terminal_run_command',
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
        name: 'acp_chat_get_session_state',
        description: 'Get ACP chat session state',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'acp_chat_set_session_mode',
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
    const fullUrl = server.getUrl();
    const token = fullUrl.slice(fullUrl.lastIndexOf('/') + 1);
    const listeningLog = (mockLogger.log as jest.Mock).mock.calls.find(([message]) =>
      String(message).includes('[OpenSumiMcpHttpServer] Listening on '),
    )?.[0];
    expect(listeningLog).toContain('/mcp/<redacted>');
    expect(listeningLog).not.toContain(token);
    expect(listeningLog).not.toContain(fullUrl);

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
      expect(tools.tools.filter((tool) => !LOWER_SNAKE_TOOL_NAME.test(tool.name)).map((tool) => tool.name)).toEqual([]);
      expect(tools.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'opensumi_discover_capabilities',
          }),
          expect.objectContaining({
            name: 'opensumi_enable_capability_group',
          }),
          expect.objectContaining({
            name: 'file_read',
            description: 'Read file',
            inputSchema: expect.objectContaining({
              type: 'object',
            }),
          }),
          expect.objectContaining({
            name: 'acp_chat_get_session_state',
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
            name: 'acp_chat_set_session_mode',
          }),
        ]),
      );

      const discoverResult = await client.callTool({
        name: 'opensumi_discover_capabilities',
        arguments: { task: 'search for a symbol' },
      });
      expect(discoverResult.isError).toBe(false);
      expect(JSON.parse((discoverResult.content as any)[0].text).result.recommended[0]).toEqual(
        expect.objectContaining({
          group: 'search',
        }),
      );

      const enableResult = await client.callTool({
        name: 'opensumi_enable_capability_group',
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

      const describeGroupResult = await client.callTool({
        name: 'opensumi_describe_capability_group',
        arguments: { group: 'search' },
      });
      expect(describeGroupResult.isError).toBe(false);
      const describedGroup = JSON.parse((describeGroupResult.content as any)[0].text).result;
      expect(describedGroup.tools[0]).toEqual(
        expect.objectContaining({
          name: 'search_text',
          description: 'Search text',
        }),
      );
      expect(describedGroup.tools[0]).not.toHaveProperty('method');

      const describeToolResult = await client.callTool({
        name: 'opensumi_describe_tool',
        arguments: { tool: 'search_text' },
      });
      expect(describeToolResult.isError).toBe(false);
      const describedTool = JSON.parse((describeToolResult.content as any)[0].text).result;
      expect(describedTool).toEqual(
        expect.objectContaining({
          name: 'search_text',
          group: 'search',
          description: 'Search text',
        }),
      );
      expect(describedTool).not.toHaveProperty('method');

      const enableTerminalResult = await client.callTool({
        name: 'opensumi_enable_capability_group',
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
            name: 'terminal_run_command',
          }),
        ]),
      );

      const result = await client.callTool({
        name: 'file_read',
        arguments: { path: 'README.md' },
      });

      expect(caller.executeTool).toHaveBeenCalledWith('file', 'file_read', { path: 'README.md' });
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

      const invalidToolResult = await client.callTool({
        name: 'opensumi_invoke_capability_tool',
        arguments: { tool: 'search_text_typo', arguments: { query: 'foo' } },
      });
      expect(invalidToolResult.isError).toBe(true);
      expect(JSON.parse((invalidToolResult.content as any)[0].text)).toMatchObject({
        success: false,
        error: 'TOOL_NOT_FOUND',
      });
      expect(caller.executeTool).toHaveBeenCalledTimes(1);

      const fallbackResult = await client.callTool({
        name: 'opensumi_invoke_capability_tool',
        arguments: { tool: 'search_text', arguments: { query: 'foo' } },
      });
      expect(fallbackResult.isError).toBe(false);
      expect(caller.executeTool).toHaveBeenCalledWith('search', 'search_text', { query: 'foo' });

      const nestedFallbackResult = await client.callTool({
        name: 'opensumi_invoke_capability_tool',
        arguments: { tool: 'search_text', arguments: { arguments: { query: 'bar' } } },
      });
      expect(nestedFallbackResult.isError).toBe(false);
      expect(caller.executeTool).toHaveBeenLastCalledWith('search', 'search_text', { query: 'bar' });

      const nestedInvocationResult = await client.callTool({
        name: 'opensumi_invoke_capability_tool',
        arguments: { arguments: { tool: 'search_text', arguments: { query: 'baz' } } },
      });
      expect(nestedInvocationResult.isError).toBe(false);
      expect(caller.executeTool).toHaveBeenLastCalledWith('search', 'search_text', { query: 'baz' });

      const invalidInvocationResult = await client.callTool({
        name: 'opensumi_invoke_capability_tool',
        arguments: { arguments: { query: 'missing tool' } },
      });
      expect(invalidInvocationResult.isError).toBe(true);
      expect(JSON.parse((invalidInvocationResult.content as any)[0].text)).toMatchObject({
        success: false,
        error: 'INVALID_ARGUMENTS',
      });
    } finally {
      await client.close();
      await server.dispose();
    }
  });
});

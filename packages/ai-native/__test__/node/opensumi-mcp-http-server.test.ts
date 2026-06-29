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
const FILE_MUTATION_TOOL_NAMES = ['file_create', 'file_write', 'file_copy', 'file_move', 'file_delete'];
const EDITOR_TERMINAL_MUTATION_TOOL_NAMES = ['editor_format', 'editor_save', 'terminal_dispose'];

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
  getGroupDefinitions: jest.Mock<Promise<WebMcpGroupDef[]>, [Record<string, unknown>?, string?]>;
  executeTool: jest.Mock<Promise<WebMcpToolResult>, [string, string, Record<string, unknown>, string?]>;
}): OpenSumiMcpHttpServer {
  const server = new OpenSumiMcpHttpServer();
  (server as any).caller = caller;
  (server as any).logger = mockLogger;
  return server;
}

function createFileMutationGroupDefs(profile: 'default' | 'interactive' | 'full'): WebMcpGroupDef[] {
  return [
    {
      name: 'file',
      description: 'File operations',
      defaultLoaded: true,
      profile,
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
        ...FILE_MUTATION_TOOL_NAMES.map((name) => ({
          name,
          description: `${name} test tool`,
          riskLevel: name === 'file_delete' ? 'destructive' : 'write',
          profiles: ['full'],
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
              },
            },
          },
        })),
      ],
    },
  ] as WebMcpGroupDef[];
}

function createEditorTerminalMutationGroupDefs(profile: 'default' | 'interactive' | 'full'): WebMcpGroupDef[] {
  return [
    {
      name: 'editor',
      description: 'Editor operations',
      defaultLoaded: true,
      profile,
      tools: [
        {
          name: 'editor_format',
          description: 'Format editor buffer',
          riskLevel: 'write',
          profiles: ['full'],
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
          name: 'editor_save',
          description: 'Save editor buffer',
          riskLevel: 'write',
          profiles: ['full'],
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
      name: 'terminal',
      description: 'Terminal operations',
      defaultLoaded: true,
      profile,
      tools: [
        {
          name: 'terminal_dispose',
          description: 'Dispose terminal',
          riskLevel: 'destructive',
          profiles: ['full'],
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
              },
            },
            required: ['id'],
          },
        },
      ],
    },
  ] as WebMcpGroupDef[];
}

async function listMcpToolNames(groupDefs: WebMcpGroupDef[]): Promise<string[]> {
  const caller = {
    getGroupDefinitions: jest.fn().mockResolvedValue(groupDefs),
    executeTool: jest.fn().mockResolvedValue({
      success: true,
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
    return tools.tools.map((tool) => tool.name).sort();
  } finally {
    await client.close();
    await server.dispose();
  }
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
    expect(server.getConnectionInfo()).toEqual({
      name: 'opensumi-ide',
      type: 'http',
      transport: 'streamable-http',
      url: fullUrl,
      redactedUrl: expect.stringContaining('/mcp/<redacted>'),
      headers: [],
    });
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

      for (const helperTool of [
        'opensumi_discover_capabilities',
        'opensumi_describe_capability_group',
        'opensumi_describe_tool',
      ]) {
        const helperDescriptionResult = await client.callTool({
          name: 'opensumi_describe_tool',
          arguments: { tool: helperTool },
        });
        expect(helperDescriptionResult.isError).toBe(false);
        expect(JSON.parse((helperDescriptionResult.content as any)[0].text)).toMatchObject({
          success: true,
          result: {
            name: helperTool,
            group: 'opensumi',
            inputSchema: expect.objectContaining({
              type: 'object',
            }),
          },
        });
      }

      const catalogGroupDescriptionResult = await client.callTool({
        name: 'opensumi_describe_capability_group',
        arguments: { group: 'opensumi', includeSchemas: true },
      });
      expect(catalogGroupDescriptionResult.isError).toBe(false);
      expect(JSON.parse((catalogGroupDescriptionResult.content as any)[0].text)).toMatchObject({
        success: true,
        result: {
          group: 'opensumi',
          toolCount: expect.any(Number),
          tools: expect.arrayContaining([
            expect.objectContaining({
              name: 'opensumi_describe_tool',
              inputSchema: expect.objectContaining({
                type: 'object',
              }),
            }),
          ]),
        },
      });

      const discoverResult = await client.callTool({
        name: 'opensumi_discover_capabilities',
        arguments: { task: 'search for a symbol' },
      });
      expect(discoverResult.isError).toBe(false);
      expect(JSON.parse((discoverResult.content as any)[0].text).result.recommended).toEqual([]);

      const enableResult = await client.callTool({
        name: 'opensumi_enable_capability_group',
        arguments: { group: 'search' },
      });
      expect(enableResult.isError).toBe(false);

      const toolsAfterEnable = await client.listTools();
      expect(toolsAfterEnable.tools).toEqual(
        expect.not.arrayContaining([
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
      expect(describedGroup.tools).toEqual([]);

      const describeToolResult = await client.callTool({
        name: 'opensumi_describe_tool',
        arguments: { tool: 'search_text' },
      });
      expect(describeToolResult.isError).toBe(true);
      expect(JSON.parse((describeToolResult.content as any)[0].text)).toMatchObject({
        success: false,
        error: 'CAPABILITY_NOT_AVAILABLE',
      });

      const enableTerminalResult = await client.callTool({
        name: 'opensumi_enable_capability_group',
        arguments: { group: 'terminal' },
      });
      expect(enableTerminalResult.isError).toBe(false);

      const toolsAfterTerminalEnable = await client.listTools();
      expect(toolsAfterTerminalEnable.tools).toEqual(
        expect.not.arrayContaining([
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

      expect(caller.executeTool).toHaveBeenCalledWith('file', 'file_read', { path: 'README.md' }, undefined);
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

      const deniedSearchResult = await client.callTool({
        name: 'opensumi_invoke_capability_tool',
        arguments: { tool: 'search_text', arguments: { query: 'foo' } },
      });
      expect(deniedSearchResult.isError).toBe(true);
      expect(JSON.parse((deniedSearchResult.content as any)[0].text)).toMatchObject({
        success: false,
        error: 'CAPABILITY_NOT_ENABLED',
      });
      expect(caller.executeTool).toHaveBeenCalledTimes(1);

      const deniedTerminalResult = await client.callTool({
        name: 'opensumi_invoke_capability_tool',
        arguments: { tool: 'terminal_run_command', arguments: { id: '1', command: 'pwd' } },
      });
      expect(deniedTerminalResult.isError).toBe(true);
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
        arguments: { tool: 'file_read', arguments: { path: 'README.md' } },
      });
      expect(fallbackResult.isError).toBe(false);
      expect(caller.executeTool).toHaveBeenCalledWith('file', 'file_read', { path: 'README.md' }, undefined);

      const nestedFallbackResult = await client.callTool({
        name: 'opensumi_invoke_capability_tool',
        arguments: { tool: 'file_read', arguments: { arguments: { path: 'README.md' } } },
      });
      expect(nestedFallbackResult.isError).toBe(false);
      expect(caller.executeTool).toHaveBeenLastCalledWith('file', 'file_read', { path: 'README.md' }, undefined);

      const nestedInvocationResult = await client.callTool({
        name: 'opensumi_invoke_capability_tool',
        arguments: { arguments: { tool: 'file_read', arguments: { path: 'README.md' } } },
      });
      expect(nestedInvocationResult.isError).toBe(false);
      expect(caller.executeTool).toHaveBeenLastCalledWith('file', 'file_read', { path: 'README.md' }, undefined);

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

  it('exposes full-profile file mutation tools through MCP tools/list only in the full profile', async () => {
    await expect(listMcpToolNames(createFileMutationGroupDefs('default'))).resolves.not.toEqual(
      expect.arrayContaining(FILE_MUTATION_TOOL_NAMES),
    );
    await expect(listMcpToolNames(createFileMutationGroupDefs('interactive'))).resolves.not.toEqual(
      expect.arrayContaining(FILE_MUTATION_TOOL_NAMES),
    );
    await expect(listMcpToolNames(createFileMutationGroupDefs('full'))).resolves.toEqual(
      expect.arrayContaining(FILE_MUTATION_TOOL_NAMES),
    );
  });

  it('routes MCP sessions to the browser client id embedded in the connection URL', async () => {
    const caller = {
      getGroupDefinitions: jest.fn(async (_options?: Record<string, unknown>, clientId?: string) =>
        createFileMutationGroupDefs(clientId === 'client-full' ? 'full' : 'interactive'),
      ),
      executeTool: jest.fn().mockResolvedValue({
        success: true,
      }),
    };
    const server = createServer(caller);
    await server.start();
    const connection = server.getConnectionInfo('client-full');
    expect(connection.url).toContain('clientId=client-full');
    expect(connection.redactedUrl).toContain('clientId=%3Credacted%3E');
    expect(connection.redactedUrl).not.toContain('client-full');

    const client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      },
    );
    const transport = new StreamableHTTPClientTransport(new URL(connection.url));

    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining(FILE_MUTATION_TOOL_NAMES));
      expect(caller.getGroupDefinitions).toHaveBeenCalledWith({ includeAllTools: true }, 'client-full');

      const fallbackResult = await client.callTool({
        name: 'opensumi_invoke_capability_tool',
        arguments: { tool: 'file_create', arguments: { path: '.tmp/acp-bdd/source.txt', content: 'hello' } },
      });
      expect(fallbackResult.isError).toBe(false);
      expect(caller.executeTool).toHaveBeenCalledWith(
        'file',
        'file_create',
        { path: '.tmp/acp-bdd/source.txt', content: 'hello' },
        'client-full',
      );
    } finally {
      await client.close();
      await server.dispose();
    }
  });

  it('exposes full-profile editor and terminal mutation tools through MCP tools/list only in the full profile', async () => {
    await expect(listMcpToolNames(createEditorTerminalMutationGroupDefs('default'))).resolves.not.toEqual(
      expect.arrayContaining(EDITOR_TERMINAL_MUTATION_TOOL_NAMES),
    );
    await expect(listMcpToolNames(createEditorTerminalMutationGroupDefs('interactive'))).resolves.not.toEqual(
      expect.arrayContaining(EDITOR_TERMINAL_MUTATION_TOOL_NAMES),
    );
    await expect(listMcpToolNames(createEditorTerminalMutationGroupDefs('full'))).resolves.toEqual(
      expect.arrayContaining(EDITOR_TERMINAL_MUTATION_TOOL_NAMES),
    );
  });
});

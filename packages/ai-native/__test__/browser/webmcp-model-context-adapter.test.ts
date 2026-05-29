jest.mock('@opensumi/ide-core-browser/lib/webmcp-polyfill', () => ({
  ensureModelContext: jest.fn(),
}));

import {
  getWebMcpModelContextToolDefinitions,
  registerWebMcpModelContextTools,
} from '../../src/browser/acp/webmcp-model-context-adapter';

import type { WebMcpGroupRegistry } from '../../src/browser/acp/webmcp-group-registry';

describe('WebMCP modelContext adapter', () => {
  function createRegistry() {
    return {
      getGroupDefinitions: jest.fn().mockReturnValue([
        {
          name: 'file',
          description: 'File operations',
          defaultLoaded: true,
          tools: [
            {
              name: 'file_read',
              description: 'Read file',
              riskLevel: 'read',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                },
                required: ['path'],
              },
            },
            {
              name: 'file_write',
              description: 'Write file',
              riskLevel: 'write',
              exposedByDefault: false,
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  content: { type: 'string' },
                },
                required: ['path', 'content'],
              },
            },
          ],
        },
        {
          name: 'hidden',
          description: 'Hidden group',
          defaultLoaded: false,
          tools: [
            {
              name: 'hidden_read',
              description: 'Hidden read',
              riskLevel: 'read',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
          ],
        },
      ]),
      executeTool: jest.fn().mockResolvedValue({ success: true, result: { content: 'ok' } }),
    } as unknown as WebMcpGroupRegistry & {
      getGroupDefinitions: jest.Mock;
      executeTool: jest.Mock;
    };
  }

  beforeEach(() => {
    const registeredTools = new Map<string, any>();
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: {
        modelContext: {
          registerTool: jest.fn((tool) => {
            registeredTools.set(tool.name, tool);
            return {
              dispose: jest.fn(() => registeredTools.delete(tool.name)),
            };
          }),
          getTools: jest.fn(() => Array.from(registeredTools.values())),
        },
      },
    });
  });

  it('derives modelContext tools from the group registry', () => {
    const registry = createRegistry();

    const tools = getWebMcpModelContextToolDefinitions(registry);

    expect(registry.getGroupDefinitions).toHaveBeenCalledWith({ includeAllTools: false });
    expect(tools.map((tool) => tool.name)).toEqual(['file_read']);
    expect(tools[0]).toMatchObject({
      group: 'file',
      name: 'file_read',
      description: 'Read file',
    });
  });

  it('can explicitly include non-default groups', () => {
    const registry = createRegistry();

    const tools = getWebMcpModelContextToolDefinitions(registry, {
      defaultLoadedOnly: false,
      includeAllTools: true,
    });

    expect(registry.getGroupDefinitions).toHaveBeenCalledWith({
      defaultLoadedOnly: false,
      includeAllTools: true,
    });
    expect(tools.map((tool) => tool.name)).toEqual(['file_read', 'hidden_read']);
  });

  it('registers and executes canonical tool names', async () => {
    const registry = createRegistry();

    const disposable = registerWebMcpModelContextTools(registry);
    const modelContext = (global as any).navigator.modelContext;
    const registeredTool = modelContext.registerTool.mock.calls[0][0];

    expect(registeredTool.name).toBe('file_read');

    const result = await registeredTool.execute({ path: 'README.md' });

    expect(registry.executeTool).toHaveBeenCalledWith('file', 'file_read', { path: 'README.md' });
    expect(result).toEqual({ success: true, result: { content: 'ok' } });

    disposable.dispose();
    expect(modelContext.registerTool.mock.results[0].value.dispose).toHaveBeenCalled();
  });
});

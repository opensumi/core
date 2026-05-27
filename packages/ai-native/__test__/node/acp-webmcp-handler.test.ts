import { AcpWebMcpHandler } from '../../src/node/acp/acp-webmcp-handler';

import type { WebMcpGroupDef, WebMcpToolResult } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

const testGroupDefs: WebMcpGroupDef[] = [
  {
    name: 'file',
    description: 'File operations',
    defaultLoaded: true,
    tools: [
      {
        method: '_opensumi/file/read',
        description: 'Read file',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
      },
      {
        method: '_opensumi/file/write',
        description: 'Write file',
        inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } },
      },
    ],
  },
  {
    name: 'git',
    description: 'Git operations',
    defaultLoaded: false,
    tools: [
      { method: '_opensumi/git/status', description: 'Git status', inputSchema: { type: 'object', properties: {} } },
    ],
  },
];

const mockCaller = {
  getGroupDefinitions: jest.fn<Promise<WebMcpGroupDef[]>, []>(),
  executeTool: jest.fn<Promise<WebMcpToolResult>, [string, string, Record<string, unknown>]>(),
};

function createHandler(logger?: {
  warn?: (...args: unknown[]) => void;
  debug?: (...args: unknown[]) => void;
}): AcpWebMcpHandler {
  return new AcpWebMcpHandler(mockCaller as any, logger);
}

describe('AcpWebMcpHandler', () => {
  let handler: AcpWebMcpHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCaller.getGroupDefinitions.mockResolvedValue(testGroupDefs);
    handler = createHandler();
  });

  describe('initialize()', () => {
    it('should load group definitions from caller', async () => {
      await handler.ensureInitialized();
      expect(mockCaller.getGroupDefinitions).toHaveBeenCalledTimes(1);
    });

    it('should auto-load default groups', async () => {
      await handler.ensureInitialized();
      const result = await handler.handleExtMethod('_opensumi/webmcp/list_groups', {});
      const groups = (result as any).groups;
      const fileGroup = groups.find((g: any) => g.name === 'file');
      const gitGroup = groups.find((g: any) => g.name === 'git');
      expect(fileGroup.loaded).toBe(true);
      expect(gitGroup.loaded).toBe(false);
    });

    it('should count tools from default groups', async () => {
      await handler.ensureInitialized();
      const result = await handler.handleExtMethod('_opensumi/webmcp/load_group', { name: 'git' });
      // file group has 2 tools (auto-loaded), git has 1 tool (just loaded) = 3
      expect((result as any).totalLoadedToolCount).toBe(3);
    });

    it('should set groupDefs to empty array on caller failure', async () => {
      mockCaller.getGroupDefinitions.mockRejectedValue(new Error('RPC failed'));
      const warn = jest.fn();
      const handlerWithLogger = createHandler({ warn });

      await handlerWithLogger.ensureInitialized();

      expect(warn).toHaveBeenCalledWith(
        '[AcpWebMcpHandler] Failed to initialize group definitions:',
        expect.any(Error),
      );
      const result = await handlerWithLogger.handleExtMethod('_opensumi/webmcp/list_groups', {});
      expect((result as any).groups).toEqual([]);
    });
  });

  describe('handleExtMethod("_opensumi/webmcp/list_groups")', () => {
    it('should return all groups with tools details', async () => {
      await handler.ensureInitialized();
      const result = await handler.handleExtMethod('_opensumi/webmcp/list_groups', {});

      expect(result).toEqual({
        groups: [
          {
            name: 'file',
            description: 'File operations',
            defaultLoaded: true,
            loaded: true,
            tools: [
              { method: '_opensumi/file/read', description: 'Read file', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
              { method: '_opensumi/file/write', description: 'Write file', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } } },
            ],
          },
          {
            name: 'git',
            description: 'Git operations',
            defaultLoaded: false,
            loaded: false,
            tools: [
              { method: '_opensumi/git/status', description: 'Git status', inputSchema: { type: 'object', properties: {} } },
            ],
          },
        ],
      });
    });

    it('should auto-initialize on first handleExtMethod call', async () => {
      // handleExtMethod calls ensureInitialized() lazily, so it auto-initializes
      const result = await handler.handleExtMethod('_opensumi/webmcp/list_groups', {});
      expect((result as any).groups.length).toBeGreaterThan(0);
      expect(mockCaller.getGroupDefinitions).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleExtMethod("_opensumi/webmcp/load_group")', () => {
    it('should load a non-default group and return its tools', async () => {
      await handler.ensureInitialized();
      const result = await handler.handleExtMethod('_opensumi/webmcp/load_group', { name: 'git' });

      expect(result).toEqual({
        group: 'git',
        tools: [
          { method: '_opensumi/git/status', description: 'Git status', inputSchema: { type: 'object', properties: {} } },
        ],
        totalLoadedToolCount: 3,
      });
    });

    it('should return current state if group is already loaded', async () => {
      await handler.ensureInitialized();
      // file is default-loaded, loading again should return without error
      const result = await handler.handleExtMethod('_opensumi/webmcp/load_group', { name: 'file' });

      expect(result).toEqual({
        group: 'file',
        tools: [
          { method: '_opensumi/file/read', description: 'Read file', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
          { method: '_opensumi/file/write', description: 'Write file', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } } },
        ],
        totalLoadedToolCount: 2,
      });
    });

    it('should return GROUP_NOT_FOUND for unknown group', async () => {
      await handler.ensureInitialized();
      const result = await handler.handleExtMethod('_opensumi/webmcp/load_group', { name: 'unknown' });

      expect(result).toEqual({
        error: 'GROUP_NOT_FOUND',
        details: 'Group "unknown" not found',
      });
    });
  });

  describe('handleExtMethod("_opensumi/webmcp/unload_group")', () => {
    it('should unload a loaded group and decrement tool count', async () => {
      await handler.ensureInitialized();
      // First load git
      await handler.handleExtMethod('_opensumi/webmcp/load_group', { name: 'git' });
      // Then unload it
      const result = await handler.handleExtMethod('_opensumi/webmcp/unload_group', { name: 'git' });

      expect(result).toEqual({
        group: 'git',
        unloadedMethods: ['_opensumi/git/status'],
        totalLoadedToolCount: 2,
      });
    });

    it('should return empty unloadedMethods for already-unloaded group', async () => {
      await handler.ensureInitialized();
      // git is not loaded by default
      const result = await handler.handleExtMethod('_opensumi/webmcp/unload_group', { name: 'git' });

      expect(result).toEqual({
        group: 'git',
        unloadedMethods: [],
        totalLoadedToolCount: 2,
      });
    });

    it('should return GROUP_NOT_FOUND for unknown group', async () => {
      await handler.ensureInitialized();
      const result = await handler.handleExtMethod('_opensumi/webmcp/unload_group', { name: 'nonexistent' });

      expect(result).toEqual({
        error: 'GROUP_NOT_FOUND',
        details: 'Group "nonexistent" not found',
      });
    });

    it('should decrement totalLoadedToolCount when unloading a default group', async () => {
      await handler.ensureInitialized();
      const result = await handler.handleExtMethod('_opensumi/webmcp/unload_group', { name: 'file' });

      expect(result).toEqual({
        group: 'file',
        unloadedMethods: ['_opensumi/file/read', '_opensumi/file/write'],
        totalLoadedToolCount: 0,
      });
    });
  });

  describe('handleExtMethod("_opensumi/{group}/{action}")', () => {
    it('should execute a tool in a loaded group via caller', async () => {
      await handler.ensureInitialized();
      mockCaller.executeTool.mockResolvedValue({ success: true, result: { content: 'hello' } });

      const result = await handler.handleExtMethod('_opensumi/file/read', { path: '/tmp/test.txt' });

      expect(mockCaller.executeTool).toHaveBeenCalledWith('file', 'read', { path: '/tmp/test.txt' });
      expect(result).toEqual({ success: true, result: { content: 'hello' } });
    });

    it('should execute a tool in a manually loaded group', async () => {
      await handler.ensureInitialized();
      await handler.handleExtMethod('_opensumi/webmcp/load_group', { name: 'git' });
      mockCaller.executeTool.mockResolvedValue({ success: true, result: { branch: 'main' } });

      const result = await handler.handleExtMethod('_opensumi/git/status', {});

      expect(mockCaller.executeTool).toHaveBeenCalledWith('git', 'status', {});
      expect(result).toEqual({ success: true, result: { branch: 'main' } });
    });

    it('should return TOOL_NOT_LOADED for unloaded group', async () => {
      await handler.ensureInitialized();
      // git is not loaded by default
      const result = await handler.handleExtMethod('_opensumi/git/status', {});

      expect(result).toEqual({
        success: false,
        error: 'TOOL_NOT_LOADED',
        details: 'Group "git" is not loaded. Call _opensumi/webmcp/load_group first.',
      });
      expect(mockCaller.executeTool).not.toHaveBeenCalled();
    });

    it('should return TOOL_NOT_LOADED after unloading a group', async () => {
      await handler.ensureInitialized();
      await handler.handleExtMethod('_opensumi/webmcp/load_group', { name: 'git' });
      await handler.handleExtMethod('_opensumi/webmcp/unload_group', { name: 'git' });

      const result = await handler.handleExtMethod('_opensumi/git/status', {});

      expect(result).toEqual({
        success: false,
        error: 'TOOL_NOT_LOADED',
        details: 'Group "git" is not loaded. Call _opensumi/webmcp/load_group first.',
      });
    });

    it('should return EXECUTION_ERROR when caller throws', async () => {
      await handler.ensureInitialized();
      mockCaller.executeTool.mockRejectedValue(new Error('tool crashed'));

      const result = await handler.handleExtMethod('_opensumi/file/read', { path: '/bad' });

      expect(result).toEqual({
        success: false,
        error: 'EXECUTION_ERROR',
        details: 'Error: tool crashed',
      });
    });

    it('should return TOOL_NOT_FOUND for invalid method format', async () => {
      await handler.ensureInitialized();
      const result = await handler.handleExtMethod('_opensumi/invalid', {});

      expect(result).toEqual({
        success: false,
        error: 'TOOL_NOT_FOUND',
        details: 'Invalid method: _opensumi/invalid',
      });
    });
  });

  describe('handleExtMethod with unknown method', () => {
    it('should throw method not found error for non-_opensumi methods', async () => {
      await expect(handler.handleExtMethod('unknown_method', {})).rejects.toThrow('Method not found: unknown_method');
    });

    it('should include error code -32601', async () => {
      try {
        await handler.handleExtMethod('unknown_method', {});
        fail('Expected error to be thrown');
      } catch (err: any) {
        expect(err.code).toBe(-32601);
      }
    });
  });

  describe('getCapabilityMeta()', () => {
    it('should return capability metadata with groups and defaults', async () => {
      await handler.ensureInitialized();
      const meta = handler.getCapabilityMeta();

      expect(meta).toEqual({
        opensumi: {
          version: '1.0',
          webmcp: {
            methods: [
              '_opensumi/webmcp/list_groups',
              '_opensumi/webmcp/load_group',
              '_opensumi/webmcp/unload_group',
            ],
            groups: ['file', 'git'],
            defaultLoadedGroups: ['file'],
          },
        },
      });
    });

    it('should return empty arrays before initialize', () => {
      const meta = handler.getCapabilityMeta();

      expect(meta).toEqual({
        opensumi: {
          version: '1.0',
          webmcp: {
            methods: [
              '_opensumi/webmcp/list_groups',
              '_opensumi/webmcp/load_group',
              '_opensumi/webmcp/unload_group',
            ],
            groups: [],
            defaultLoadedGroups: [],
          },
        },
      });
    });
  });
});

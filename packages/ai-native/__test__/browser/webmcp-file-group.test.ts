import { AppConfig } from '@opensumi/ide-core-browser';
import { URI } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import { WEBMCP_PROFILE_SETTING_ID, WebMcpGroupRegistry } from '../../src/browser/acp/webmcp-group-registry';
import { createFileGroup } from '../../src/browser/acp/webmcp-groups/file.webmcp-group';

const workspaceDir = '/workspace/project';
const mutationTools = ['file_create', 'file_write', 'file_copy', 'file_move', 'file_delete'];

function uriOf(path: string): string {
  return URI.file(`${workspaceDir}/${path}`).toString();
}

function createRegistry(profile: string): WebMcpGroupRegistry {
  const registry = new WebMcpGroupRegistry();
  Object.defineProperty(registry, 'preferenceService', {
    value: {
      get: jest.fn((id: string, fallback: string) => (id === WEBMCP_PROFILE_SETTING_ID ? profile : fallback)),
    },
    writable: true,
  });
  registry.registerGroup(createFileGroup({} as any));
  return registry;
}

function createMockFileService() {
  const stats: Record<string, any> = {
    [URI.file(workspaceDir).toString()]: {
      uri: URI.file(workspaceDir).toString(),
      isDirectory: true,
      isSymbolicLink: false,
    },
  };

  const fileService = {
    getFileStat: jest.fn((uri: string) => Promise.resolve(stats[uri])),
    createFile: jest.fn(async (uri: string, options?: { content?: string }) => {
      const stat = {
        uri,
        isDirectory: false,
        isSymbolicLink: false,
        size: options?.content?.length ?? 0,
      };
      stats[uri] = stat;
      return stat;
    }),
    createFolder: jest.fn(async (uri: string) => {
      const stat = {
        uri,
        isDirectory: true,
        isSymbolicLink: false,
      };
      stats[uri] = stat;
      return stat;
    }),
    setContent: jest.fn(async (stat: any, content: string) => {
      stats[stat.uri] = {
        ...stat,
        size: content.length,
      };
      return stats[stat.uri];
    }),
    copy: jest.fn(async (sourceUri: string, targetUri: string) => {
      stats[targetUri] = {
        ...stats[sourceUri],
        uri: targetUri,
      };
      return stats[targetUri];
    }),
    move: jest.fn(async (sourceUri: string, targetUri: string) => {
      stats[targetUri] = {
        ...stats[sourceUri],
        uri: targetUri,
      };
      delete stats[sourceUri];
      return stats[targetUri];
    }),
    delete: jest.fn(async (uri: string) => {
      delete stats[uri];
    }),
  };

  return { fileService, stats };
}

function createContainer(fileService: ReturnType<typeof createMockFileService>['fileService']) {
  return {
    get: jest.fn((token) => {
      if (token === AppConfig) {
        return { workspaceDir };
      }
      if (token === IFileServiceClient) {
        return fileService;
      }
      throw new Error('Unknown token');
    }),
  } as any;
}

function getTool(name: string, fileService = createMockFileService().fileService) {
  const group = createFileGroup(createContainer(fileService));
  const tool = group.tools.find((item) => item.name === name);
  if (!tool) {
    throw new Error(`Missing tool: ${name}`);
  }
  return tool;
}

describe('WebMCP file group', () => {
  it('exposes mutation tools only in the full profile', () => {
    expect(
      createRegistry('default')
        .getGroupDefinitions()[0]
        .tools.map((tool) => tool.name),
    ).not.toEqual(expect.arrayContaining(mutationTools));
    expect(
      createRegistry('interactive')
        .getGroupDefinitions()[0]
        .tools.map((tool) => tool.name),
    ).not.toEqual(expect.arrayContaining(mutationTools));
    expect(
      createRegistry('full')
        .getGroupDefinitions()[0]
        .tools.map((tool) => tool.name),
    ).toEqual(expect.arrayContaining(mutationTools));
  });

  it('advertises BDD-compatible file mutation schemas', () => {
    const group = createFileGroup({} as any);
    const createSchema = group.tools.find((tool) => tool.name === 'file_create')?.inputSchema as any;
    const copySchema = group.tools.find((tool) => tool.name === 'file_copy')?.inputSchema as any;
    const moveSchema = group.tools.find((tool) => tool.name === 'file_move')?.inputSchema as any;

    expect(createSchema.properties.content).toMatchObject({ type: 'string' });
    expect(copySchema.required).toEqual(['sourcePath', 'targetPath']);
    expect(copySchema.properties).toHaveProperty('sourcePath');
    expect(copySchema.properties).toHaveProperty('targetPath');
    expect(moveSchema.required).toEqual(['sourcePath', 'targetPath']);
    expect(moveSchema.properties).toHaveProperty('sourcePath');
    expect(moveSchema.properties).toHaveProperty('targetPath');
  });

  it('executes the reversible file mutation flow with workspace-relative paths', async () => {
    const { fileService, stats } = createMockFileService();
    const group = createFileGroup(createContainer(fileService));
    const execute = async (name: string, params: Record<string, unknown>) => {
      const tool = group.tools.find((item) => item.name === name);
      if (!tool) {
        throw new Error(`Missing tool: ${name}`);
      }
      return tool.execute(params);
    };

    await expect(execute('file_create', { path: '.tmp/acp-bdd/source.txt', content: 'hello' })).resolves.toMatchObject({
      success: true,
    });
    await expect(execute('file_write', { path: '.tmp/acp-bdd/source.txt', content: 'updated' })).resolves.toMatchObject(
      {
        success: true,
      },
    );
    await expect(
      execute('file_copy', {
        sourcePath: '.tmp/acp-bdd/source.txt',
        targetPath: '.tmp/acp-bdd/copy.txt',
      }),
    ).resolves.toMatchObject({ success: true });
    await expect(
      execute('file_move', {
        sourcePath: '.tmp/acp-bdd/copy.txt',
        targetPath: '.tmp/acp-bdd/moved.txt',
      }),
    ).resolves.toMatchObject({ success: true });
    await expect(execute('file_delete', { path: '.tmp/acp-bdd/source.txt' })).resolves.toMatchObject({
      success: true,
    });
    await expect(execute('file_delete', { path: '.tmp/acp-bdd/moved.txt' })).resolves.toMatchObject({
      success: true,
    });

    expect(fileService.createFile).toHaveBeenCalledWith(uriOf('.tmp/acp-bdd/source.txt'), { content: 'hello' });
    expect(fileService.setContent).toHaveBeenCalledWith(
      expect.objectContaining({ uri: uriOf('.tmp/acp-bdd/source.txt') }),
      'updated',
    );
    expect(fileService.copy).toHaveBeenCalledWith(uriOf('.tmp/acp-bdd/source.txt'), uriOf('.tmp/acp-bdd/copy.txt'));
    expect(fileService.move).toHaveBeenCalledWith(uriOf('.tmp/acp-bdd/copy.txt'), uriOf('.tmp/acp-bdd/moved.txt'));
    expect(stats[uriOf('.tmp/acp-bdd/source.txt')]).toBeUndefined();
    expect(stats[uriOf('.tmp/acp-bdd/moved.txt')]).toBeUndefined();
  });

  it('rejects mutation targets outside the workspace', async () => {
    const { fileService } = createMockFileService();
    const createTool = getTool('file_create', fileService);
    const copyTool = getTool('file_copy', fileService);

    await expect(createTool.execute({ path: '../outside.txt', content: 'nope' })).resolves.toMatchObject({
      success: false,
      error: 'INVALID_INPUT',
      details: 'Path is outside of the workspace',
    });
    await expect(
      copyTool.execute({
        sourcePath: '.tmp/acp-bdd/source.txt',
        targetPath: '../outside.txt',
      }),
    ).resolves.toMatchObject({
      success: false,
      error: 'INVALID_INPUT',
      details: 'Path is outside of the workspace',
    });

    expect(fileService.createFile).not.toHaveBeenCalled();
    expect(fileService.copy).not.toHaveBeenCalled();
  });
});

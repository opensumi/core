import { URI } from '@opensumi/ide-core-common';

import {
  resolveWorkspaceFilePath,
  validateWorkspacePathAccess,
  validateWritableWorkspaceTarget,
} from '../../src/browser/acp/webmcp-groups/file-workspace-path';

const workspaceDir = '/workspace/project';

function createFileService(stats: Record<string, any>) {
  return {
    getFileStat: jest.fn((uri: string) => Promise.resolve(stats[uri])),
  } as any;
}

describe('WebMCP file workspace path policy', () => {
  it('allows workspace-relative paths', () => {
    const result = resolveWorkspaceFilePath(workspaceDir, 'src/index.ts');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.absolutePath).toBe('/workspace/project/src/index.ts');
      expect(result.value.uri).toBe(URI.file('/workspace/project/src/index.ts').toString());
    }
  });

  it('allows absolute paths inside the workspace', () => {
    const result = resolveWorkspaceFilePath(workspaceDir, '/workspace/project/README.md');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.absolutePath).toBe('/workspace/project/README.md');
    }
  });

  it('rejects absolute paths outside the workspace', () => {
    const result = resolveWorkspaceFilePath(workspaceDir, '/workspace/secret.txt');

    expect(result).toMatchObject({
      ok: false,
      message: 'Path is outside of the workspace',
    });
  });

  it('rejects path traversal outside the workspace', () => {
    const result = resolveWorkspaceFilePath(workspaceDir, '../secret.txt');

    expect(result).toMatchObject({
      ok: false,
      message: 'Path is outside of the workspace',
    });
  });

  it('rejects URI strings and Windows drive-relative paths', () => {
    expect(resolveWorkspaceFilePath(workspaceDir, 'file:///workspace/project/README.md')).toMatchObject({
      ok: false,
    });
    expect(resolveWorkspaceFilePath('C:\\workspace\\project', 'C:secret.txt')).toMatchObject({
      ok: false,
      message: 'Windows drive-relative paths are not supported',
    });
  });

  it('rejects reads through a symlink ancestor pointing outside the workspace', async () => {
    const linkUri = URI.file('/workspace/project/link-out').toString();
    const fileService = createFileService({
      [linkUri]: {
        uri: linkUri,
        isDirectory: true,
        isSymbolicLink: true,
        realUri: URI.file('/outside').toString(),
      },
    });
    const resolved = resolveWorkspaceFilePath(workspaceDir, 'link-out/file.txt');

    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      await expect(validateWorkspacePathAccess(fileService, workspaceDir, resolved.value)).resolves.toMatchObject({
        ok: false,
        message: 'Symbolic link target is outside of the workspace',
      });
    }
  });

  it('rejects writes through a symlink parent pointing outside the workspace', async () => {
    const linkUri = URI.file('/workspace/project/link-out').toString();
    const fileService = createFileService({
      [linkUri]: {
        uri: linkUri,
        isDirectory: true,
        isSymbolicLink: true,
        realUri: URI.file('/outside').toString(),
      },
    });
    const resolved = resolveWorkspaceFilePath(workspaceDir, 'link-out/new-file.txt');

    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      await expect(validateWritableWorkspaceTarget(fileService, workspaceDir, resolved.value)).resolves.toMatchObject({
        ok: false,
        message: 'Symbolic link target is outside of the workspace',
      });
    }
  });

  it('does not accept authorization flags as a workspace escape hatch', () => {
    const result = resolveWorkspaceFilePath(workspaceDir, '/outside/authorized.txt');

    expect(result.ok).toBe(false);
  });
});

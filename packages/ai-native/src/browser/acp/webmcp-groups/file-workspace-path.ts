import { URI, path } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import type { FileStat } from '@opensumi/ide-core-common';

type PathModule = typeof path.posix;

export interface WorkspacePathResolution {
  absolutePath: string;
  uri: string;
  pathModule: PathModule;
}

export type WorkspacePathResult =
  | {
      ok: true;
      value: WorkspacePathResolution;
    }
  | {
      ok: false;
      message: string;
    };

const URI_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const WINDOWS_DRIVE_ABSOLUTE_PATTERN = /^[a-zA-Z]:[\\/]/;
const WINDOWS_DRIVE_RELATIVE_PATTERN = /^[a-zA-Z]:(?![\\/])/;
const WINDOWS_UNC_PATTERN = /^(?:\\\\|\/\/)[^\\/]+[\\/][^\\/]+/;

function isWindowsPath(value: string): boolean {
  return (
    WINDOWS_DRIVE_ABSOLUTE_PATTERN.test(value) || WINDOWS_DRIVE_RELATIVE_PATTERN.test(value) || value.includes('\\')
  );
}

function selectPathModule(workspaceDir: string, inputPath: string): PathModule {
  return isWindowsPath(workspaceDir) || isWindowsPath(inputPath) ? path.win32 : path.posix;
}

function isUriString(value: string): boolean {
  return (
    URI_SCHEME_PATTERN.test(value) &&
    !WINDOWS_DRIVE_ABSOLUTE_PATTERN.test(value) &&
    !WINDOWS_DRIVE_RELATIVE_PATTERN.test(value)
  );
}

function isPathInsideWorkspace(pathModule: PathModule, workspaceRoot: string, targetPath: string): boolean {
  const relative = pathModule.relative(workspaceRoot, targetPath);
  return relative === '' || (!relative.startsWith('..') && !pathModule.isAbsolute(relative));
}

export function resolveWorkspaceFilePath(workspaceDir: string, inputPath: unknown): WorkspacePathResult {
  if (typeof inputPath !== 'string' || !inputPath.trim()) {
    return { ok: false, message: 'path is required' };
  }
  if (!workspaceDir) {
    return { ok: false, message: 'workspaceDir is required' };
  }

  const rawPath = inputPath.trim();
  if (isUriString(rawPath)) {
    return {
      ok: false,
      message: 'URI paths are not supported; pass a workspace-relative path or workspace-local absolute path',
    };
  }
  if (WINDOWS_DRIVE_RELATIVE_PATTERN.test(rawPath)) {
    return { ok: false, message: 'Windows drive-relative paths are not supported' };
  }

  const pathModule = selectPathModule(workspaceDir, rawPath);
  const workspaceRoot = pathModule.resolve(workspaceDir);
  const isAbsolute = pathModule.isAbsolute(rawPath) || WINDOWS_UNC_PATTERN.test(rawPath);
  const absolutePath = isAbsolute ? pathModule.resolve(rawPath) : pathModule.resolve(workspaceRoot, rawPath);

  if (!isPathInsideWorkspace(pathModule, workspaceRoot, absolutePath)) {
    return { ok: false, message: 'Path is outside of the workspace' };
  }

  return {
    ok: true,
    value: {
      absolutePath,
      uri: URI.file(absolutePath).toString(),
      pathModule,
    },
  };
}

export function validateWorkspaceFileStat(
  workspaceDir: string,
  stat: FileStat | undefined,
  pathModule: PathModule,
): WorkspacePathResult {
  if (!stat) {
    return { ok: false, message: 'File stat is required' };
  }
  if (!stat.isSymbolicLink) {
    return {
      ok: true,
      value: {
        absolutePath: URI.parse(stat.uri).codeUri.fsPath,
        uri: stat.uri,
        pathModule,
      },
    };
  }
  if (!stat.realUri) {
    return { ok: false, message: 'Cannot verify symbolic link target' };
  }

  const realPath = URI.parse(stat.realUri).codeUri.fsPath;
  const workspaceRoot = pathModule.resolve(workspaceDir);
  const realAbsolutePath = pathModule.resolve(realPath);
  if (!isPathInsideWorkspace(pathModule, workspaceRoot, realAbsolutePath)) {
    return { ok: false, message: 'Symbolic link target is outside of the workspace' };
  }

  return {
    ok: true,
    value: {
      absolutePath: realAbsolutePath,
      uri: stat.realUri,
      pathModule,
    },
  };
}

export async function validateWorkspacePathAccess(
  fileService: IFileServiceClient,
  workspaceDir: string,
  resolution: WorkspacePathResolution,
): Promise<WorkspacePathResult> {
  const workspaceRoot = resolution.pathModule.resolve(workspaceDir);
  let currentPath = resolution.absolutePath;

  while (isPathInsideWorkspace(resolution.pathModule, workspaceRoot, currentPath)) {
    const currentStat = await fileService.getFileStat(URI.file(currentPath).toString());
    if (currentStat?.isSymbolicLink) {
      const statValidation = validateWorkspaceFileStat(workspaceDir, currentStat, resolution.pathModule);
      if (!statValidation.ok) {
        return statValidation;
      }
    }

    if (currentPath === workspaceRoot) {
      break;
    }
    const parentPath = resolution.pathModule.dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }
    currentPath = parentPath;
  }

  return { ok: true, value: resolution };
}

export async function validateWritableWorkspaceTarget(
  fileService: IFileServiceClient,
  workspaceDir: string,
  resolution: WorkspacePathResolution,
): Promise<WorkspacePathResult> {
  const existingStat = await fileService.getFileStat(resolution.uri);
  if (existingStat) {
    return validateWorkspaceFileStat(workspaceDir, existingStat, resolution.pathModule);
  }

  const workspaceRoot = resolution.pathModule.resolve(workspaceDir);
  let currentPath = resolution.pathModule.dirname(resolution.absolutePath);
  while (isPathInsideWorkspace(resolution.pathModule, workspaceRoot, currentPath)) {
    const currentStat = await fileService.getFileStat(URI.file(currentPath).toString());
    if (currentStat) {
      return validateWorkspaceFileStat(workspaceDir, currentStat, resolution.pathModule);
    }
    const parentPath = resolution.pathModule.dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }
    currentPath = parentPath;
  }

  return { ok: false, message: 'Cannot verify writable target parent inside workspace' };
}

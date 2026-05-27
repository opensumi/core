/**
 * WebMCP tool registry for file management.
 *
 * Registers browser-side tools on `navigator.modelContext` that allow an external
 * AI agent to interact with the file system — reading, writing, listing, creating,
 * deleting, moving, and copying files.
 *
 * Tools follow the naming convention: file_<action>
 *
 * PHASE 1: Register core file operations with hand-crafted schemas.
 * Phase 2: Later, add more granular tools and refine descriptions.
 */
import { IDisposable, Injector } from '@opensumi/di';
import { AppConfig, path } from '@opensumi/ide-core-browser';
import { URI } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryGetService<T>(container: Injector, token: symbol): T | null {
  try {
    return container.get(token) as T;
  } catch {
    return null;
  }
}

function classifyError(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const name = (err as Error).name || '';
    if (name.includes('Timeout') || name.includes('timeout')) {return 'RPC_TIMEOUT';}
    if (name.includes('Injector') || name.includes('DI')) {return 'DI_ERROR';}
    if (name.includes('Permission') || name.includes('denied')) {return 'PERMISSION_DENIED';}
    if (name.includes('Abort')) {return 'ABORTED';}
    if (name.includes('FileNotFound') || name.includes('ENOENT')) {return 'FILE_NOT_FOUND';}
    if (name.includes('FileExists') || name.includes('EEXIST')) {return 'FILE_EXISTS';}
  }
  return 'EXECUTION_ERROR';
}

function safeErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/[A-Za-z_]*token[A-Za-z_]*[:=\s]+["']?[A-Za-z0-9+/=]+["']?/gi, '[REDACTED]')
    .replace(/[A-Za-z_]*key[A-Za-z_]*[:=\s]+["']?[A-Za-z0-9+/=]+["']?/gi, '[REDACTED]')
    .substring(0, 200);
}

function resolveWorkspacePath(workspaceDir: string, relativePath: string): string {
  return path.join(workspaceDir, relativePath);
}

function toUri(filePath: string): string {
  return URI.file(filePath).toString();
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export function registerFileWebMCPTools(container: Injector): IDisposable {
  const ensureModelContext = () => {
    if (!navigator.modelContext) {
      throw new Error('navigator.modelContext is not available');
    }
  };
  ensureModelContext();

  const ctx = navigator.modelContext!;
  const controller = new AbortController();

  // ----- file_getWorkspaceRoot -----
  ctx.registerTool(
    {
      name: 'file_getWorkspaceRoot',
      description:
        'Get the absolute path of the current workspace root directory. Use this to understand the base path for relative file operations.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const appConfig = tryGetService<AppConfig>(container, AppConfig);
        if (!appConfig) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'AppConfig not registered in DI container',
          };
        }
        try {
          return {
            success: true,
            result: {
              workspaceRoot: appConfig.workspaceDir,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- file_read -----
  ctx.registerTool(
    {
      name: 'file_read',
      description:
        'Read the contents of a file. Returns the file content as text. Use relative paths from the workspace root.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The relative path of the file to read, from the workspace root.',
          },
        },
        required: ['path'],
      },
      execute: async (args: { path: string }) => {
        if (!args.path) {
          return {
            success: false,
            error: 'INVALID_INPUT',
            details: 'path is required',
          };
        }
        const appConfig = tryGetService<AppConfig>(container, AppConfig);
        if (!appConfig || !appConfig.workspaceDir) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'No workspace directory available',
          };
        }
        const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
        if (!fileService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IFileServiceClient not registered in DI container',
          };
        }
        try {
          const absolutePath = resolveWorkspacePath(appConfig.workspaceDir, args.path);
          const uri = toUri(absolutePath);
          const fileStat = await fileService.getFileStat(uri);
          if (!fileStat) {
            return {
              success: false,
              error: 'FILE_NOT_FOUND',
              details: `File not found: ${args.path}`,
            };
          }
          if (fileStat.isDirectory) {
            return {
              success: false,
              error: 'IS_DIRECTORY',
              details: `Path is a directory, not a file: ${args.path}`,
            };
          }
          const result = await fileService.readFile(uri);
          const content = result.content.toString();
          return {
            success: true,
            result: {
              path: args.path,
              content,
              size: content.length,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- file_write -----
  ctx.registerTool(
    {
      name: 'file_write',
      description:
        'Write content to a file. Creates the file if it does not exist, overwrites if it does. Creates parent directories automatically.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The relative path of the file to write, from the workspace root.',
          },
          content: {
            type: 'string',
            description: 'The content to write to the file.',
          },
        },
        required: ['path', 'content'],
      },
      execute: async (args: { path: string; content: string }) => {
        if (!args.path || args.content === undefined) {
          return {
            success: false,
            error: 'INVALID_INPUT',
            details: 'path and content are required',
          };
        }
        const appConfig = tryGetService<AppConfig>(container, AppConfig);
        if (!appConfig || !appConfig.workspaceDir) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'No workspace directory available',
          };
        }
        const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
        if (!fileService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IFileServiceClient not registered in DI container',
          };
        }
        try {
          const absolutePath = resolveWorkspacePath(appConfig.workspaceDir, args.path);
          const uri = toUri(absolutePath);
          const existingStat = await fileService.getFileStat(uri);

          let result: any;
          if (existingStat) {
            result = await fileService.setContent(existingStat, args.content);
          } else {
            result = await fileService.createFile(uri, { content: args.content });
          }
          return {
            success: true,
            result: {
              path: args.path,
              written: true,
              size: args.content.length,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- file_list -----
  ctx.registerTool(
    {
      name: 'file_list',
      description:
        'List the contents of a directory. Returns an array of file/directory entries with metadata. Use "." for the workspace root.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              'The relative path of the directory to list, from the workspace root. Use "." for workspace root.',
          },
        },
        required: ['path'],
      },
      execute: async (args: { path: string }) => {
        if (!args.path) {
          return {
            success: false,
            error: 'INVALID_INPUT',
            details: 'path is required',
          };
        }
        const appConfig = tryGetService<AppConfig>(container, AppConfig);
        if (!appConfig || !appConfig.workspaceDir) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'No workspace directory available',
          };
        }
        const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
        if (!fileService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IFileServiceClient not registered in DI container',
          };
        }
        try {
          const absolutePath = resolveWorkspacePath(appConfig.workspaceDir, args.path);
          const uri = toUri(absolutePath);
          const fileStat = await fileService.getFileStat(uri, true);
          if (!fileStat) {
            return {
              success: false,
              error: 'FILE_NOT_FOUND',
              details: `Directory not found: ${args.path}`,
            };
          }
          if (!fileStat.isDirectory) {
            return {
              success: false,
              error: 'NOT_A_DIRECTORY',
              details: `Path is a file, not a directory: ${args.path}`,
            };
          }
          const entries = (fileStat.children || []).map((child: any) => ({
            name: child.uri ? child.uri.split('/').pop() : 'unknown',
            isDirectory: child.isDirectory,
            size: child.size,
          }));
          return {
            success: true,
            result: {
              path: args.path,
              entries,
              total: entries.length,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- file_stat -----
  ctx.registerTool(
    {
      name: 'file_stat',
      description:
        'Get metadata about a file or directory. Returns size, isDirectory, lastModified, and other stat info.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The relative path of the file or directory, from the workspace root.',
          },
        },
        required: ['path'],
      },
      execute: async (args: { path: string }) => {
        if (!args.path) {
          return {
            success: false,
            error: 'INVALID_INPUT',
            details: 'path is required',
          };
        }
        const appConfig = tryGetService<AppConfig>(container, AppConfig);
        if (!appConfig || !appConfig.workspaceDir) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'No workspace directory available',
          };
        }
        const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
        if (!fileService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IFileServiceClient not registered in DI container',
          };
        }
        try {
          const absolutePath = resolveWorkspacePath(appConfig.workspaceDir, args.path);
          const uri = toUri(absolutePath);
          const fileStat = await fileService.getFileStat(uri);
          if (!fileStat) {
            return {
              success: false,
              error: 'FILE_NOT_FOUND',
              details: `Path not found: ${args.path}`,
            };
          }
          return {
            success: true,
            result: {
              path: args.path,
              isDirectory: fileStat.isDirectory,
              size: fileStat.size,
              lastModified: fileStat.lastModification,
              isReadonly: fileStat.readonly,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- file_exists -----
  ctx.registerTool(
    {
      name: 'file_exists',
      description: 'Check whether a file or directory exists at the given path. Returns true or false.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The relative path to check, from the workspace root.',
          },
        },
        required: ['path'],
      },
      execute: async (args: { path: string }) => {
        if (!args.path) {
          return {
            success: false,
            error: 'INVALID_INPUT',
            details: 'path is required',
          };
        }
        const appConfig = tryGetService<AppConfig>(container, AppConfig);
        if (!appConfig || !appConfig.workspaceDir) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'No workspace directory available',
          };
        }
        const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
        if (!fileService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IFileServiceClient not registered in DI container',
          };
        }
        try {
          const absolutePath = resolveWorkspacePath(appConfig.workspaceDir, args.path);
          const uri = toUri(absolutePath);
          const exists = await fileService.access(uri);
          return {
            success: true,
            result: {
              path: args.path,
              exists,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- file_create -----
  ctx.registerTool(
    {
      name: 'file_create',
      description:
        'Create an empty file or a new directory. Use "type: directory" to create a folder instead of a file.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The relative path to create, from the workspace root.',
          },
          type: {
            type: 'string',
            enum: ['file', 'directory'],
            description: 'Whether to create a "file" or "directory". Defaults to "file".',
          },
        },
        required: ['path'],
      },
      execute: async (args: { path: string; type?: 'file' | 'directory' }) => {
        if (!args.path) {
          return {
            success: false,
            error: 'INVALID_INPUT',
            details: 'path is required',
          };
        }
        const appConfig = tryGetService<AppConfig>(container, AppConfig);
        if (!appConfig || !appConfig.workspaceDir) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'No workspace directory available',
          };
        }
        const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
        if (!fileService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IFileServiceClient not registered in DI container',
          };
        }
        try {
          const absolutePath = resolveWorkspacePath(appConfig.workspaceDir, args.path);
          const uri = toUri(absolutePath);
          const existingStat = await fileService.getFileStat(uri);
          if (existingStat) {
            return {
              success: false,
              error: 'FILE_EXISTS',
              details: `Path already exists: ${args.path}`,
            };
          }
          let result: any;
          if (args.type === 'directory') {
            result = await fileService.createFolder(uri);
          } else {
            result = await fileService.createFile(uri);
          }
          return {
            success: true,
            result: {
              path: args.path,
              type: args.type || 'file',
              created: true,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- file_delete -----
  ctx.registerTool(
    {
      name: 'file_delete',
      description: 'Delete a file or directory. Use recursive: true to delete a directory and its contents.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The relative path to delete, from the workspace root.',
          },
          recursive: {
            type: 'boolean',
            description: 'Whether to delete a directory and all its contents. Required for directories.',
          },
        },
        required: ['path'],
      },
      execute: async (args: { path: string; recursive?: boolean }) => {
        if (!args.path) {
          return {
            success: false,
            error: 'INVALID_INPUT',
            details: 'path is required',
          };
        }
        const appConfig = tryGetService<AppConfig>(container, AppConfig);
        if (!appConfig || !appConfig.workspaceDir) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'No workspace directory available',
          };
        }
        const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
        if (!fileService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IFileServiceClient not registered in DI container',
          };
        }
        try {
          const absolutePath = resolveWorkspacePath(appConfig.workspaceDir, args.path);
          const uri = toUri(absolutePath);
          const existingStat = await fileService.getFileStat(uri);
          if (!existingStat) {
            return {
              success: false,
              error: 'FILE_NOT_FOUND',
              details: `Path not found: ${args.path}`,
            };
          }
          if (existingStat.isDirectory && !args.recursive) {
            return {
              success: false,
              error: 'IS_DIRECTORY',
              details: 'Path is a directory. Use recursive: true to delete directories.',
            };
          }
          await fileService.delete(uri);
          return {
            success: true,
            result: {
              path: args.path,
              deleted: true,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- file_move -----
  ctx.registerTool(
    {
      name: 'file_move',
      description: 'Move or rename a file or directory from sourcePath to targetPath.',
      inputSchema: {
        type: 'object',
        properties: {
          sourcePath: {
            type: 'string',
            description: 'The relative source path to move, from the workspace root.',
          },
          targetPath: {
            type: 'string',
            description: 'The relative target path to move to, from the workspace root.',
          },
        },
        required: ['sourcePath', 'targetPath'],
      },
      execute: async (args: { sourcePath: string; targetPath: string }) => {
        if (!args.sourcePath || !args.targetPath) {
          return {
            success: false,
            error: 'INVALID_INPUT',
            details: 'sourcePath and targetPath are required',
          };
        }
        const appConfig = tryGetService<AppConfig>(container, AppConfig);
        if (!appConfig || !appConfig.workspaceDir) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'No workspace directory available',
          };
        }
        const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
        if (!fileService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IFileServiceClient not registered in DI container',
          };
        }
        try {
          const sourceAbsolute = resolveWorkspacePath(appConfig.workspaceDir, args.sourcePath);
          const targetAbsolute = resolveWorkspacePath(appConfig.workspaceDir, args.targetPath);
          const sourceUri = toUri(sourceAbsolute);
          const targetUri = toUri(targetAbsolute);
          const result = await fileService.move(sourceUri, targetUri);
          return {
            success: true,
            result: {
              sourcePath: args.sourcePath,
              targetPath: args.targetPath,
              moved: true,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- file_copy -----
  ctx.registerTool(
    {
      name: 'file_copy',
      description: 'Copy a file or directory from sourcePath to targetPath.',
      inputSchema: {
        type: 'object',
        properties: {
          sourcePath: {
            type: 'string',
            description: 'The relative source path to copy, from the workspace root.',
          },
          targetPath: {
            type: 'string',
            description: 'The relative target path to copy to, from the workspace root.',
          },
        },
        required: ['sourcePath', 'targetPath'],
      },
      execute: async (args: { sourcePath: string; targetPath: string }) => {
        if (!args.sourcePath || !args.targetPath) {
          return {
            success: false,
            error: 'INVALID_INPUT',
            details: 'sourcePath and targetPath are required',
          };
        }
        const appConfig = tryGetService<AppConfig>(container, AppConfig);
        if (!appConfig || !appConfig.workspaceDir) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'No workspace directory available',
          };
        }
        const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
        if (!fileService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IFileServiceClient not registered in DI container',
          };
        }
        try {
          const sourceAbsolute = resolveWorkspacePath(appConfig.workspaceDir, args.sourcePath);
          const targetAbsolute = resolveWorkspacePath(appConfig.workspaceDir, args.targetPath);
          const sourceUri = toUri(sourceAbsolute);
          const targetUri = toUri(targetAbsolute);
          await fileService.copy(sourceUri, targetUri);
          return {
            success: true,
            result: {
              sourcePath: args.sourcePath,
              targetPath: args.targetPath,
              copied: true,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  return { dispose: () => controller.abort() };
}

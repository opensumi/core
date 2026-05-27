/**
 * WebMCP group definition for file management.
 *
 * Mirrors the file_* tools from webmcp-file-tools.registry.ts but wrapped
 * in the WebMcpGroupRegistration interface for the ACP channel.
 *
 * Tools follow the naming convention: _opensumi/file/{action}
 */
import { Injector } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-browser';
import { URI } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import { WebMcpGroupRegistration, WebMcpToolExecute } from '../webmcp-group-registry';
import { classifyError, errorResult, serviceUnavailableResult, successResult, tryGetService } from '../webmcp-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveWorkspacePath(workspaceDir: string, relativePath: string): string {
  if (relativePath.startsWith('/')) {
    return relativePath;
  }
  return `${workspaceDir}/${relativePath}`.replace(/\/+/g, '/');
}

function toUri(filePath: string): string {
  return URI.file(filePath).toString();
}

// ---------------------------------------------------------------------------
// Group definition
// ---------------------------------------------------------------------------

export function createFileGroup(container: Injector): WebMcpGroupRegistration {
  return {
    name: 'file',
    description: '文件读写和管理操作',
    defaultLoaded: true,
    tools: [
      // ----- _opensumi/file/getWorkspaceRoot -----
      {
        method: '_opensumi/file/getWorkspaceRoot',
        description:
          'Get the absolute path of the current workspace root directory. Use this to understand the base path for relative file operations.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const appConfig = tryGetService<AppConfig>(container, AppConfig);
          if (!appConfig) {
            return serviceUnavailableResult('AppConfig');
          }
          try {
            return successResult({ workspaceRoot: appConfig.workspaceDir });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- _opensumi/file/read -----
      {
        method: '_opensumi/file/read',
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
        execute: async (params: Record<string, unknown>) => {
          const filePath = params.path as string;
          if (!filePath) {
            return errorResult('INVALID_INPUT', new Error('path is required'));
          }
          const appConfig = tryGetService<AppConfig>(container, AppConfig);
          if (!appConfig || !appConfig.workspaceDir) {
            return serviceUnavailableResult('AppConfig');
          }
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) {
            return serviceUnavailableResult('IFileServiceClient');
          }
          try {
            const absolutePath = resolveWorkspacePath(appConfig.workspaceDir, filePath);
            const uri = toUri(absolutePath);
            const fileStat = await fileService.getFileStat(uri);
            if (!fileStat) {
              return errorResult('FILE_NOT_FOUND', new Error(`File not found: ${filePath}`));
            }
            if (fileStat.isDirectory) {
              return errorResult('IS_DIRECTORY', new Error(`Path is a directory, not a file: ${filePath}`));
            }
            const result = await fileService.readFile(uri);
            const content = result.content.toString();
            return successResult({ path: filePath, content, size: content.length });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- _opensumi/file/write -----
      {
        method: '_opensumi/file/write',
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
        execute: async (params: Record<string, unknown>) => {
          const filePath = params.path as string;
          const content = params.content as string;
          if (!filePath || content === undefined) {
            return errorResult('INVALID_INPUT', new Error('path and content are required'));
          }
          const appConfig = tryGetService<AppConfig>(container, AppConfig);
          if (!appConfig || !appConfig.workspaceDir) {
            return serviceUnavailableResult('AppConfig');
          }
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) {
            return serviceUnavailableResult('IFileServiceClient');
          }
          try {
            const absolutePath = resolveWorkspacePath(appConfig.workspaceDir, filePath);
            const uri = toUri(absolutePath);
            const existingStat = await fileService.getFileStat(uri);
            if (existingStat) {
              await fileService.setContent(existingStat, content);
            } else {
              await fileService.createFile(uri, { content });
            }
            return successResult({ path: filePath, written: true, size: content.length });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- _opensumi/file/list -----
      {
        method: '_opensumi/file/list',
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
        execute: async (params: Record<string, unknown>) => {
          const dirPath = params.path as string;
          if (!dirPath) {
            return errorResult('INVALID_INPUT', new Error('path is required'));
          }
          const appConfig = tryGetService<AppConfig>(container, AppConfig);
          if (!appConfig || !appConfig.workspaceDir) {
            return serviceUnavailableResult('AppConfig');
          }
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) {
            return serviceUnavailableResult('IFileServiceClient');
          }
          try {
            const absolutePath = resolveWorkspacePath(appConfig.workspaceDir, dirPath);
            const uri = toUri(absolutePath);
            const fileStat = await fileService.getFileStat(uri, true);
            if (!fileStat) {
              return errorResult('FILE_NOT_FOUND', new Error(`Directory not found: ${dirPath}`));
            }
            if (!fileStat.isDirectory) {
              return errorResult('NOT_A_DIRECTORY', new Error(`Path is a file, not a directory: ${dirPath}`));
            }
            const entries = (fileStat.children || []).map((child: any) => ({
              name: child.uri ? child.uri.split('/').pop() : 'unknown',
              isDirectory: child.isDirectory,
              size: child.size,
            }));
            return successResult({ path: dirPath, entries, total: entries.length });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- _opensumi/file/stat -----
      {
        method: '_opensumi/file/stat',
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
        execute: async (params: Record<string, unknown>) => {
          const filePath = params.path as string;
          if (!filePath) {
            return errorResult('INVALID_INPUT', new Error('path is required'));
          }
          const appConfig = tryGetService<AppConfig>(container, AppConfig);
          if (!appConfig || !appConfig.workspaceDir) {
            return serviceUnavailableResult('AppConfig');
          }
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) {
            return serviceUnavailableResult('IFileServiceClient');
          }
          try {
            const absolutePath = resolveWorkspacePath(appConfig.workspaceDir, filePath);
            const uri = toUri(absolutePath);
            const fileStat = await fileService.getFileStat(uri);
            if (!fileStat) {
              return errorResult('FILE_NOT_FOUND', new Error(`Path not found: ${filePath}`));
            }
            return successResult({
              path: filePath,
              isDirectory: fileStat.isDirectory,
              size: fileStat.size,
              lastModified: fileStat.lastModification,
              isReadonly: fileStat.readonly,
            });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- _opensumi/file/exists -----
      {
        method: '_opensumi/file/exists',
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
        execute: async (params: Record<string, unknown>) => {
          const filePath = params.path as string;
          if (!filePath) {
            return errorResult('INVALID_INPUT', new Error('path is required'));
          }
          const appConfig = tryGetService<AppConfig>(container, AppConfig);
          if (!appConfig || !appConfig.workspaceDir) {
            return serviceUnavailableResult('AppConfig');
          }
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) {
            return serviceUnavailableResult('IFileServiceClient');
          }
          try {
            const absolutePath = resolveWorkspacePath(appConfig.workspaceDir, filePath);
            const uri = toUri(absolutePath);
            const exists = await fileService.access(uri);
            return successResult({ path: filePath, exists });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- _opensumi/file/create -----
      {
        method: '_opensumi/file/create',
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
        execute: async (params: Record<string, unknown>) => {
          const filePath = params.path as string;
          const createType = (params.type as 'file' | 'directory') || 'file';
          if (!filePath) {
            return errorResult('INVALID_INPUT', new Error('path is required'));
          }
          const appConfig = tryGetService<AppConfig>(container, AppConfig);
          if (!appConfig || !appConfig.workspaceDir) {
            return serviceUnavailableResult('AppConfig');
          }
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) {
            return serviceUnavailableResult('IFileServiceClient');
          }
          try {
            const absolutePath = resolveWorkspacePath(appConfig.workspaceDir, filePath);
            const uri = toUri(absolutePath);
            const existingStat = await fileService.getFileStat(uri);
            if (existingStat) {
              return errorResult('FILE_EXISTS', new Error(`Path already exists: ${filePath}`));
            }
            if (createType === 'directory') {
              await fileService.createFolder(uri);
            } else {
              await fileService.createFile(uri);
            }
            return successResult({ path: filePath, type: createType, created: true });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- _opensumi/file/delete -----
      {
        method: '_opensumi/file/delete',
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
        execute: async (params: Record<string, unknown>) => {
          const filePath = params.path as string;
          const recursive = (params.recursive as boolean) ?? false;
          if (!filePath) {
            return errorResult('INVALID_INPUT', new Error('path is required'));
          }
          const appConfig = tryGetService<AppConfig>(container, AppConfig);
          if (!appConfig || !appConfig.workspaceDir) {
            return serviceUnavailableResult('AppConfig');
          }
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) {
            return serviceUnavailableResult('IFileServiceClient');
          }
          try {
            const absolutePath = resolveWorkspacePath(appConfig.workspaceDir, filePath);
            const uri = toUri(absolutePath);
            const existingStat = await fileService.getFileStat(uri);
            if (!existingStat) {
              return errorResult('FILE_NOT_FOUND', new Error(`Path not found: ${filePath}`));
            }
            if (existingStat.isDirectory && !recursive) {
              return errorResult(
                'IS_DIRECTORY',
                new Error('Path is a directory. Use recursive: true to delete directories.'),
              );
            }
            await fileService.delete(uri);
            return successResult({ path: filePath, deleted: true });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- _opensumi/file/move -----
      {
        method: '_opensumi/file/move',
        description: 'Move or rename a file or directory from source to destination.',
        inputSchema: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'The relative source path to move, from the workspace root.',
            },
            destination: {
              type: 'string',
              description: 'The relative destination path to move to, from the workspace root.',
            },
          },
          required: ['source', 'destination'],
        },
        execute: async (params: Record<string, unknown>) => {
          const source = params.source as string;
          const destination = params.destination as string;
          if (!source || !destination) {
            return errorResult('INVALID_INPUT', new Error('source and destination are required'));
          }
          const appConfig = tryGetService<AppConfig>(container, AppConfig);
          if (!appConfig || !appConfig.workspaceDir) {
            return serviceUnavailableResult('AppConfig');
          }
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) {
            return serviceUnavailableResult('IFileServiceClient');
          }
          try {
            const sourceAbsolute = resolveWorkspacePath(appConfig.workspaceDir, source);
            const destinationAbsolute = resolveWorkspacePath(appConfig.workspaceDir, destination);
            const sourceUri = toUri(sourceAbsolute);
            const destinationUri = toUri(destinationAbsolute);
            await fileService.move(sourceUri, destinationUri);
            return successResult({ source, destination, moved: true });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- _opensumi/file/copy -----
      {
        method: '_opensumi/file/copy',
        description: 'Copy a file or directory from source to destination.',
        inputSchema: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'The relative source path to copy, from the workspace root.',
            },
            destination: {
              type: 'string',
              description: 'The relative destination path to copy to, from the workspace root.',
            },
          },
          required: ['source', 'destination'],
        },
        execute: async (params: Record<string, unknown>) => {
          const source = params.source as string;
          const destination = params.destination as string;
          if (!source || !destination) {
            return errorResult('INVALID_INPUT', new Error('source and destination are required'));
          }
          const appConfig = tryGetService<AppConfig>(container, AppConfig);
          if (!appConfig || !appConfig.workspaceDir) {
            return serviceUnavailableResult('AppConfig');
          }
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) {
            return serviceUnavailableResult('IFileServiceClient');
          }
          try {
            const sourceAbsolute = resolveWorkspacePath(appConfig.workspaceDir, source);
            const destinationAbsolute = resolveWorkspacePath(appConfig.workspaceDir, destination);
            const sourceUri = toUri(sourceAbsolute);
            const destinationUri = toUri(destinationAbsolute);
            await fileService.copy(sourceUri, destinationUri);
            return successResult({ source, destination, copied: true });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
    ],
  };
}

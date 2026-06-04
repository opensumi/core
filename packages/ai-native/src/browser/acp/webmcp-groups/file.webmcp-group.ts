/**
 * WebMCP group definition for file management.
 *
 * Defines file_* capabilities once for both navigator.modelContext and
 * the Node-side MCP server.
 *
 * Tools follow the naming convention: file_{action}
 */
import { Injector } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-browser';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import { WebMcpGroupRegistration } from '../webmcp-group-registry';
import { classifyError, errorResult, serviceUnavailableResult, successResult, tryGetService } from '../webmcp-utils';

import {
  resolveWorkspaceFilePath,
  validateWorkspaceFileStat,
  validateWorkspacePathAccess,
  validateWritableWorkspaceTarget,
} from './file-workspace-path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function invalidPathResult(message: string) {
  return errorResult('INVALID_INPUT', new Error(message));
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
      // ----- file_get_workspace_root -----
      {
        name: 'file_get_workspace_root',
        description:
          'Get the absolute path of the current workspace root directory. Use this to understand the base path for relative file operations.',
        riskLevel: 'read',
        profiles: ['interactive', 'full'],
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

      // ----- file_read -----
      {
        name: 'file_read',
        description:
          'Read the contents of a file. Returns the file content as text. Use relative paths from the workspace root.',
        riskLevel: 'read',
        profiles: ['interactive', 'full'],
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
            const resolved = resolveWorkspaceFilePath(appConfig.workspaceDir, filePath);
            if (!resolved.ok) {
              return invalidPathResult(resolved.message);
            }
            const accessValidation = await validateWorkspacePathAccess(
              fileService,
              appConfig.workspaceDir,
              resolved.value,
            );
            if (!accessValidation.ok) {
              return invalidPathResult(accessValidation.message);
            }
            const uri = resolved.value.uri;
            const fileStat = await fileService.getFileStat(uri);
            if (!fileStat) {
              return errorResult('FILE_NOT_FOUND', new Error(`File not found: ${filePath}`));
            }
            const statValidation = validateWorkspaceFileStat(
              appConfig.workspaceDir,
              fileStat,
              resolved.value.pathModule,
            );
            if (!statValidation.ok) {
              return invalidPathResult(statValidation.message);
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

      // ----- file_write -----
      {
        name: 'file_write',
        description:
          'Write content to a file. Creates the file if it does not exist, overwrites if it does. Creates parent directories automatically.',
        riskLevel: 'write',
        exposedByDefault: false,
        profiles: ['full'],
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
            const resolved = resolveWorkspaceFilePath(appConfig.workspaceDir, filePath);
            if (!resolved.ok) {
              return invalidPathResult(resolved.message);
            }
            const targetValidation = await validateWritableWorkspaceTarget(
              fileService,
              appConfig.workspaceDir,
              resolved.value,
            );
            if (!targetValidation.ok) {
              return invalidPathResult(targetValidation.message);
            }
            const uri = resolved.value.uri;
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

      // ----- file_list -----
      {
        name: 'file_list',
        description:
          'List the contents of a directory. Returns an array of file/directory entries with metadata. Use "." for the workspace root.',
        riskLevel: 'read',
        profiles: ['interactive', 'full'],
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
            const resolved = resolveWorkspaceFilePath(appConfig.workspaceDir, dirPath);
            if (!resolved.ok) {
              return invalidPathResult(resolved.message);
            }
            const accessValidation = await validateWorkspacePathAccess(
              fileService,
              appConfig.workspaceDir,
              resolved.value,
            );
            if (!accessValidation.ok) {
              return invalidPathResult(accessValidation.message);
            }
            const uri = resolved.value.uri;
            const fileStat = await fileService.getFileStat(uri, true);
            if (!fileStat) {
              return errorResult('FILE_NOT_FOUND', new Error(`Directory not found: ${dirPath}`));
            }
            const statValidation = validateWorkspaceFileStat(
              appConfig.workspaceDir,
              fileStat,
              resolved.value.pathModule,
            );
            if (!statValidation.ok) {
              return invalidPathResult(statValidation.message);
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

      // ----- file_stat -----
      {
        name: 'file_stat',
        description:
          'Get metadata about a file or directory. Returns size, isDirectory, lastModified, and other stat info.',
        riskLevel: 'read',
        profiles: ['interactive', 'full'],
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
            const resolved = resolveWorkspaceFilePath(appConfig.workspaceDir, filePath);
            if (!resolved.ok) {
              return invalidPathResult(resolved.message);
            }
            const accessValidation = await validateWorkspacePathAccess(
              fileService,
              appConfig.workspaceDir,
              resolved.value,
            );
            if (!accessValidation.ok) {
              return invalidPathResult(accessValidation.message);
            }
            const uri = resolved.value.uri;
            const fileStat = await fileService.getFileStat(uri);
            if (!fileStat) {
              return errorResult('FILE_NOT_FOUND', new Error(`Path not found: ${filePath}`));
            }
            const statValidation = validateWorkspaceFileStat(
              appConfig.workspaceDir,
              fileStat,
              resolved.value.pathModule,
            );
            if (!statValidation.ok) {
              return invalidPathResult(statValidation.message);
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

      // ----- file_exists -----
      {
        name: 'file_exists',
        description: 'Check whether a file or directory exists at the given path. Returns true or false.',
        riskLevel: 'read',
        profiles: ['interactive', 'full'],
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
            const resolved = resolveWorkspaceFilePath(appConfig.workspaceDir, filePath);
            if (!resolved.ok) {
              return invalidPathResult(resolved.message);
            }
            const accessValidation = await validateWorkspacePathAccess(
              fileService,
              appConfig.workspaceDir,
              resolved.value,
            );
            if (!accessValidation.ok) {
              return invalidPathResult(accessValidation.message);
            }
            const fileStat = await fileService.getFileStat(resolved.value.uri);
            if (fileStat) {
              const statValidation = validateWorkspaceFileStat(
                appConfig.workspaceDir,
                fileStat,
                resolved.value.pathModule,
              );
              if (!statValidation.ok) {
                return invalidPathResult(statValidation.message);
              }
            }
            const exists = !!fileStat;
            return successResult({ path: filePath, exists });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- file_create -----
      {
        name: 'file_create',
        description:
          'Create an empty file or a new directory. Use "type: directory" to create a folder instead of a file.',
        riskLevel: 'write',
        exposedByDefault: false,
        profiles: ['full'],
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
            const resolved = resolveWorkspaceFilePath(appConfig.workspaceDir, filePath);
            if (!resolved.ok) {
              return invalidPathResult(resolved.message);
            }
            const targetValidation = await validateWritableWorkspaceTarget(
              fileService,
              appConfig.workspaceDir,
              resolved.value,
            );
            if (!targetValidation.ok) {
              return invalidPathResult(targetValidation.message);
            }
            const uri = resolved.value.uri;
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

      // ----- file_delete -----
      {
        name: 'file_delete',
        description: 'Delete a file or directory. Use recursive: true to delete a directory and its contents.',
        riskLevel: 'destructive',
        exposedByDefault: false,
        profiles: ['full'],
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
            const resolved = resolveWorkspaceFilePath(appConfig.workspaceDir, filePath);
            if (!resolved.ok) {
              return invalidPathResult(resolved.message);
            }
            const accessValidation = await validateWorkspacePathAccess(
              fileService,
              appConfig.workspaceDir,
              resolved.value,
            );
            if (!accessValidation.ok) {
              return invalidPathResult(accessValidation.message);
            }
            const uri = resolved.value.uri;
            const existingStat = await fileService.getFileStat(uri);
            if (!existingStat) {
              return errorResult('FILE_NOT_FOUND', new Error(`Path not found: ${filePath}`));
            }
            const statValidation = validateWorkspaceFileStat(
              appConfig.workspaceDir,
              existingStat,
              resolved.value.pathModule,
            );
            if (!statValidation.ok) {
              return invalidPathResult(statValidation.message);
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

      // ----- file_move -----
      {
        name: 'file_move',
        description: 'Move or rename a file or directory from source to destination.',
        riskLevel: 'write',
        exposedByDefault: false,
        profiles: ['full'],
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
            const sourceResolved = resolveWorkspaceFilePath(appConfig.workspaceDir, source);
            if (!sourceResolved.ok) {
              return invalidPathResult(sourceResolved.message);
            }
            const sourceAccessValidation = await validateWorkspacePathAccess(
              fileService,
              appConfig.workspaceDir,
              sourceResolved.value,
            );
            if (!sourceAccessValidation.ok) {
              return invalidPathResult(sourceAccessValidation.message);
            }
            const destinationResolved = resolveWorkspaceFilePath(appConfig.workspaceDir, destination);
            if (!destinationResolved.ok) {
              return invalidPathResult(destinationResolved.message);
            }
            const sourceUri = sourceResolved.value.uri;
            const destinationUri = destinationResolved.value.uri;
            const sourceStat = await fileService.getFileStat(sourceUri);
            if (!sourceStat) {
              return errorResult('FILE_NOT_FOUND', new Error(`Source not found: ${source}`));
            }
            const sourceValidation = validateWorkspaceFileStat(
              appConfig.workspaceDir,
              sourceStat,
              sourceResolved.value.pathModule,
            );
            if (!sourceValidation.ok) {
              return invalidPathResult(sourceValidation.message);
            }
            const destinationValidation = await validateWritableWorkspaceTarget(
              fileService,
              appConfig.workspaceDir,
              destinationResolved.value,
            );
            if (!destinationValidation.ok) {
              return invalidPathResult(destinationValidation.message);
            }
            await fileService.move(sourceUri, destinationUri);
            return successResult({ source, destination, moved: true });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- file_copy -----
      {
        name: 'file_copy',
        description: 'Copy a file or directory from source to destination.',
        riskLevel: 'write',
        exposedByDefault: false,
        profiles: ['full'],
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
            const sourceResolved = resolveWorkspaceFilePath(appConfig.workspaceDir, source);
            if (!sourceResolved.ok) {
              return invalidPathResult(sourceResolved.message);
            }
            const sourceAccessValidation = await validateWorkspacePathAccess(
              fileService,
              appConfig.workspaceDir,
              sourceResolved.value,
            );
            if (!sourceAccessValidation.ok) {
              return invalidPathResult(sourceAccessValidation.message);
            }
            const destinationResolved = resolveWorkspaceFilePath(appConfig.workspaceDir, destination);
            if (!destinationResolved.ok) {
              return invalidPathResult(destinationResolved.message);
            }
            const sourceUri = sourceResolved.value.uri;
            const destinationUri = destinationResolved.value.uri;
            const sourceStat = await fileService.getFileStat(sourceUri);
            if (!sourceStat) {
              return errorResult('FILE_NOT_FOUND', new Error(`Source not found: ${source}`));
            }
            const sourceValidation = validateWorkspaceFileStat(
              appConfig.workspaceDir,
              sourceStat,
              sourceResolved.value.pathModule,
            );
            if (!sourceValidation.ok) {
              return invalidPathResult(sourceValidation.message);
            }
            const destinationValidation = await validateWritableWorkspaceTarget(
              fileService,
              appConfig.workspaceDir,
              destinationResolved.value,
            );
            if (!destinationValidation.ok) {
              return invalidPathResult(destinationValidation.message);
            }
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

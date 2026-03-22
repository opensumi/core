/**
 * ACP 文件系统操作处理器
 *
 * 为 CLI Agent 提供受工作区沙箱限制的文件操作能力：
 * - readTextFile：读取文本文件内容，支持按行范围截取
 * - writeTextFile：写入文本文件，写入前可通过 permissionCallback 触发用户授权
 * - getFileMeta：获取文件元信息（大小、修改时间、MIME 类型等）
 * - listDirectory：列举目录条目，支持一层递归
 * - createDirectory：创建目录（含父目录）
 *
 * 安全机制：所有路径均经过 resolvePath 校验，拒绝工作区外的绝对路径和路径穿越攻击。
 */
import * as fs from 'fs';
import * as path from 'path';

import { Autowired, Injectable } from '@opensumi/di';
import { ILogger, URI } from '@opensumi/ide-core-common';
import { IFileService } from '@opensumi/ide-file-service';

import { ACPErrorCode } from './constants';

export interface FileSystemRequest {
  sessionId: string;
  path: string;
  line?: number;
  limit?: number;
  content?: string;
  recursive?: boolean;
}

export const AcpFileSystemHandlerToken = Symbol('AcpFileSystemHandlerToken');

export interface FileSystemResponse {
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  content?: string;
  size?: number;
  mtime?: number;
  isFile?: boolean;
  mimeType?: string;
  entries?: Array<{
    name: string;
    isFile: boolean;
    size: number;
  }>;
}

export type PermissionCallback = (
  sessionId: string,
  operation: 'write' | 'command',
  details: {
    path?: string;
    command?: string;
    title: string;
    kind: string;
    locations?: Array<{ path: string; line?: number }>;
    content?: string;
  },
) => Promise<boolean>;

@Injectable()
export class AcpFileSystemHandler {
  @Autowired(IFileService)
  private fileService: IFileService;

  private logger: ILogger | null = null;
  private workspaceDir: string = '';
  private maxFileSize = 1024 * 1024; // 1MB default
  private permissionCallback: PermissionCallback | null = null;

  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  /**
   * Set the permission callback for write operations
   */
  setPermissionCallback(callback: PermissionCallback): void {
    this.permissionCallback = callback;
  }

  configure(options: { workspaceDir: string; maxFileSize?: number }): void {
    this.workspaceDir = options.workspaceDir;
    if (options.maxFileSize !== undefined) {
      this.maxFileSize = options.maxFileSize;
    }
  }

  async readTextFile(request: FileSystemRequest): Promise<FileSystemResponse> {
    const filePath = this.resolvePath(request.path);
    if (!filePath) {
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: 'Invalid path',
          data: { path: request.path },
        },
      };
    }

    try {
      const uri = URI.file(filePath);

      // Check if file exists
      const stat = await this.fileService.getFileStat(uri.toString());
      if (!stat) {
        return {
          error: {
            code: ACPErrorCode.RESOURCE_NOT_FOUND,
            message: 'File not found',
            data: { uri: uri.toString() },
          },
        };
      }

      // Check file size
      if (stat.size && stat?.size > this.maxFileSize) {
        return {
          error: {
            code: ACPErrorCode.SERVER_ERROR,
            message: `File too large: ${stat.size} bytes (max: ${this.maxFileSize})`,
            data: { path: request.path, size: stat.size },
          },
        };
      }

      // Read file content
      const content = (await this.fileService.resolveContent(uri.toString())).content;
      let text = content.toString();

      // Apply line range if specified
      if (request.line !== undefined || request.limit !== undefined) {
        const lines = text.split('\n');
        const startLine = (request.line ?? 1) - 1;
        const limit = request.limit ?? lines.length;
        text = lines.slice(startLine, startLine + limit).join('\n');
      }

      return {
        content: text,
      };
    } catch (error) {
      this.logger?.error(`Error reading file ${filePath}:`, error);
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: error instanceof Error ? error.message : 'Failed to read file',
          data: { path: request.path },
        },
      };
    }
  }

  async writeTextFile(request: FileSystemRequest): Promise<FileSystemResponse> {
    const filePath = this.resolvePath(request.path);
    if (!filePath) {
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: 'Invalid path',
          data: { path: request.path },
        },
      };
    }

    if (request.content === undefined) {
      return {
        error: {
          code: ACPErrorCode.INVALID_PARAMS,
          message: 'Content is required',
        },
      };
    }

    // Check permission for write operation if callback is set
    if (this.permissionCallback) {
      const permitted = await this.permissionCallback(request.sessionId, 'write', {
        path: filePath,
        title: `Write file: ${path.basename(filePath)}`,
        kind: 'write',
        locations: [{ path: filePath }],
        content: request.content.substring(0, 200), // Include preview
      });

      if (!permitted) {
        this.logger?.warn(`Write permission denied for: ${filePath}`);
        return {
          error: {
            code: ACPErrorCode.FORBIDDEN,
            message: 'Write permission denied',
            data: { path: filePath },
          },
        };
      }
    }

    try {
      const uri = URI.file(filePath);

      // Create parent directories if needed
      const parentUri = uri.parent;
      const parentStat = await this.fileService.getFileStat(parentUri.toString());
      if (!parentStat) {
        await this.fileService.createFolder(parentUri.toString());
      }

      // Write file content
      const buffer = Buffer.from(request.content, 'utf8');
      const filestat = await this.fileService.getFileStat(uri.toString());
      if (filestat) {
        await this.fileService.setContent(filestat, buffer.toString());
      } else {
        await this.fileService.createFile(uri.toString(), { content: buffer.toString() });
      }

      this.logger?.log(`File written: ${filePath}`);

      return {};
    } catch (error) {
      this.logger?.error(`Error writing file ${filePath}:`, error);
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: error instanceof Error ? error.message : 'Failed to write file',
          data: { path: request.path },
        },
      };
    }
  }

  async getFileMeta(request: FileSystemRequest): Promise<FileSystemResponse> {
    const filePath = this.resolvePath(request.path);
    if (!filePath) {
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: 'Invalid path',
          data: { path: request.path },
        },
      };
    }

    try {
      const uri = URI.file(filePath);
      const stat = await this.fileService.getFileStat(uri.toString());

      if (!stat) {
        // File doesn't exist, return false for existence check
        return {
          isFile: false,
          size: 0,
          mtime: 0,
        };
      }

      return {
        size: stat.size,
        mtime: stat.lastModification,
        isFile: !stat.isDirectory,
        mimeType: this.detectMimeType(filePath),
      };
    } catch (error) {
      this.logger?.error(`Error getting file meta ${filePath}:`, error);
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: error instanceof Error ? error.message : 'Failed to get file metadata',
          data: { path: request.path },
        },
      };
    }
  }

  async listDirectory(request: FileSystemRequest): Promise<FileSystemResponse> {
    const dirPath = this.resolvePath(request.path);
    if (!dirPath) {
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: 'Invalid path',
          data: { path: request.path },
        },
      };
    }

    try {
      const uri = URI.file(dirPath);
      const stat = await this.fileService.getFileStat(uri.toString());

      if (!stat) {
        return {
          error: {
            code: ACPErrorCode.RESOURCE_NOT_FOUND,
            message: 'Directory not found',
            data: { path: request.path },
          },
        };
      }

      if (!stat.isDirectory) {
        return {
          error: {
            code: ACPErrorCode.INVALID_PARAMS,
            message: 'Path is a file, not a directory',
            data: { path: request.path },
          },
        };
      }

      const entries: Array<{ name: string; isFile: boolean; size: number }> = [];

      if (stat.children) {
        for (const child of stat.children) {
          entries.push({
            name: path.basename(child.uri.toString()),
            isFile: !child.isDirectory,
            size: child.size || 0,
          });
          const childName = path.basename(child.uri.toString());
          // Handle recursive listing
          if (request.recursive && child.isDirectory && child.children) {
            for (const grandChild of child.children) {
              entries.push({
                name: `${childName}/${path.basename(grandChild.uri.toString())}`,
                isFile: !grandChild.isDirectory,
                size: grandChild.size || 0,
              });
            }
          }
        }
      }

      return {
        entries,
      };
    } catch (error) {
      this.logger?.error(`Error listing directory ${dirPath}:`, error);
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: error instanceof Error ? error.message : 'Failed to list directory',
          data: { path: request.path },
        },
      };
    }
  }

  async createDirectory(request: FileSystemRequest): Promise<FileSystemResponse> {
    const dirPath = this.resolvePath(request.path);
    if (!dirPath) {
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: 'Invalid path',
          data: { path: request.path },
        },
      };
    }

    // Check permission for write operation if callback is set
    if (this.permissionCallback) {
      const permitted = await this.permissionCallback(request.sessionId, 'write', {
        path: dirPath,
        title: `Create directory: ${path.basename(dirPath)}`,
        kind: 'createDirectory',
        locations: [{ path: dirPath }],
      });

      if (!permitted) {
        this.logger?.warn(`Create directory permission denied for: ${dirPath}`);
        return {
          error: {
            code: ACPErrorCode.FORBIDDEN,
            message: 'Create directory permission denied',
            data: { path: dirPath },
          },
        };
      }
    }

    try {
      const uri = URI.file(dirPath);
      await this.fileService.createFolder(uri.toString());

      this.logger?.log(`Directory created: ${dirPath}`);

      return {};
    } catch (error) {
      this.logger?.error(`Error creating directory ${dirPath}:`, error);
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: error instanceof Error ? error.message : 'Failed to create directory',
          data: { path: request.path },
        },
      };
    }
  }

  /**
   * Resolve a path relative to workspace, validating it stays within workspace bounds
   */
  private resolvePath(inputPath: string): string | null {
    // Reject immediately if workspaceDir is not set
    if (!this.workspaceDir) {
      this.logger?.warn('Workspace directory not configured');
      return null;
    }

    // Resolve the input path (handles both absolute and relative paths)
    let resolvedPath: string;
    if (path.isAbsolute(inputPath)) {
      resolvedPath = path.resolve(inputPath);
    } else {
      resolvedPath = path.resolve(this.workspaceDir, inputPath);
    }

    // Resolve symlinks for both the resolved path and workspace directory
    let realResolvedPath: string;
    let realWorkspaceDir: string;
    try {
      realResolvedPath = fs.realpathSync(resolvedPath);
    } catch (error) {
      // If the path doesn't exist yet (e.g., new file for write), use the resolved path as-is
      realResolvedPath = resolvedPath;
    }
    try {
      realWorkspaceDir = fs.realpathSync(this.workspaceDir);
    } catch (error) {
      this.logger?.warn(`Cannot resolve workspace directory: ${this.workspaceDir}`);
      return null;
    }

    // Compute the relative path and ensure it does not escape workspace
    const relativePath = path.relative(realWorkspaceDir, realResolvedPath);

    // Reject if relative path equals '..' or starts with '..' + separator
    if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`)) {
      this.logger?.warn(`Path outside workspace rejected: ${inputPath}`);
      return null;
    }

    return realResolvedPath;
  }

  /**
   * Detect MIME type based on file extension
   */
  private detectMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.jsx': 'text/jsx',
      '.tsx': 'text/tsx',
      '.json': 'application/json',
      '.css': 'text/css',
      '.html': 'text/html',
      '.xml': 'application/xml',
      '.yaml': 'application/yaml',
      '.yml': 'application/yaml',
      '.py': 'text/x-python',
      '.java': 'text/x-java',
      '.go': 'text/x-go',
      '.rs': 'text/x-rust',
      '.c': 'text/x-c',
      '.cpp': 'text/x-c++',
      '.h': 'text/x-c',
      '.hpp': 'text/x-c++',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }
}

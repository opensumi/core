/**
 * ACP 文件系统操作处理器
 *
 * 为 CLI Agent 提供受工作区沙箱限制的文件操作能力：
 * - readTextFile：读取文本文件内容，支持按行范围截取
 * - writeTextFile：写入文本文件
 *
 * 安全机制：所有路径均经过 resolvePath 校验，拒绝工作区外的绝对路径和路径穿越攻击。
 */
import * as fs from 'fs';
import * as path from 'path';

import { Autowired, Injectable } from '@opensumi/di';
import { ILogger, URI } from '@opensumi/ide-core-common';
import { IFileService } from '@opensumi/ide-file-service';

import { ACPErrorCode } from './constants';

export const AcpFileSystemHandlerToken = Symbol('AcpFileSystemHandlerToken');

export interface ReadTextFileRequest {
  sessionId: string;
  path: string;
  line?: number;
  limit?: number;
}

export interface ReadTextFileResponse {
  content?: string;
  error?: { message: string; code: number };
}

export interface WriteTextFileRequest {
  sessionId: string;
  path: string;
  content: string;
}

export interface WriteTextFileResponse {
  error?: { message: string; code: number };
}

export interface IAcpFileSystemHandler {
  configure(options: { workspaceDir: string; maxFileSize?: number }): void;
  readTextFile(req: ReadTextFileRequest): Promise<ReadTextFileResponse>;
  writeTextFile(req: WriteTextFileRequest): Promise<WriteTextFileResponse>;
}

@Injectable()
export class AcpFileSystemHandler implements IAcpFileSystemHandler {
  @Autowired(IFileService)
  private fileService: IFileService;

  private logger: ILogger | null = null;
  private workspaceDir: string = '';
  private maxFileSize = 1024 * 1024; // 1MB default

  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  configure(options: { workspaceDir: string; maxFileSize?: number }): void {
    this.workspaceDir = options.workspaceDir;
    if (options.maxFileSize !== undefined) {
      this.maxFileSize = options.maxFileSize;
    }
  }

  async readTextFile(request: ReadTextFileRequest): Promise<ReadTextFileResponse> {
    this.logger?.log(`[AcpFileSystemHandler] readTextFile() — sessionId=${request.sessionId}, path=${request.path}`);
    const filePath = this.resolvePath(request.path);
    if (!filePath) {
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: 'Invalid path',
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
          },
        };
      }

      // Check file size
      if (stat.size && stat?.size > this.maxFileSize) {
        return {
          error: {
            code: ACPErrorCode.SERVER_ERROR,
            message: `File too large: ${stat.size} bytes (max: ${this.maxFileSize})`,
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
        },
      };
    }
  }

  async writeTextFile(request: WriteTextFileRequest): Promise<WriteTextFileResponse> {
    this.logger?.log(
      `[AcpFileSystemHandler] writeTextFile() — sessionId=${request.sessionId}, path=${request.path}, size=${request.content.length}`,
    );
    const filePath = this.resolvePath(request.path);
    if (!filePath) {
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: 'Invalid path',
        },
      };
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

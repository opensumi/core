import { IMarker } from '@opensumi/ide-core-browser';
import { Uri } from '@opensumi/monaco-editor-core';

import { ImageCompressionOptions } from './image-compression';

export enum NearestCodeBlockType {
  Block = 'block',
  Line = 'line',
}

export interface INearestCodeBlock {
  range: {
    start: {
      line: number;
      character: number;
    };
    end: {
      line: number;
      character: number;
    };
  };
  codeBlock: string;
  offset: number;
  type?: NearestCodeBlockType;
}

export type IMCPToolResultContent = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType?: string };
export interface IMCPToolResult {
  content: IMCPToolResultContent[];
  isError?: boolean;
}

// SUMI MCP Server 网页部分暴露给 Node.js 部分的能力
export interface IMCPServerProxyService {
  $callMCPTool(
    name: string,
    args: any,
  ): Promise<{
    content: { type: string; text: string }[];
    isError?: boolean;
  }>;
  // 获取 browser 层注册的 MCP 工具列表 (Browser tab 维度)
  $getBuiltinMCPTools(): Promise<MCPTool[]>;
  // 通知前端 MCP 服务注册表发生了变化
  $updateMCPServers(): Promise<void>;
  // 获取所有 MCP 服务器列表
  $getServers(): Promise<Array<{ name: string; isStarted: boolean }>>;
  // 启动指定的 MCP 服务器
  $startServer(serverName: string): Promise<void>;
  // 停止指定的 MCP 服务器
  $stopServer(serverName: string): Promise<void>;
  // 压缩工具结果
  $compressToolResult(result: IMCPToolResult, options: ImageCompressionOptions): Promise<IMCPToolResult>;
}

export interface MCPServer {
  name: string;
  isStarted: boolean;
  tools?: MCPTool[];
  command?: string;
  type?: string;
  url?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  providerName: string;
}

export enum MCP_SERVER_TYPE {
  STDIO = 'stdio',
  SSE = 'sse',
  BUILTIN = 'builtin',
}

export interface CodeBlockData {
  messageId: string;
  toolCallId: string;
  codeEdit: string;
  originalCode: string;
  updatedCode?: string;
  relativePath: string;
  status: CodeBlockStatus;
  iterationCount: number;
  createdAt: number;
  version: number;
  instructions?: string;
  applyResult?: {
    diff: string;
    diagnosticInfos: IMarker[];
  };
}

export type CodeBlockStatus = 'generating' | 'pending' | 'success' | 'rejected' | 'failed' | 'cancelled';

export enum EPartialEdit {
  accept = 'accept',
  discard = 'discard',
}

export interface IPartialEditEvent {
  uri: Uri;
  /**
   * 总 diff 数
   */
  totalPartialEditCount: number;
  /**
   * 已处理的个数
   */
  resolvedPartialEditCount: number;
  /**
   * 已添加行数
   */
  totalAddedLinesCount: number;
  /**
   * 已采纳的个数
   */
  acceptPartialEditCount: number;
  /**
   * 已删除行数
   */
  totalDeletedLinesCount: number;
  currentPartialEdit: {
    type: EPartialEdit;
    addedLinesCount: number;
    deletedLinesCount: number;
  };
}

export interface SSEClientTransportOptions {
  /**
   * Customizes recurring POST requests to the server.
   */
  requestInit?: RequestInit;
}

export interface ProjectRule {
  path: string;
  content: string;
  description?: string;
  globs?: string | string[];
  alwaysApply?: boolean;
}

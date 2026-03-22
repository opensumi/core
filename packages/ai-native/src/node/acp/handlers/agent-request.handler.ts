/**
 * ACP Agent 请求处理器
 *
 * 路由并处理 CLI Agent 通过 JSON-RPC 主动发起的请求（Agent → Client）：
 * - 文件操作：handleReadTextFile / handleWriteTextFile（写入前需用户授权）
 * - 终端操作：handleCreateTerminal / handleTerminalOutput / handleWaitForTerminalExit / handleKillTerminal / handleReleaseTerminal（创建前需用户授权）
 * - 权限确认：handlePermissionRequest，通过 AcpPermissionCallerManager 在浏览器端弹出对话框
 *
 * 设计说明：
 * - 在主 Injector 中作为单例创建，与特定 RPC 连接无关
 * - 权限对话框通过 AcpPermissionCallerManager 静态变量路由到当前活跃 Browser Tab
 */
import { Autowired, Injectable } from '@opensumi/di';
import {
  CreateTerminalRequest,
  CreateTerminalResponse,
  KillTerminalCommandRequest,
  KillTerminalCommandResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
} from '@opensumi/ide-core-common/lib/types/ai-native';
import { INodeLogger } from '@opensumi/ide-core-node';

import { AcpPermissionCallerManagerToken } from '../../acp';
import { AcpPermissionCallerManager } from '../acp-permission-caller.service';

import { AcpFileSystemHandler, AcpFileSystemHandlerToken } from './file-system.handler';
import { AcpTerminalHandler, AcpTerminalHandlerToken } from './terminal.handler';

export const AcpAgentRequestHandlerToken = Symbol('AcpAgentRequestHandlerToken');

/**
 * ACP Agent Request Handler - 处理来自 CLI Agent 的请求
 *
 * ## 设计说明
 *
 * ### 为什么在主 Injector 中创建
 *
 * `AcpAgentRequestHandler` 处理的是 CLI Agent 发出的请求，这些请求与特定的 RPC 连接无关：
 * - CLI Agent 通过 stdio 与 Node 进程通信，不依赖 Browser Tab
 * - 请求中不包含 `clientId` 信息，无法路由到特定的 childInjector
 * - 因此必须在主 Injector 中作为单例存在，处理所有来自 CLI Agent 的请求
 *
 * ### Injector 层级问题
 *
 * 由于 `AcpAgentRequestHandler` 在主 Injector 中创建，它通过 `@Autowired` 注入的
 * `AcpPermissionCallerManager` 不是 childInjector 中与 RPC 连接关联的实例。
 *
 * 解决方案：`AcpPermissionCallerManager` 使用静态变量 `currentRpcClient` 共享 RPC client，
 * 确保权限对话框在用户当前活跃的 Browser Tab 中显示。
 *
 * @see {@link /docs/ai-native/architecture/injector-hierarchy.md} 详细设计文档
 */
@Injectable()
export class AcpAgentRequestHandler {
  @Autowired(AcpFileSystemHandlerToken)
  private fileSystemHandler: AcpFileSystemHandler;

  @Autowired(AcpTerminalHandlerToken)
  private terminalHandler: AcpTerminalHandler;

  @Autowired(AcpPermissionCallerManagerToken)
  private permissionCaller: AcpPermissionCallerManager;

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  private initialized = false;

  /**
   * Initialize the handler and register for agent requests
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    // The agent will send requests to us via JSON-RPC
    // We handle them by processing through the appropriate handlers
  }

  /**
   * Handle permission request from agent
   * Shows UI dialog in browser via RPC and returns user's decision
   *
   * 注意：权限对话框会在用户当前活跃的 Browser Tab 中显示
   * （通过 AcpPermissionCallerManager 的静态变量 currentRpcClient 实现）
   */
  async handlePermissionRequest(request: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    try {
      // Call browser-side permission dialog via RPC
      const response = await this.permissionCaller.requestPermission(request);

      return response;
    } catch (error) {
      this.logger.error('[ACP Node][handlePermissionRequest] Error:', error);
      // Return cancelled on error
      return {
        outcome: { outcome: 'cancelled' as const },
      };
    }
  }

  /**
   * Handle read text file request (requires read permission)
   */
  async handleReadTextFile(request: ReadTextFileRequest): Promise<ReadTextFileResponse> {
    try {
      // File reading doesn't require permission (it's a read operation)
      // But we log it for audit purposes
      const result = await this.fileSystemHandler.readTextFile({
        sessionId: request.sessionId,
        path: request.path,
        line: request.line ?? undefined,
        limit: request.limit ?? undefined,
      });

      if (result.error) {
        this.logger.error(`[ACP] File read error: ${result.error.message}`);
        const err = new Error(result.error.message);
        (err as any).code = result.error.code;
        throw err;
      }

      return {
        content: result.content || '',
      };
    } catch (error) {
      this.logger.error(`[ACP] Failed to read file: ${request.path}`, error);
      throw error;
    }
  }

  /**
   * Handle write text file request (requires write permission)
   */
  async handleWriteTextFile(request: WriteTextFileRequest): Promise<WriteTextFileResponse> {
    try {
      // For write operations, request permission from user first
      const permissionResponse = await this.permissionCaller.requestPermission({
        sessionId: request.sessionId,
        toolCall: {
          toolCallId: `write-${Date.now()}`,
          title: `Write file: ${request.path}`,
          kind: 'write' as any,
          status: 'pending',
          locations: [{ path: request.path }],
          rawInput: { path: request.path, contentLength: request.content?.length },
        },
        // 默认 options - 实际项目中应根据后端 ACP Agent 传入的 options 为准
        options: [
          { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' },
          { optionId: 'allow_always', name: 'Allow Always', kind: 'allow_always' },
          { optionId: 'reject_once', name: 'Reject Once', kind: 'reject_once' },
        ],
      });

      if (
        permissionResponse.outcome.outcome !== 'selected' ||
        !permissionResponse.outcome.optionId?.startsWith('allow_')
      ) {
        this.logger.warn(`[ACP] Write permission denied for: ${request.path}`);
        const err = new Error('Write permission denied');
        (err as any).code = -32003; // FORBIDDEN
        throw err;
      }

      const result = await this.fileSystemHandler.writeTextFile({
        sessionId: request.sessionId,
        path: request.path,
        content: request.content,
      });

      if (result.error) {
        this.logger.error(`[ACP] File write error: ${result.error.message}`);
        const err = new Error(result.error.message);
        (err as any).code = result.error.code;
        throw err;
      }

      return {};
    } catch (error) {
      this.logger.error(`[ACP] Failed to write file: ${request.path}`, error);
      throw error;
    }
  }

  /**
   * Handle create terminal request (requires command execution permission)
   */
  async handleCreateTerminal(request: CreateTerminalRequest): Promise<CreateTerminalResponse> {
    try {
      // For command execution, request permission from user first
      const commandStr = [request.command, ...(request.args || [])].join(' ');
      const permissionResponse = await this.permissionCaller.requestPermission({
        sessionId: request.sessionId,
        toolCall: {
          toolCallId: `terminal-${Date.now()}`,
          title: `Run command: ${commandStr}`,
          kind: 'execute',
          status: 'pending',
          rawInput: { command: request.command, args: request.args, cwd: request.cwd },
        },
        // 默认 options - 实际项目中应根据后端 ACP Agent 传入的 options 为准
        options: [
          { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' },
          { optionId: 'allow_always', name: 'Allow Always', kind: 'allow_always' },
          { optionId: 'reject_once', name: 'Reject Once', kind: 'reject_once' },
        ],
      });

      if (
        permissionResponse.outcome.outcome !== 'selected' ||
        !permissionResponse.outcome.optionId?.startsWith('allow_')
      ) {
        this.logger.warn(`[ACP] Command execution permission denied: ${commandStr}`);
        const err = new Error('Command execution permission denied');
        (err as any).code = -32003; // FORBIDDEN
        throw err;
      }

      const result = await this.terminalHandler.createTerminal({
        sessionId: request.sessionId,
        command: request.command,
        args: request.args,
        env: request.env
          ? request.env.reduce<Record<string, string>>((acc, v) => {
              acc[v.name] = v.value;
              return acc;
            }, {})
          : undefined,
        cwd: request.cwd ?? undefined,
        outputByteLimit: request.outputByteLimit ?? undefined,
      });

      if (result.error) {
        this.logger.error(`[ACP] Terminal creation error: ${result.error.message}`);
        throw new Error(result.error.message);
      }

      return {
        terminalId: result.terminalId || '',
      };
    } catch (error) {
      this.logger.error(`[ACP] Failed to create terminal: ${request.command}`, error);
      throw error;
    }
  }

  /**
   * Handle terminal output request
   */
  async handleTerminalOutput(request: TerminalOutputRequest): Promise<TerminalOutputResponse> {
    try {
      const result = await this.terminalHandler.getTerminalOutput({
        sessionId: request.sessionId,
        terminalId: request.terminalId,
      });

      if (result.error) {
        this.logger.error(`[ACP] Terminal output error: ${result.error.message}`);
        throw new Error(result.error.message);
      }

      return {
        output: result.output || '',
        truncated: result.truncated || false,
        exitStatus: result.exitStatus != null ? { exitCode: result.exitStatus } : undefined,
      };
    } catch (error) {
      this.logger.error('[ACP] Failed to get terminal output', error);
      throw error;
    }
  }

  /**
   * Handle wait for terminal exit request
   */
  async handleWaitForTerminalExit(request: WaitForTerminalExitRequest): Promise<WaitForTerminalExitResponse> {
    try {
      const result = await this.terminalHandler.waitForTerminalExit({
        sessionId: request.sessionId,
        terminalId: request.terminalId,
      });

      if (result.error) {
        this.logger.error(`[ACP] Wait for exit error: ${result.error.message}`);
        throw new Error(result.error.message);
      }

      return {
        exitCode: result.exitCode,
        signal: result.signal,
      };
    } catch (error) {
      this.logger.error('[ACP] Failed to wait for terminal exit', error);
      throw error;
    }
  }

  /**
   * Handle kill terminal request
   */
  async handleKillTerminal(request: KillTerminalCommandRequest): Promise<KillTerminalCommandResponse> {
    try {
      const result = await this.terminalHandler.killTerminal({
        sessionId: request.sessionId,
        terminalId: request.terminalId,
      });

      if (result.error) {
        this.logger.error(`[ACP] Kill terminal error: ${result.error.message}`);
        throw new Error(result.error.message);
      }

      return {};
    } catch (error) {
      this.logger.error('[ACP] Failed to kill terminal', error);
      throw error;
    }
  }

  /**
   * Handle release terminal request
   */
  async handleReleaseTerminal(request: ReleaseTerminalRequest): Promise<ReleaseTerminalResponse> {
    try {
      const result = await this.terminalHandler.releaseTerminal({
        sessionId: request.sessionId,
        terminalId: request.terminalId,
      });

      if (result.error) {
        this.logger.error(`[ACP] Release terminal error: ${result.error.message}`);
        throw new Error(result.error.message);
      }

      return {};
    } catch (error) {
      this.logger.error('[ACP] Failed to release terminal', error);
      throw error;
    }
  }

  /**
   * Clean up all session resources
   */
  async disposeSession(sessionId: string): Promise<void> {
    // Release all terminals for this session
    await this.terminalHandler.releaseSessionTerminals(sessionId);
  }
}

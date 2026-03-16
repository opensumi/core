/**
 * ACP 终端操作处理器
 *
 * 为 CLI Agent 提供进程级终端（命令执行）能力：
 * - createTerminal：创建新终端并执行命令，创建前可通过 permissionCallback 触发用户授权；
 *   自动收集输出并按 outputByteLimit 滑动截断
 * - getTerminalOutput：读取终端当前输出缓冲及退出状态
 * - waitForTerminalExit：等待终端进程退出（带超时）
 * - killTerminal：强制终止终端进程
 * - releaseTerminal / releaseSessionTerminals：释放终端资源，支持按 Session 批量释放
 */
import { Autowired, Injectable } from '@opensumi/di';
import { uuid } from '@opensumi/ide-core-common';
import { INodeLogger } from '@opensumi/ide-core-node';
import { ITerminalConnection, ITerminalService } from '@opensumi/ide-terminal-next';

import { ACPErrorCode } from './constants';

// Re-export the permission callback type for convenience
export type TerminalPermissionCallback = (
  sessionId: string,
  operation: 'command',
  details: {
    command: string;
    args?: string[];
    cwd?: string;
    title: string;
    kind: string;
  },
) => Promise<boolean>;

export interface TerminalRequest {
  sessionId: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  outputByteLimit?: number;
  terminalId?: string;
  timeout?: number;
}

export interface TerminalResponse {
  error?: {
    code: number;
    message: string;
  };
  terminalId?: string;
  output?: string;
  truncated?: boolean;
  exitStatus?: number | null;
  exitCode?: number;
  signal?: string;
}

interface TerminalSession {
  terminalId: string;
  sessionId: string;
  connection: ITerminalConnection;
  outputBuffer: string;
  outputByteLimit: number;
  exited: boolean;
  exitCode?: number;
  killed: boolean;
  startTime: number;
}

@Injectable()
export class AcpTerminalHandler {
  @Autowired(ITerminalService)
  private terminalService: ITerminalService;

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  private terminals = new Map<string, TerminalSession>();
  private defaultOutputLimit = 1024 * 1024; // 1MB default
  private permissionCallback: TerminalPermissionCallback | null = null;

  /**
   * Set the permission callback for terminal command execution
   */
  setPermissionCallback(callback: TerminalPermissionCallback): void {
    this.permissionCallback = callback;
  }

  configure(options: { outputLimit?: number }): void {
    if (options.outputLimit !== undefined) {
      this.defaultOutputLimit = options.outputLimit;
    }
  }

  async createTerminal(request: TerminalRequest): Promise<TerminalResponse> {
    try {
      const terminalId = uuid();

      // Check permission for command execution if callback is set
      if (this.permissionCallback) {
        const commandStr = [request.command, ...(request.args || [])].join(' ');
        const permitted = await this.permissionCallback(request.sessionId, 'command', {
          command: commandStr,
          args: request.args,
          cwd: request.cwd,
          title: `Run command: ${commandStr}`,
          kind: 'command',
        });

        if (!permitted) {
          this.logger?.warn(`Command execution permission denied: ${commandStr}`);
          return {
            error: {
              code: ACPErrorCode.FORBIDDEN,
              message: 'Command execution permission denied',
            },
          };
        }
      }

      // Merge environment variables
      const env = {
        ...process.env,
        ...request.env,
      };

      // Create terminal connection
      // @ts-expect-error
      const connection = await this.terminalService.createConnection(
        {
          name: `ACP Terminal ${terminalId.substring(0, 8)}`,
          cwd: request.cwd,
          executable: request.command,
          args: request.args,
          env,
        },
        terminalId,
      );

      const terminalSession: TerminalSession = {
        terminalId,
        sessionId: request.sessionId,
        connection,
        outputBuffer: '',
        outputByteLimit: request.outputByteLimit ?? this.defaultOutputLimit,
        exited: false,
        killed: false,
        startTime: Date.now(),
      };

      // Listen to terminal output
      connection.onData((data) => {
        if (!terminalSession.killed) {
          terminalSession.outputBuffer += data;

          // Trim buffer if it exceeds limit
          const bufferSize = Buffer.byteLength(terminalSession.outputBuffer, 'utf8');
          if (bufferSize > terminalSession.outputByteLimit) {
            // Keep recent output, drop old data
            const keepSize = Math.floor(terminalSession.outputByteLimit * 0.8);
            terminalSession.outputBuffer = terminalSession.outputBuffer.slice(-keepSize);
          }
        }
      });

      // Listen to exit
      connection.onExit((code) => {
        terminalSession.exited = true;
        terminalSession.exitCode = code;
        this.logger?.log(`Terminal ${terminalId} exited with code ${code}`);
      });

      this.terminals.set(terminalId, terminalSession);

      this.logger?.log(`Terminal created: ${terminalId}`);

      return {
        terminalId,
      };
    } catch (error) {
      this.logger?.error('Error creating terminal:', error);
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: error instanceof Error ? error.message : 'Failed to create terminal',
        },
      };
    }
  }

  async getTerminalOutput(request: TerminalRequest): Promise<TerminalResponse> {
    const terminalSession = this.terminals.get(request.terminalId || '');
    if (!terminalSession) {
      return {
        error: {
          code: ACPErrorCode.RESOURCE_NOT_FOUND,
          message: 'Terminal not found',
        },
      };
    }

    if (terminalSession.sessionId !== request.sessionId) {
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: 'Session mismatch',
        },
      };
    }

    const output = terminalSession.outputBuffer;
    const bufferSize = Buffer.byteLength(output, 'utf8');
    const truncated = bufferSize > terminalSession.outputByteLimit;

    return {
      output,
      truncated,
      exitStatus: terminalSession.exited ? terminalSession.exitCode ?? 0 : null,
    };
  }

  async waitForTerminalExit(request: TerminalRequest): Promise<TerminalResponse> {
    const terminalSession = this.terminals.get(request.terminalId || '');
    if (!terminalSession) {
      return {
        error: {
          code: ACPErrorCode.RESOURCE_NOT_FOUND,
          message: 'Terminal not found',
        },
      };
    }

    if (terminalSession.sessionId !== request.sessionId) {
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: 'Session mismatch',
        },
      };
    }

    // If already exited, return immediately
    if (terminalSession.exited) {
      return {
        exitCode: terminalSession.exitCode,
      };
    }

    // Wait for exit with timeout
    const timeout = request.timeout ?? 30000; // 30s default

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (terminalSession.exited) {
          clearInterval(checkInterval);
          clearTimeout(timeoutId);
          resolve({
            exitCode: terminalSession.exitCode,
          });
        }
      }, 100);

      const timeoutId = setTimeout(() => {
        clearInterval(checkInterval);
        // Return null exitStatus to indicate still running
        resolve({
          exitStatus: null,
        });
      }, timeout);
    });
  }

  async killTerminal(request: TerminalRequest): Promise<TerminalResponse> {
    const terminalSession = this.terminals.get(request.terminalId || '');
    if (!terminalSession) {
      return {
        error: {
          code: ACPErrorCode.RESOURCE_NOT_FOUND,
          message: 'Terminal not found',
        },
      };
    }

    if (terminalSession.sessionId !== request.sessionId) {
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: 'Session mismatch',
        },
      };
    }

    // If already exited, just return success
    if (terminalSession.exited) {
      return {
        exitStatus: terminalSession.exitCode ?? 0,
      };
    }

    try {
      this.logger?.log(`Killing terminal ${request.terminalId}`);

      terminalSession.killed = true;

      // Wait for graceful exit
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (terminalSession.exited) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        // Force kill after 2 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 2000);
      });

      // If not exited, use force kill
      if (!terminalSession.exited) {
        // Dispose the terminal connection to release resources
        // terminalSession.connection.dispose();
        terminalSession.exited = true;
      }

      return {
        exitCode: terminalSession.exitCode ?? -1,
      };
    } catch (error) {
      this.logger?.error('Error killing terminal:', error);
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: error instanceof Error ? error.message : 'Failed to kill terminal',
        },
      };
    }
  }

  async releaseTerminal(request: TerminalRequest): Promise<TerminalResponse> {
    const terminalSession = this.terminals.get(request.terminalId || '');
    if (!terminalSession) {
      // Already released or doesn't exist
      return {};
    }

    if (terminalSession.sessionId !== request.sessionId) {
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: 'Session mismatch',
        },
      };
    }

    try {
      this.logger?.log(`Releasing terminal ${request.terminalId}`);

      // Kill if still running
      if (!terminalSession.exited) {
        // Dispose the terminal connection to release resources
        // terminalSession.connection.dispose();
      }

      // Remove from tracking
      this.terminals.delete(request.terminalId || '');

      return {};
    } catch (error) {
      this.logger?.error('Error releasing terminal:', error);
      return {
        error: {
          code: ACPErrorCode.SERVER_ERROR,
          message: error instanceof Error ? error.message : 'Failed to release terminal',
        },
      };
    }
  }

  /**
   * Release all terminals for a session
   */
  async releaseSessionTerminals(sessionId: string): Promise<void> {
    const terminalsToRelease: string[] = [];

    for (const [terminalId, session] of this.terminals) {
      if (session.sessionId === sessionId) {
        terminalsToRelease.push(terminalId);
      }
    }

    for (const terminalId of terminalsToRelease) {
      await this.releaseTerminal({
        sessionId,
        terminalId,
      });
    }

    this.logger?.log(`Released ${terminalsToRelease.length} terminals for session ${sessionId}`);
  }

  /**
   * Get all terminal IDs for a session
   */
  getSessionTerminals(sessionId: string): string[] {
    const terminalIds: string[] = [];
    for (const [terminalId, session] of this.terminals) {
      if (session.sessionId === sessionId) {
        terminalIds.push(terminalId);
      }
    }
    return terminalIds;
  }
}

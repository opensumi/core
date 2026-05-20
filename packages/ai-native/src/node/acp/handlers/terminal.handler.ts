/**
 * ACP 终端操作处理器
 *
 * 为 CLI Agent 提供进程级终端（命令执行）能力：
 * - createTerminal：创建新终端并执行命令
 * - getTerminalOutput：读取终端当前输出缓冲及退出状态
 * - waitForTerminalExit：等待终端进程退出（带超时）
 * - killTerminal：强制终止终端进程
 * - releaseTerminal / releaseSessionTerminals：释放终端资源，支持按 Session 批量释放
 */
import * as pty from 'node-pty';

import { Autowired } from '@opensumi/di';
import { uuid } from '@opensumi/ide-core-common';
import { INodeLogger } from '@opensumi/ide-core-node';

import { ACPErrorCode } from './constants';

export const AcpTerminalHandlerToken = Symbol('AcpTerminalHandlerToken');

export interface CreateTerminalRequest {
  sessionId: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  outputByteLimit?: number;
}

export interface CreateTerminalResponse {
  terminalId?: string;
  error?: { message: string };
}

export interface IAcpTerminalHandler {
  createTerminal(req: CreateTerminalRequest): Promise<CreateTerminalResponse>;
  getTerminalOutput(
    terminalId: string,
    sessionId: string,
  ): Promise<{
    output?: string;
    truncated?: boolean;
    exitStatus?: number;
    error?: { message: string };
  }>;
  waitForTerminalExit(
    terminalId: string,
    sessionId: string,
  ): Promise<{
    exitCode?: number;
    signal?: string;
    error?: { message: string };
  }>;
  killTerminal(terminalId: string, sessionId: string): Promise<{ error?: { message: string } }>;
  releaseTerminal(terminalId: string, sessionId: string): Promise<{ error?: { message: string } }>;
  releaseSessionTerminals(sessionId: string): Promise<void>;
}

interface TerminalSession {
  terminalId: string;
  sessionId: string;
  ptyProcess: pty.IPty;
  outputBuffer: string;
  outputByteLimit: number;
  exited: boolean;
  exitCode?: number;
  killed: boolean;
  startTime: number;
}

export class AcpTerminalHandler implements IAcpTerminalHandler {
  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  private terminals = new Map<string, TerminalSession>();
  private defaultOutputLimit = 1024 * 1024; // 1MB default

  configure(options: { outputLimit?: number }): void {
    if (options.outputLimit !== undefined) {
      this.defaultOutputLimit = options.outputLimit;
    }
  }

  async createTerminal(request: CreateTerminalRequest): Promise<CreateTerminalResponse> {
    const startTime = Date.now();
    this.logger?.log(
      `[AcpTerminalHandler] createTerminal called, sessionId=${request.sessionId}, command=${
        request.command
      }, args=${JSON.stringify(request.args)}`,
    );

    try {
      const terminalId = uuid();
      this.logger?.log(`[AcpTerminalHandler] Generated terminalId: ${terminalId}`);

      // Merge environment variables
      const env = {
        ...process.env,
        ...request.env,
      };
      this.logger?.log(
        `[AcpTerminalHandler] Spawning PTY process: command=${request.command}, cwd=${request.cwd || process.cwd()}`,
      );

      // Create PTY process using node-pty
      const ptyProcess = pty.spawn(request.command, request.args || [], {
        name: 'xterm-256color',
        cwd: request.cwd || process.cwd(),
        env,
        cols: 80,
        rows: 24,
      });

      this.logger?.log(`[AcpTerminalHandler] PTY process spawned successfully, pid=${ptyProcess.pid}`);

      const terminalSession: TerminalSession = {
        terminalId,
        sessionId: request.sessionId,
        ptyProcess,
        outputBuffer: '',
        outputByteLimit: request.outputByteLimit ?? this.defaultOutputLimit,
        exited: false,
        killed: false,
        startTime: Date.now(),
      };

      // Listen to terminal output
      ptyProcess.onData((data) => {
        if (!terminalSession.killed) {
          terminalSession.outputBuffer += data;

          // Trim buffer if it exceeds limit
          const bufferSize = Buffer.byteLength(terminalSession.outputBuffer, 'utf8');
          if (bufferSize > terminalSession.outputByteLimit) {
            // Keep recent output, drop old data
            const keepSize = Math.floor(terminalSession.outputByteLimit * 0.8);
            terminalSession.outputBuffer = terminalSession.outputBuffer.slice(-keepSize);
            this.logger?.debug(`[AcpTerminalHandler] Terminal output buffer trimmed, kept ${keepSize} bytes`);
          }
        }
      });

      // Listen to exit
      ptyProcess.onExit((e) => {
        terminalSession.exited = true;
        terminalSession.exitCode = e.exitCode;
        const duration = Date.now() - startTime;
        this.logger?.log(
          `[AcpTerminalHandler] Terminal ${terminalId} exited with code ${e.exitCode}, duration=${duration}ms`,
        );
      });

      this.terminals.set(terminalId, terminalSession);
      this.logger?.log(
        `[AcpTerminalHandler] Terminal created successfully: ${terminalId}, total terminals: ${this.terminals.size}`,
      );

      return {
        terminalId,
      };
    } catch (error) {
      this.logger?.error('[AcpTerminalHandler] Error creating terminal:', error);
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to create terminal',
        },
      };
    }
  }

  async getTerminalOutput(
    terminalId: string,
    sessionId: string,
  ): Promise<{
    output?: string;
    truncated?: boolean;
    exitStatus?: number;
    error?: { message: string };
  }> {
    this.logger?.debug(`[AcpTerminalHandler] getTerminalOutput called, terminalId=${terminalId}`);

    const terminalSession = this.terminals.get(terminalId);
    if (!terminalSession) {
      this.logger?.warn(`[AcpTerminalHandler] Terminal not found: ${terminalId}`);
      return {
        error: {
          message: 'Terminal not found',
        },
      };
    }

    if (terminalSession.sessionId !== sessionId) {
      this.logger?.warn(
        `[AcpTerminalHandler] Session mismatch: expected ${terminalSession.sessionId}, got ${sessionId}`,
      );
      return {
        error: {
          message: 'Session mismatch',
        },
      };
    }

    const output = terminalSession.outputBuffer;
    const bufferSize = Buffer.byteLength(output, 'utf8');
    const truncated = bufferSize > terminalSession.outputByteLimit;

    this.logger?.debug(
      `[AcpTerminalHandler] getTerminalOutput: bufferSize=${bufferSize}, truncated=${truncated}, exited=${terminalSession.exited}`,
    );

    return {
      output,
      truncated,
      exitStatus: terminalSession.exited ? terminalSession.exitCode ?? 0 : undefined,
    };
  }

  async waitForTerminalExit(
    terminalId: string,
    sessionId: string,
  ): Promise<{
    exitCode?: number;
    signal?: string;
    error?: { message: string };
  }> {
    this.logger?.debug(`[AcpTerminalHandler] waitForTerminalExit called, terminalId=${terminalId}`);

    const terminalSession = this.terminals.get(terminalId);
    if (!terminalSession) {
      this.logger?.warn(`[AcpTerminalHandler] Terminal not found: ${terminalId}`);
      return {
        error: {
          message: 'Terminal not found',
        },
      };
    }

    if (terminalSession.sessionId !== sessionId) {
      this.logger?.warn(
        `[AcpTerminalHandler] Session mismatch: expected ${terminalSession.sessionId}, got ${sessionId}`,
      );
      return {
        error: {
          message: 'Session mismatch',
        },
      };
    }

    // If already exited, return immediately
    if (terminalSession.exited) {
      this.logger?.log(`[AcpTerminalHandler] Terminal ${terminalId} already exited, code=${terminalSession.exitCode}`);
      return {
        exitCode: terminalSession.exitCode,
      };
    }

    this.logger?.log(`[AcpTerminalHandler] Waiting for terminal ${terminalId} to exit...`);

    // Wait for exit with timeout (30s default)
    const timeout = 30000;
    const waitStartTime = Date.now();

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (terminalSession.exited) {
          clearInterval(checkInterval);
          clearTimeout(timeoutId);
          const waitDuration = Date.now() - waitStartTime;
          this.logger?.log(
            `[AcpTerminalHandler] Terminal ${terminalId} exited after ${waitDuration}ms, code=${terminalSession.exitCode}`,
          );
          resolve({
            exitCode: terminalSession.exitCode,
          });
        }
      }, 100);

      const timeoutId = setTimeout(() => {
        clearInterval(checkInterval);
        const waitDuration = Date.now() - waitStartTime;
        this.logger?.warn(
          `[AcpTerminalHandler] waitForTerminalExit timeout after ${waitDuration}ms for terminal ${terminalId}`,
        );
        resolve({});
      }, timeout);
    });
  }

  async killTerminal(terminalId: string, sessionId: string): Promise<{ error?: { message: string } }> {
    const terminalSession = this.terminals.get(terminalId);
    if (!terminalSession) {
      return {
        error: {
          message: 'Terminal not found',
        },
      };
    }

    if (terminalSession.sessionId !== sessionId) {
      return {
        error: {
          message: 'Session mismatch',
        },
      };
    }

    // If already exited, just return success
    if (terminalSession.exited) {
      return {};
    }

    try {
      this.logger?.log(`Killing terminal ${terminalId}`);

      terminalSession.killed = true;

      // Kill the PTY process
      terminalSession.ptyProcess.kill();

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

      // If not exited, mark as exited
      if (!terminalSession.exited) {
        terminalSession.exited = true;
      }

      return {};
    } catch (error) {
      this.logger?.error('Error killing terminal:', error);
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to kill terminal',
        },
      };
    }
  }

  async releaseTerminal(terminalId: string, sessionId: string): Promise<{ error?: { message: string } }> {
    const terminalSession = this.terminals.get(terminalId);
    if (!terminalSession) {
      // Already released or doesn't exist
      return {};
    }

    if (terminalSession.sessionId !== sessionId) {
      return {
        error: {
          message: 'Session mismatch',
        },
      };
    }

    try {
      this.logger?.log(`Releasing terminal ${terminalId}`);

      // Kill the PTY process if not already exited
      if (!terminalSession.exited) {
        try {
          terminalSession.ptyProcess.kill();
        } catch (e) {
          this.logger?.warn(`Failed to kill pty process ${terminalId}:`, e);
        }
      }

      // Remove from tracking
      this.terminals.delete(terminalId);

      return {};
    } catch (error) {
      this.logger?.error('Error releasing terminal:', error);
      return {
        error: {
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
      await this.releaseTerminal(terminalId, sessionId);
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

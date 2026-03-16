/**
 * CLI Agent 进程管理器
 *
 * 以单一实例模式管理 ACP CLI Agent 子进程的完整生命周期：
 * - 整个应用只维护一个 Agent 进程实例（singleton）
 * - startAgent：若进程已存在且仍在运行则直接复用，否则停止旧进程后重新创建
 * - 提供优雅关闭（SIGTERM）和强制杀进程（SIGKILL）两种停止策略
 * - 暴露 isRunning / getExitCode / listRunningAgents 等状态查询接口
 */
import { ChildProcess, spawn } from 'child_process';

import { Autowired, Injectable } from '@opensumi/di';
import { INodeLogger } from '@opensumi/ide-core-node';

export const CliAgentProcessManagerToken = Symbol('CliAgentProcessManagerToken');

/**
 * 进程配置常量
 */
const PROCESS_CONFIG = {
  /** 优雅关闭超时时间（毫秒） */
  GRACEFUL_SHUTDOWN_TIMEOUT_MS: 5000,
  /** 强制杀死超时时间（毫秒） */
  FORCE_KILL_TIMEOUT_MS: 3000,
  /** 启动超时时间（毫秒） */
  STARTUP_TIMEOUT_MS: 100,
} as const;

/**
 * 单一实例模式的 CLI Agent 进程管理器
 * 整个应用生命周期内只维护一个 Agent 进程实例
 */
export interface ICliAgentProcessManager {
  /**
   * 启动或返回已有的 Agent 进程
   * 如果进程已存在且仍在运行，直接返回已有进程
   * 如果进程已退出，清理后重新创建
   * 如果调用参数与现有进程不同，会先停止现有进程再创建新的
   */
  startAgent(
    command: string,
    args: string[],
    env: Record<string, string>,
    cwd: string,
  ): Promise<{ processId: string; stdout: NodeJS.ReadableStream; stdin: NodeJS.WritableStream }>;
  /**
   * 停止当前运行的 Agent 进程
   * 单一实例模式下，processId 参数被忽略
   */
  stopAgent(): Promise<void>;
  /**
   * 强制杀死当前运行的 Agent 进程
   * 单一实例模式下，processId 参数被忽略
   */
  killAgent(): Promise<void>;
  /**
   * 检查当前进程是否仍在运行
   * 单一实例模式下，processId 参数被忽略
   */
  isRunning(): boolean;
  /**
   * 获取当前进程的退出码
   * 单一实例模式下，processId 参数被忽略
   */
  getExitCode(): number | null;
  /**
   * 列出所有运行的 Agent 进程
   * 单一实例模式下，最多返回一个进程 ID
   */
  listRunningAgents(): string[];
  /**
   * 杀死所有 Agent 进程
   * 单一实例模式下，等同于 killAgent
   */
  killAllAgents(): Promise<void>;
}

/**
 * 单一实例模式的 CLI Agent 进程管理器
 *
 * 设计原则：
 * 1. 整个应用生命周期内只维护一个 Agent 进程实例
 * 2. startAgent 返回已有的进程（如果已存在且仍在运行）
 * 3. 如果进程已退出，清理后重新创建
 * 4. 如果调用参数与现有进程不同，先停止现有进程再创建新的
 */
@Injectable()
export class CliAgentProcessManager implements ICliAgentProcessManager {
  // 直接持有 ChildProcess 对象，不需要包装
  private currentProcess: ChildProcess | null = null;
  // 单独跟踪 cwd，因为 ChildProcess 没有 cwd 属性
  private currentCwd: string | null = null;

  // 固定进程 ID（单一实例模式使用常量）
  private readonly SINGLETON_PROCESS_ID = 'singleton-agent-process';

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  /**
   * 判断进程是否在运行（三合一检查）
   * 1. process.killed - 是否被标记为杀死
   * 2. process.exitCode !== null - 是否已有退出码
   * 3. process.kill(pid, 0) - 确认进程是否实际存在
   */
  private isProcessRunning(): boolean {
    if (!this.currentProcess) {
      return false;
    }

    // 被标记为 killed 或已有退出码，说明进程已退出
    if (this.currentProcess.killed || this.currentProcess.exitCode !== null) {
      return false;
    }

    // pid 不存在，说明进程未启动完成
    if (!this.currentProcess.pid) {
      return false;
    }

    // 使用 process.kill(0) 确认进程是否存在（不发送信号，仅检查）__抛出异常__：进程不存在或没有权限，进入 `catch` 块返回 `false`
    try {
      process.kill(this.currentProcess.pid, 0);
      return true;
    } catch {
      // 进程不存在
      return false;
    }
  }

  /**
   * 比较配置是否相同（只关心 cwd，因为 cwd 决定了工作目录）
   */
  private isConfigSame(command: string, args: string[], env: Record<string, string>, cwd: string): boolean {
    // 简化：只检查 cwd 是否相同
    return cwd === this.currentCwd;
  }

  /**
   * 启动或返回已有的 Agent 进程
   *
   * 行为：
   * 1. 如果已有进程且仍在运行，直接返回
   * 2. 如果已有进程但已退出，清理后重新创建
   * 3. 如果调用参数与现有进程不同，先停止现有进程再创建新的
   */
  async startAgent(
    command: string,
    args: string[],
    env: Record<string, string>,
    cwd: string,
  ): Promise<{ processId: string; stdout: NodeJS.ReadableStream; stdin: NodeJS.WritableStream }> {
    this.logger?.log(`[CliAgentProcessManager] startAgent called: command=${command}, cwd=${cwd}`);

    // 检查是否已有进程且仍在运行
    if (this.currentProcess && this.isProcessRunning()) {
      // 检查配置是否相同
      const isConfigSame = this.isConfigSame(command, args, env, cwd);
      if (isConfigSame) {
        this.logger?.log('[CliAgentProcessManager] Reusing existing running process');
        return {
          processId: this.currentProcess.pid!.toString(),
          stdout: this.currentProcess.stdio[1] as NodeJS.ReadableStream,
          stdin: this.currentProcess.stdio[0] as NodeJS.WritableStream,
        };
      } else {
        // 配置不同，先停止现有进程
        this.logger?.log('[CliAgentProcessManager] Config changed, stopping existing process');
        await this.stopAgentInternal();
      }
    } else if (this.currentProcess) {
      // 进程已退出，自动清理（exit 事件应该已经处理了）
      this.logger?.log('[CliAgentProcessManager] Previous process exited, cleaning up');
      this.currentProcess = null;
      this.currentCwd = null;
    }

    // 创建新进程
    this.logger?.log('[CliAgentProcessManager] Creating new agent process');
    const childProcess = await this.createAgentProcess(command, args, env, cwd);
    this.currentProcess = childProcess;
    this.currentCwd = cwd;

    this.logger?.log(`[CliAgentProcessManager] Agent process started with PID: ${childProcess.pid}`);

    return {
      processId: this.currentProcess.pid!.toString(),
      stdout: childProcess.stdio[1] as NodeJS.ReadableStream,
      stdin: childProcess.stdio[0] as NodeJS.WritableStream,
    };
  }

  /**
   * 创建新的 Agent 进程
   */
  private async createAgentProcess(
    command: string,
    args: string[],
    env: Record<string, string>,
    cwd: string,
  ): Promise<ChildProcess> {
    const childProcess = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false, // 不使用 detached，因为我们需要等待子进程退出
      shell: false, // 不使用 shell，避免产生额外的中间进程
    });

    return new Promise((resolve, reject) => {
      let startupError: Error | null = null;

      // Handle startup errors
      childProcess.on('error', (err: Error) => {
        this.logger?.error(`Failed to start agent process: ${err.message}`);
        startupError = err;
        reject(this.wrapError(err, command));
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        const stderr = data.toString('utf8');
        this.logger?.warn('[CliAgentProcessManager] Agent stderr:', stderr);
      });

      childProcess.on('exit', (code: number | null, signal: string | null) => {
        this.logger?.log(`[CliAgentProcessManager] Child process exit event: code=${code}, signal=${signal}`);
        this.handleProcessExit(code, signal);
      });

      setTimeout(() => {
        if (startupError) {
          return;
        }

        if (childProcess.pid) {
          resolve(childProcess);
        } else {
          reject(new Error(`Failed to get PID for agent process: ${command}`));
        }
      }, PROCESS_CONFIG.STARTUP_TIMEOUT_MS);
    });
  }

  /**
   * 处理进程退出 - 自动清理状态
   */
  private handleProcessExit(code: number | null, signal: string | null): void {
    this.logger?.log(`[CliAgentProcessManager] Process exited: code=${code}, signal=${signal}`);

    // 进程退出后自动清空引用
    this.currentProcess = null;
    this.currentCwd = null;
  }

  /**
   * 杀死进程组
   * 尝试用 -pid kill 进程组，失败后 fallback 到单个进程 kill
   * @param pid - 进程 ID
   * @param signal - 信号类型
   * @returns 是否成功
   */
  private killProcessGroup(pid: number, signal: NodeJS.Signals): boolean {
    try {
      // 尝试发送信号到进程组
      process.kill(-pid, signal);
      this.logger?.log(`[CliAgentProcessManager] Sent ${signal} to process group -${pid}`);
      return true;
    } catch (err) {
      // 如果进程组 kill 失败，尝试直接 kill 单个进程
      this.logger?.log(`[CliAgentProcessManager] Process group kill failed, trying single process kill for ${pid}`);
      try {
        process.kill(pid, signal);
        this.logger?.log(`[CliAgentProcessManager] Sent ${signal} to process ${pid}`);
        return true;
      } catch (err2) {
        this.logger?.warn(`[CliAgentProcessManager] Error sending ${signal}:`, err2);
        return false;
      }
    }
  }

  /**
   * 停止当前运行的 Agent 进程（内部方法）
   */
  private async stopAgentInternal(): Promise<void> {
    if (!this.currentProcess) {
      return;
    }

    this.logger?.log('[CliAgentProcessManager] Stopping agent process gracefully');
    return new Promise((resolve) => {
      if (!this.currentProcess) {
        resolve();
        return;
      }

      // 1. 先发送 SIGTERM，让进程优雅关闭
      const pid = this.currentProcess.pid;
      if (pid) {
        this.killProcessGroup(pid, 'SIGTERM');
      }

      // 2. 设置超时，超时后强制杀死
      const forceKillTimeout = setTimeout(() => {
        if (this.currentProcess && !this.currentProcess.killed) {
          this.logger?.warn('[CliAgentProcessManager] Agent did not exit gracefully, forcing kill');
          if (this.currentProcess.pid) {
            this.killProcessGroup(this.currentProcess.pid, 'SIGKILL');
          }
        }
        resolve();
      }, PROCESS_CONFIG.GRACEFUL_SHUTDOWN_TIMEOUT_MS);

      // 3. 监听进程退出，提前 resolve
      this.currentProcess.once('exit', () => {
        clearTimeout(forceKillTimeout);
        resolve();
      });
    });
  }

  /**
   * 停止当前运行的 Agent 进程
   */
  async stopAgent(): Promise<void> {
    if (!this.currentProcess) {
      this.logger?.warn('[CliAgentProcessManager] Cannot stop agent: process not found');
      return;
    }

    await this.stopAgentInternal();
  }

  /**
   * 强制杀死当前运行的 Agent 进程
   */
  async killAgent(): Promise<void> {
    this.logger?.log('[CliAgentProcessManager] Force killing agent process');
    await this.forceKillInternal();
  }

  /**
   * 强制杀死进程（内部方法）
   * 使用 -pid 杀死整个进程组，确保子进程也被杀死
   */
  private async forceKillInternal(): Promise<void> {
    if (!this.currentProcess || !this.currentProcess.pid) {
      this.currentProcess = null;
      return;
    }

    const pid = this.currentProcess.pid;

    // 记录调用堆栈，便于追踪是谁触发了强制杀死
    const stackTrace = new Error('forceKillInternal called').stack;
    this.logger?.debug(`[CliAgentProcessManager] forceKillInternal called for PID ${pid}`, stackTrace);

    // 使用负数 PID 杀死整个进程组（包括子进程）
    // 注意：需要使用 process.kill(-pid, signal) 而不是 this.currentProcess.kill(signal)
    this.killProcessGroup(pid, 'SIGKILL');

    // 等待进程退出或超时
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.logger?.warn(`[CliAgentProcessManager] Force kill timeout for PID ${pid}, clearing reference`);
        this.currentProcess = null;
        this.currentCwd = null;
        resolve();
      }, PROCESS_CONFIG.FORCE_KILL_TIMEOUT_MS);

      // 统一使用 exit 事件监听，超时机制确保引用最终被清理
      this.currentProcess!.once('exit', () => {
        clearTimeout(timeout);
        this.logger?.log(`[CliAgentProcessManager] Process ${pid} exited, clearing reference`);
        this.currentProcess = null;
        this.currentCwd = null;
        resolve();
      });
    });
  }

  /**
   * 检查当前进程是否仍在运行
   */
  isRunning(): boolean {
    return this.isProcessRunning();
  }

  /**
   * 获取当前进程的退出码
   */
  getExitCode(): number | null {
    return this.currentProcess?.exitCode ?? null;
  }

  /**
   * 列出所有运行的 Agent 进程
   */
  listRunningAgents(): string[] {
    if (this.currentProcess && this.isProcessRunning()) {
      return [this.SINGLETON_PROCESS_ID];
    }
    return [];
  }

  /**
   * 杀死所有 Agent 进程
   */
  async killAllAgents(): Promise<void> {
    this.logger?.log('[CliAgentProcessManager] Killing all agent processes');
    await this.forceKillInternal();
  }

  private wrapError(err: Error, command: string): Error {
    if ((err as any).code === 'ENOENT') {
      return new Error(`Command not found: ${command}. Please ensure the CLI agent is installed.`);
    }
    if ((err as any).code === 'EACCES' || (err as any).code === 'EPERM') {
      return new Error(`Permission denied when executing: ${command}`);
    }
    return err;
  }
}

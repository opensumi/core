import { Autowired, Injectable } from '@opensumi/di';
import { Deferred, Disposable, IDisposable } from '@opensumi/ide-core-common';
import {
  AvailableCommand,
  ListSessionsRequest,
  ListSessionsResponse,
  SessionNotification,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';
import { AgentProcessConfig } from '@opensumi/ide-core-common/lib/types/ai-native/agent-types';
import { AppConfig, INodeLogger } from '@opensumi/ide-core-node';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

import {
  AcpThread,
  AcpThreadEvent,
  AcpThreadFactory,
  AcpThreadFactoryToken,
  AcpThreadRuntimeConfig,
} from './acp-thread';
import { AcpTerminalHandler, AcpTerminalHandlerToken } from './handlers/terminal.handler';

import type { AgentUpdate, AgentUpdateType, SimpleToolCall } from './acp-update-types';
export { AgentUpdate, AgentUpdateType, SimpleToolCall } from './acp-update-types';

// ============================================================================
// DI Token
// ============================================================================

export const AcpAgentServiceToken = Symbol('AcpAgentServiceToken');

// ============================================================================
// Agent Session Types
// ============================================================================

export type AgentSessionStatus = 'initializing' | 'ready' | 'running' | 'stopping' | 'stopped' | 'error';

export interface SimpleMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

export interface AgentSessionInfo {
  sessionId: string;
  /** threadId of the AcpThread instance */
  processId: string;
  modes: Array<{ id: string; name: string }>;
  status: AgentSessionStatus;
}

/**
 * Agent request parameters
 */
export interface AgentRequest {
  prompt: string;
  /** ACP session/prompt sessionId */
  sessionId: string;
  images?: string[];
  history?: SimpleMessage[];
}

export interface SessionLoadResult {
  sessionId: string;
  processId: string;
  modes: Array<{ id: string; name: string }>;
  status: AgentSessionStatus;
  historyUpdates: SessionNotification[];
}

// ============================================================================
// IAcpAgentService Interface
// ============================================================================

export interface IAcpAgentService {
  /**
   * Initialize Agent process and create a new session
   */
  initializeAgent(config: AgentProcessConfig): Promise<AgentSessionInfo>;

  /**
   * Load an existing Agent Session
   */
  loadSession(sessionId: string, config: AgentProcessConfig): Promise<SessionLoadResult>;

  /**
   * Send message to Agent (streaming)
   */
  sendMessage(request: AgentRequest, config: AgentProcessConfig): SumiReadableStream<AgentUpdate>;

  /**
   * Cancel a request
   */
  cancelRequest(sessionId: string): Promise<void>;

  /**
   * Stop all Agent processes
   */
  stopAgent(): Promise<void>;

  /**
   * Clean up all resources
   */
  dispose(): Promise<void>;

  /**
   * Get current Agent Session info
   */
  getSessionInfo(sessionId?: string): AgentSessionInfo | null;

  /**
   * Create a new session
   */
  createSession(config: AgentProcessConfig): Promise<{ sessionId: string; availableCommands: AvailableCommand[] }>;

  /**
   * List all ACP Agent sessions
   */
  listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse>;

  /**
   * Switch Session mode
   */
  setSessionMode(params: { sessionId: string; modeId: string }): Promise<void>;

  /**
   * Load existing session, fallback to new session if load fails.
   */
  loadSessionOrNew(sessionId: string, config: AgentProcessConfig): Promise<SessionLoadResult>;

  /**
   * Release resources for a specific session (including terminals)
   * By default, the thread returns to the pool for reuse.
   * Pass force=true to fully dispose the thread.
   */
  disposeSession(sessionId: string, force?: boolean): Promise<void>;

  /**
   * Get available modes from initialize negotiation
   */
  getAvailableModes(): Promise<any | null>;
}

// ============================================================================
// AcpAgentService — Thread Pool Implementation
// ============================================================================

/**
 * ACP Agent Service with Thread Pool management.
 *
 * Design principles:
 * 1. Manages multiple AcpThread instances, each with its own Agent process
 * 2. Thread pool for reuse — threads are not disposed on session end by default
 * 3. Streaming responses via SumiReadableStream
 * 4. Deferred pattern for session creation (no setTimeout polling)
 */
@Injectable()
export class AcpAgentService extends Disposable implements IAcpAgentService {
  @Autowired(AcpThreadFactoryToken)
  private threadFactory: AcpThreadFactory;

  @Autowired(AcpTerminalHandlerToken)
  private terminalHandler: AcpTerminalHandler;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  // Session -> Thread mapping (active sessions)
  private sessions = new Map<string, AcpThread>();

  // Thread pool: all thread instances (active + idle/disconnected)
  private threadPool: AcpThread[] = [];

  // Pool limit (configurable)
  private readonly maxPoolSize = 10;

  // Cached session info for backward compat (getSessionInfo without sessionId)
  private lastSessionInfo: AgentSessionInfo | null = null;

  // -----------------------------------------------------------------------
  // Core: findOrCreateThread
  // -----------------------------------------------------------------------

  /**
   * Find or create a thread for the given sessionId.
   * 1. Active session mapping exists -> return it
   * 2. Pool has idle thread -> bind to session
   * 3. Pool not full -> create new thread
   * 4. Pool full, no idle -> throw
   */
  private async findOrCreateThread(sessionId: string, config: AgentProcessConfig): Promise<AcpThread> {
    // 1. Active session mapping exists
    const existing = this.sessions.get(sessionId);
    if (existing && existing.getStatus() !== 'disconnected') {
      return existing;
    }

    // 2. Pool has idle thread (idle or awaiting_prompt, not bound to active session)
    const idleThread = this.threadPool.find(
      (t) => !this.hasActiveSession(t) && ['idle', 'awaiting_prompt'].includes(t.getStatus()),
    );
    if (idleThread) {
      this.sessions.set(sessionId, idleThread);
      return idleThread;
    }

    // 3. Pool not full, create new
    if (this.threadPool.length < this.maxPoolSize) {
      const thread = this.createThreadInstance(sessionId, config);
      this.threadPool.push(thread);
      this.sessions.set(sessionId, thread);
      return thread;
    }

    // 4. Pool full, no idle — throw error
    throw new Error(`Thread pool is full (${this.maxPoolSize}), no idle thread available`);
  }

  /**
   * Check if a thread is bound to any active session.
   */
  private hasActiveSession(thread: AcpThread): boolean {
    for (const [, t] of this.sessions) {
      if (t === thread) {
        return true;
      }
    }
    return false;
  }

  /**
   * Create a new AcpThread instance via factory.
   */
  private createThreadInstance(sessionId: string, config: AgentProcessConfig): AcpThread {
    const runtimeConfig: AcpThreadRuntimeConfig = {
      command: config.command,
      args: config.args,
      env: config.env,
      cwd: config.cwd,
    };
    const thread = this.threadFactory(sessionId, runtimeConfig);
    this.logger.log(`[AcpAgentService] Created new thread ${thread.threadId} for session ${sessionId}`);
    return thread;
  }

  /**
   * Find an idle thread or create a new one, without binding to a sessionId.
   */
  private async findOrCreateIdleThread(config: AgentProcessConfig): Promise<AcpThread> {
    const idleThread = this.threadPool.find(
      (t) => !this.hasActiveSession(t) && ['idle', 'awaiting_prompt'].includes(t.getStatus()),
    );
    if (idleThread) {
      return idleThread;
    }

    if (this.threadPool.length < this.maxPoolSize) {
      const runtimeConfig: AcpThreadRuntimeConfig = {
        command: config.command,
        args: config.args,
        env: config.env,
        cwd: config.cwd,
      };
      const thread = this.threadFactory('', runtimeConfig);
      this.threadPool.push(thread);
      return thread;
    }

    throw new Error(`Thread pool is full (${this.maxPoolSize}), no idle thread available`);
  }

  // -----------------------------------------------------------------------
  // createSession — with Deferred pattern (NOT setTimeout)
  // -----------------------------------------------------------------------

  async createSession(
    config: AgentProcessConfig,
  ): Promise<{ sessionId: string; availableCommands: AvailableCommand[] }> {
    this.logger.log(`[AcpAgentService] createSession() — cwd=${config.cwd}, command=${config.command}`);
    const poolSizeBefore = this.threadPool.length;
    const thread = await this.findOrCreateIdleThread(config);
    const wasExisting = this.threadPool.length === poolSizeBefore;

    const availableCommands: AvailableCommand[] = [];
    const deferred = new Deferred<void>();

    const disposable = thread.onEvent((event: AcpThreadEvent) => {
      if (event.type === 'session_notification') {
        const update = (event.notification as any).update;
        if (update?.sessionUpdate === 'available_commands_update' && Array.isArray(update.availableCommands)) {
          availableCommands.push(...update.availableCommands);
          deferred.resolve();
        }
      }
    });

    let realSessionId: string | undefined;

    try {
      if (!thread.initialized) {
        await thread.initialize(config as any);
      }
      if (thread.needsReset) {
        thread.reset();
      }

      const newSessionResponse = await thread.newSession({
        cwd: config.cwd,
        mcpServers: [],
      } as any);

      realSessionId = newSessionResponse.sessionId;
      this.sessions.set(realSessionId, thread);

      await Promise.race([
        deferred.promise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Wait for commands timeout')), 5000)),
      ]);

      const seen = new Set<string>();
      const deduplicated = availableCommands.filter((cmd) => {
        if (seen.has(cmd.name)) {
          return false;
        }
        seen.add(cmd.name);
        return true;
      });

      this.updateLastSessionInfo(realSessionId, thread, deduplicated);

      this.logger.log(
        `[AcpAgentService] createSession() — done, sessionId=${realSessionId}, commands=${deduplicated.length}`,
      );
      this.logPoolStatus('after-createSession');

      return { sessionId: realSessionId, availableCommands: deduplicated };
    } catch (e) {
      if (realSessionId) {
        this.sessions.delete(realSessionId);
      }
      this.logger.error(`[AcpAgentService] createSession() — failed: ${e instanceof Error ? e.message : String(e)}`);
      if (!wasExisting) {
        const idx = this.threadPool.indexOf(thread);
        if (idx !== -1) {
          this.threadPool.splice(idx, 1);
        }
        await thread.dispose();
      } else {
        thread.reset();
      }
      throw e;
    } finally {
      disposable.dispose();
    }
  }

  // -----------------------------------------------------------------------
  // initializeAgent — create a session and return info
  // -----------------------------------------------------------------------

  async initializeAgent(config: AgentProcessConfig): Promise<AgentSessionInfo> {
    const result = await this.createSession(config);
    return {
      sessionId: result.sessionId,
      processId: this.sessions.get(result.sessionId)?.threadId || '',
      modes: [],
      status: 'ready',
    };
  }

  // -----------------------------------------------------------------------
  // loadSession
  // -----------------------------------------------------------------------

  async loadSession(sessionId: string, config: AgentProcessConfig): Promise<SessionLoadResult> {
    this.logger.log(`[AcpAgentService] loadSession() — sessionId=${sessionId}`);

    // 1. sessions.get(sessionId) exists -> return directly
    const existingThread = this.sessions.get(sessionId);
    if (existingThread && existingThread.getStatus() !== 'disconnected') {
      this.logger.log(`[AcpAgentService] loadSession() — thread already bound, threadId=${existingThread.threadId}`);
      return this.buildSessionLoadResult(sessionId, existingThread);
    }

    // 2. Pool has idle Thread
    const idleThread = this.threadPool.find(
      (t) => !this.hasActiveSession(t) && ['idle', 'awaiting_prompt'].includes(t.getStatus()),
    );
    if (idleThread) {
      this.logger.log(`[AcpAgentService] loadSession() — reusing idle thread ${idleThread.threadId}`);
      this.sessions.set(sessionId, idleThread);
      try {
        if (!idleThread.initialized) {
          await idleThread.initialize(config as any);
        }
        if (idleThread.needsReset) {
          idleThread.reset();
        }
        await idleThread.loadSession({
          sessionId,
          cwd: config.cwd,
          mcpServers: [],
        } as any);
      } catch (e) {
        this.sessions.delete(sessionId);
        idleThread.reset();
        this.logger.error(
          `[AcpAgentService] loadSession() — idle thread reuse failed: ${e instanceof Error ? e.message : String(e)}`,
        );
        throw e;
      }
      return this.buildSessionLoadResult(sessionId, idleThread);
    }

    // 3. Pool not full -> new Thread
    if (this.threadPool.length < this.maxPoolSize) {
      this.logger.log(
        `[AcpAgentService] loadSession() — creating new thread (pool=${this.threadPool.length}/${this.maxPoolSize})`,
      );
      const thread = this.createThreadInstance(sessionId, config);
      this.threadPool.push(thread);
      this.sessions.set(sessionId, thread);

      try {
        await thread.initialize(config as any);
        await thread.loadSession({
          sessionId,
          cwd: config.cwd,
          mcpServers: [],
        } as any);
      } catch (e) {
        const idx = this.threadPool.indexOf(thread);
        if (idx !== -1) {
          this.threadPool.splice(idx, 1);
        }
        this.sessions.delete(sessionId);
        await thread.dispose();
        throw e;
      }
      return this.buildSessionLoadResult(sessionId, thread);
    }

    // 4. Pool full, no idle -> throw error
    throw new Error(`Thread pool is full (${this.maxPoolSize}), no idle thread available`);
  }

  private buildSessionLoadResult(sessionId: string, thread: AcpThread): SessionLoadResult {
    const historyUpdates: SessionNotification[] = [];
    // Collect existing entries as notifications for backward compat
    for (const entry of thread.getEntries()) {
      // Convert entries back to notification-like format (simplified)
      if (entry.type === 'user_message') {
        historyUpdates.push({
          sessionId,
          update: {
            sessionUpdate: 'user_message_chunk',
            content: { type: 'text', text: entry.data.content },
          },
        } as SessionNotification);
      } else if (entry.type === 'assistant_message') {
        for (const chunk of entry.data.chunks) {
          historyUpdates.push({
            sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: chunk,
            },
          } as SessionNotification);
        }
      }
    }

    const modes: Array<{ id: string; name: string }> = [];

    this.updateLastSessionInfo(sessionId, thread, []);

    return {
      sessionId,
      processId: thread.threadId,
      modes,
      status: 'ready',
      historyUpdates,
    };
  }

  // -----------------------------------------------------------------------
  // sendMessage — streaming forward
  // -----------------------------------------------------------------------

  sendMessage(request: AgentRequest, config: AgentProcessConfig): SumiReadableStream<AgentUpdate> {
    const stream = new SumiReadableStream<AgentUpdate>();

    const thread = this.sessions.get(request.sessionId);
    if (!thread) {
      this.logger.error(`[AcpAgentService] sendMessage() — no thread for sessionId=${request.sessionId}`);
      stream.emitError(new Error(`No active session for sessionId: ${request.sessionId}`));
      return stream;
    }

    // Add user message to thread entries
    thread.addUserMessage(request.prompt);

    this.logger.log(
      `[AcpAgentService] sendMessage() — sessionId=${request.sessionId}, thread=${thread.threadId}, entries=${
        thread.getEntries().length
      }`,
    );

    // Subscribe thread.onEvent: session_notification -> emitData to stream
    const disposables: IDisposable[] = [];

    const eventDisposable = thread.onEvent((event: AcpThreadEvent) => {
      if (event.type === 'session_notification') {
        const agentUpdate = thread.toAgentUpdate(event.notification);
        if (agentUpdate) {
          stream.emitData(agentUpdate);
        }
      }
    });
    disposables.push(eventDisposable);

    // Stream onEnd / onError -> cleanup subscriptions
    stream.onEnd(() => {
      disposables.forEach((d) => d.dispose());
    });
    stream.onError(() => {
      disposables.forEach((d) => d.dispose());
    });

    // thread.prompt() -> then markAssistantComplete -> emitData('done') -> stream.end()
    this.sendPrompt(thread, request, stream, disposables);

    return stream;
  }

  private async sendPrompt(
    thread: AcpThread,
    request: AgentRequest,
    stream: SumiReadableStream<AgentUpdate>,
    disposables: IDisposable[],
  ): Promise<void> {
    try {
      const promptBlocks = this.buildPromptBlocks(request.prompt, request.images);
      await thread.prompt({
        sessionId: request.sessionId,
        prompt: promptBlocks,
      } as any);

      thread.markAssistantComplete();
      stream.emitData({ type: 'done', content: '' });
      stream.end();
    } catch (error) {
      stream.emitError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // -----------------------------------------------------------------------
  // cancelRequest
  // -----------------------------------------------------------------------

  async cancelRequest(sessionId: string): Promise<void> {
    const thread = this.sessions.get(sessionId);
    if (!thread) {
      this.logger?.warn(`[AcpAgentService] cancelRequest: no thread for session ${sessionId}`);
      return;
    }

    try {
      await thread.cancel({ sessionId } as any);
    } catch (error) {
      this.logger?.warn('[AcpAgentService] cancelRequest error:', error);
    }
  }

  // -----------------------------------------------------------------------
  // listSessions
  // -----------------------------------------------------------------------

  async listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse> {
    const sessionList: Array<{ sessionId: string }> = [];
    for (const [sessionId, thread] of this.sessions) {
      if (thread.getStatus() !== 'disconnected') {
        sessionList.push({ sessionId });
      }
    }
    return { sessions: sessionList as any, nextCursor: undefined };
  }

  // -----------------------------------------------------------------------
  // setSessionMode
  // -----------------------------------------------------------------------

  async setSessionMode(params: { sessionId: string; modeId: string }): Promise<void> {
    const thread = this.sessions.get(params.sessionId);
    if (!thread) {
      throw new Error(`No active session for sessionId: ${params.sessionId}`);
    }

    try {
      await thread.setSessionMode({
        sessionId: params.sessionId,
        modeId: params.modeId,
      } as any);
    } catch (error) {
      this.logger?.warn(`[AcpAgentService] setSessionMode error for session ${params.sessionId}:`, error);
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // loadSessionOrNew — with fallback
  // -----------------------------------------------------------------------

  async loadSessionOrNew(sessionId: string, config: AgentProcessConfig): Promise<SessionLoadResult> {
    this.logger.log(`[AcpAgentService] loadSessionOrNew() — sessionId=${sessionId}`);

    const existingThread = this.sessions.get(sessionId);
    if (existingThread && existingThread.getStatus() !== 'disconnected') {
      return this.buildSessionLoadResult(sessionId, existingThread);
    }

    const poolSizeBefore = this.threadPool.length;
    const thread = await this.findOrCreateThread(sessionId, config);
    const wasExisting = this.threadPool.length === poolSizeBefore;

    try {
      if (!thread.initialized) {
        await thread.initialize(config as any);
      }
      if (thread.needsReset) {
        thread.reset();
      }
      await thread.loadSessionOrNew({
        sessionId,
        cwd: config.cwd,
        mcpServers: [],
      } as any);
      return this.buildSessionLoadResult(sessionId, thread);
    } catch (e) {
      this.sessions.delete(sessionId);
      this.logger.error(`[AcpAgentService] loadSessionOrNew() — failed: ${e instanceof Error ? e.message : String(e)}`);
      if (!wasExisting) {
        const idx = this.threadPool.indexOf(thread);
        if (idx !== -1) {
          this.threadPool.splice(idx, 1);
        }
        await thread.dispose();
      } else {
        thread.reset();
      }
      throw e;
    }
  }

  // -----------------------------------------------------------------------
  // disposeSession — default returns thread to pool, force disposes it
  // -----------------------------------------------------------------------

  async disposeSession(sessionId: string, force = false): Promise<void> {
    const thread = this.sessions.get(sessionId);
    this.logger.log(`[AcpAgentService] disposeSession() — sessionId=${sessionId}, force=${force}`);

    // Release terminals
    await this.terminalHandler.releaseSessionTerminals(sessionId);

    if (force && thread) {
      // Force dispose: release terminals + dispose thread
      this.logger.log(`[AcpAgentService] disposeSession() — force disposing thread ${thread.threadId}`);
      await thread.dispose();
      const idx = this.threadPool.indexOf(thread);
      if (idx !== -1) {
        this.threadPool.splice(idx, 1);
      }
    }

    // Default: just remove from session mapping, thread returns to pool
    this.sessions.delete(sessionId);
    this.logPoolStatus('after-disposeSession');
  }

  // -----------------------------------------------------------------------
  // getAvailableModes
  // -----------------------------------------------------------------------

  async getAvailableModes(): Promise<any | null> {
    // Return modes from the most recently used thread
    for (const thread of this.threadPool) {
      // AcpThread stores agentCapabilities but not modes directly
      // Modes come from initialize response; would need to track them
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // getSessionInfo
  // -----------------------------------------------------------------------

  getSessionInfo(sessionId?: string): AgentSessionInfo | null {
    if (sessionId) {
      const thread = this.sessions.get(sessionId);
      if (!thread) {
        return null;
      }
      return {
        sessionId,
        processId: thread.threadId,
        modes: [],
        status: this.threadStatusToAgentStatus(thread.getStatus()),
      };
    }
    return this.lastSessionInfo;
  }

  // -----------------------------------------------------------------------
  // stopAgent — dispose all threads
  // -----------------------------------------------------------------------

  async stopAgent(): Promise<void> {
    this.logger?.log(
      `[AcpAgentService] stopAgent() — disposing ${this.threadPool.length} threads, ${this.sessions.size} active sessions`,
    );

    for (const thread of this.threadPool) {
      try {
        await thread.dispose();
      } catch (error) {
        this.logger?.warn(`[AcpAgentService] Error disposing thread ${thread.threadId}:`, error);
      }
    }

    this.threadPool = [];
    this.sessions.clear();
    this.lastSessionInfo = null;
    this.logPoolStatus('after-stopAgent');
  }

  // -----------------------------------------------------------------------
  // dispose — clean up all resources
  // -----------------------------------------------------------------------

  async dispose(): Promise<void> {
    this.logger?.log('[AcpAgentService] dispose() — pool size=' + this.threadPool.length);
    await this.stopAgent();
    this.logger?.log('[AcpAgentService] dispose() — done');
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Log pool status summary — call after key pool operations.
   */
  private logPoolStatus(context: string): void {
    const threadsInfo = this.threadPool.map((t) => ({
      id: t.threadId,
      status: t.getStatus(),
      sid: t.sessionId || '-',
      entries: t.getEntries().length,
    }));
    const activeCount = this.sessions.size;
    this.logger.log(
      `[AcpAgentService] pool(${context}) — threads:${this.threadPool.length}/${
        this.maxPoolSize
      }, active_sessions:${activeCount}, threads=[${threadsInfo
        .map((t) => `${t.id}(${t.status},sid=${t.sid},entries=${t.entries})`)
        .join(', ')}]`,
    );
  }

  private threadStatusToAgentStatus(status: string): AgentSessionStatus {
    switch (status) {
      case 'idle':
      case 'awaiting_prompt':
        return 'ready';
      case 'working':
        return 'running';
      case 'disconnected':
        return 'stopped';
      case 'errored':
        return 'error';
      default:
        return 'ready';
    }
  }

  private updateLastSessionInfo(sessionId: string, thread: AcpThread, _commands: AvailableCommand[]): void {
    this.lastSessionInfo = {
      sessionId,
      processId: thread.threadId,
      modes: [],
      status: 'ready',
    };
  }

  private buildPromptBlocks(input: string, images?: string[]): Array<{ type: string; [key: string]: unknown }> {
    const blocks: Array<{ type: string; [key: string]: unknown }> = [];

    blocks.push({
      type: 'text',
      text: input,
    });

    if (images && images.length > 0) {
      for (const imageData of images) {
        const { mimeType, base64Data } = this.parseDataUrl(imageData);
        blocks.push({
          type: 'image',
          data: base64Data,
          mimeType,
        });
      }
    }

    return blocks;
  }

  private parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } {
    if (dataUrl.startsWith('data:')) {
      const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        return { mimeType: matches[1], base64Data: matches[2] };
      }
    }
    return { mimeType: 'image/jpeg', base64Data: dataUrl };
  }
}

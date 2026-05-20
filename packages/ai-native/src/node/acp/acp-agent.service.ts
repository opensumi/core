import { Autowired, Injectable } from '@opensumi/di';
import { Deferred, Disposable, IDisposable, uuid } from '@opensumi/ide-core-common';
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

export type AgentUpdateType = 'thought' | 'message' | 'tool_call' | 'tool_result' | 'done';

export interface AgentUpdate {
  type: AgentUpdateType;
  content: string;
  toolCall?: SimpleToolCall;
}

export interface SimpleToolCall {
  name: string;
  input: Record<string, unknown>;
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
      cwd: config.workspaceDir,
    };
    const thread = this.threadFactory(sessionId, runtimeConfig);
    this.logger.log(`[AcpAgentService] Created new thread ${thread.threadId} for session ${sessionId}`);
    return thread;
  }

  // -----------------------------------------------------------------------
  // createSession — with Deferred pattern (NOT setTimeout)
  // -----------------------------------------------------------------------

  async createSession(
    config: AgentProcessConfig,
  ): Promise<{ sessionId: string; availableCommands: AvailableCommand[] }> {
    const sessionId = uuid();

    // Check if there's an idle thread already
    const existingThread = this.threadPool.find(
      (t) => !this.hasActiveSession(t) && ['idle', 'awaiting_prompt'].includes(t.getStatus()),
    );
    const wasExisting = !!existingThread;

    const thread = await this.findOrCreateThread(sessionId, config);

    const availableCommands: AvailableCommand[] = [];
    const deferred = new Deferred<void>();

    // Subscribe to thread events to capture available_commands_update
    const disposable = thread.onEvent((event: AcpThreadEvent) => {
      if (event.type === 'session_notification') {
        const update = (event.notification as any).update;
        if (update?.sessionUpdate === 'available_commands_update' && Array.isArray(update.availableCommands)) {
          availableCommands.push(...update.availableCommands);
          deferred.resolve();
        }
      }
    });

    try {
      if (!thread.initialized) {
        await thread.initialize(config as any);
      }
      if (thread.needsReset) {
        thread.reset();
      }
      await thread.loadSessionOrNew({
        sessionId,
        cwd: config.workspaceDir,
        mcpServers: [],
      } as any);

      await Promise.race([
        deferred.promise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Wait for commands timeout')), 5000)),
      ]);

      // Deduplicate availableCommands by name
      const seen = new Set<string>();
      const deduplicated = availableCommands.filter((cmd) => {
        if (seen.has(cmd.name)) {
          return false;
        }
        seen.add(cmd.name);
        return true;
      });

      this.updateLastSessionInfo(sessionId, thread, deduplicated);

      return { sessionId, availableCommands: deduplicated };
    } catch (e) {
      this.sessions.delete(sessionId);
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
    // 1. sessions.get(sessionId) exists -> return directly
    const existingThread = this.sessions.get(sessionId);
    if (existingThread && existingThread.getStatus() !== 'disconnected') {
      return this.buildSessionLoadResult(sessionId, existingThread);
    }

    // 2. Pool has idle Thread
    const idleThread = this.threadPool.find(
      (t) => !this.hasActiveSession(t) && ['idle', 'awaiting_prompt'].includes(t.getStatus()),
    );
    if (idleThread) {
      this.sessions.set(sessionId, idleThread);
      if (!idleThread.initialized) {
        await idleThread.initialize(config as any);
      }
      if (idleThread.needsReset) {
        idleThread.reset();
      }
      await idleThread.loadSession({
        sessionId,
        cwd: config.workspaceDir,
        mcpServers: [],
      } as any);
      return this.buildSessionLoadResult(sessionId, idleThread);
    }

    // 3. Pool not full -> new Thread
    if (this.threadPool.length < this.maxPoolSize) {
      const thread = this.createThreadInstance(sessionId, config);
      this.threadPool.push(thread);
      this.sessions.set(sessionId, thread);

      await thread.initialize(config as any);
      await thread.loadSession({
        sessionId,
        cwd: config.workspaceDir,
        mcpServers: [],
      } as any);
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
      stream.emitError(new Error(`No active session for sessionId: ${request.sessionId}`));
      return stream;
    }

    // Add user message to thread entries
    thread.addUserMessage(request.prompt);

    // Subscribe thread.onEvent: session_notification -> emitData to stream
    const disposables: IDisposable[] = [];

    const eventDisposable = thread.onEvent((event: AcpThreadEvent) => {
      if (event.type === 'session_notification') {
        this.handleNotification(event.notification, stream);
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
  // handleNotification -> AgentUpdate mapping
  // -----------------------------------------------------------------------

  private handleNotification(notification: SessionNotification, stream: SumiReadableStream<AgentUpdate>): void {
    const update = (notification as any).update;
    if (!update) {
      return;
    }

    switch (update.sessionUpdate) {
      case 'agent_thought_chunk': {
        const content = update.content;
        if (content?.type === 'text') {
          stream.emitData({
            type: 'thought',
            content: content.text,
          });
        }
        break;
      }

      case 'agent_message_chunk': {
        const content = update.content;
        if (content?.type === 'text') {
          stream.emitData({
            type: 'message',
            content: content.text,
          });
        }
        break;
      }

      case 'tool_call': {
        stream.emitData({
          type: 'tool_call',
          content: update.title || '',
          toolCall: {
            name: update.title || '',
            input: (update.rawInput as Record<string, unknown>) || {},
          },
        });
        break;
      }

      case 'tool_call_update': {
        if (update.content) {
          for (const content of update.content) {
            if (content.type === 'diff') {
              stream.emitData({
                type: 'tool_result',
                content: `Modified ${content.path}`,
              });
            }
          }
        }
        break;
      }

      default:
        this.logger?.log(`[AcpAgentService] Unhandled session update type: ${update.sessionUpdate}`);
        break;
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
      sessionList.push({ sessionId });
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

    // AcpThread doesn't have a direct setSessionMode method, delegate to SDK connection
    // This would need the underlying SDK connection to support mode switching
    this.logger?.log(`[AcpAgentService] setSessionMode: ${params.sessionId} -> ${params.modeId}`);
  }

  // -----------------------------------------------------------------------
  // disposeSession — default returns thread to pool, force disposes it
  // -----------------------------------------------------------------------

  async disposeSession(sessionId: string, force = false): Promise<void> {
    const thread = this.sessions.get(sessionId);

    // Release terminals
    await this.terminalHandler.releaseSessionTerminals(sessionId);

    if (force && thread) {
      // Force dispose: release terminals + dispose thread
      await thread.dispose();
      const idx = this.threadPool.indexOf(thread);
      if (idx !== -1) {
        this.threadPool.splice(idx, 1);
      }
    }

    // Default: just remove from session mapping, thread returns to pool
    this.sessions.delete(sessionId);
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
    this.logger?.log('[AcpAgentService] stopAgent called, disposing all threads');

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
  }

  // -----------------------------------------------------------------------
  // dispose — clean up all resources
  // -----------------------------------------------------------------------

  async dispose(): Promise<void> {
    this.logger?.log('[AcpAgentService] dispose called');
    await this.stopAgent();
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

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

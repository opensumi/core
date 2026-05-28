import { Autowired, Injectable } from '@opensumi/di';
import { Deferred, Disposable, Emitter, Event, IDisposable } from '@opensumi/ide-core-common';
import {
  AcpWebMcpCallerServiceToken,
  AvailableCommand,
  ListSessionsRequest,
  ListSessionsResponse,
  McpServer,
  SessionInfo,
  SessionNotification,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';
import { AgentProcessConfig } from '@opensumi/ide-core-common/lib/types/ai-native/agent-types';
import { AppConfig, INodeLogger } from '@opensumi/ide-core-node';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

import { normalizeAcpError } from './acp-error';
import {
  AcpThread,
  AcpThreadEvent,
  AcpThreadFactory,
  AcpThreadFactoryToken,
  AcpThreadRuntimeConfig,
  ThreadStatus,
} from './acp-thread';
import { AcpTerminalHandler, AcpTerminalHandlerToken } from './handlers/terminal.handler';
import { OpenSumiMcpHttpServer } from './opensumi-mcp-http-server';
import { PermissionRoutingService, PermissionRoutingServiceToken } from './permission-routing.service';

import type { AgentUpdate, AgentUpdateType, SimpleToolCall } from './acp-update-types';
import type { AcpWebMcpCallerService } from './acp-webmcp-caller.service';
import type { WebMcpGroupDef, WebMcpToolDef } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';
export { AgentUpdate, AgentUpdateType, SimpleToolCall } from './acp-update-types';

// ============================================================================
// DI Token
// ============================================================================

export const AcpAgentServiceToken = Symbol('AcpAgentServiceToken');

const WEBMCP_CAPABILITY_HINT =
  'OpenSumi WebMCP exposes a narrow default IDE tool set. If you need additional IDE capabilities that are not listed, call opensumi_discoverCapabilities first, then opensumi_enableCapabilityGroup for the relevant group. If the MCP client does not refresh tools/list after enabling, use opensumi_invokeCapabilityTool as the fallback broker.';
const WEBMCP_CAPABILITY_QUESTION_HINT =
  'When the user asks what IDE/OpenSumi/WebMCP capabilities or tools are available, answer from the live OpenSumi WebMCP metadata below. If you need current per-session enabled/disabled state, call opensumi_discoverCapabilities with includeDisabled=true. Do not answer only from memory.';
const WEBMCP_TERMINAL_CAPABILITY_HINT =
  'For requests to create an OpenSumi IDE terminal or type/run a command in an IDE terminal, use OpenSumi WebMCP: call opensumi_enableCapabilityGroup with group "terminal", refresh tools/list if possible, then use terminal_create and terminal_runCommand. If tools/list is not refreshed, call opensumi_invokeCapabilityTool for terminal_create and terminal_runCommand.';

type WebMcpToolWithMeta = WebMcpToolDef & {
  riskLevel?: string;
  exposedByDefault?: boolean;
  profiles?: string[];
};

type WebMcpGroupWithMeta = Omit<WebMcpGroupDef, 'tools'> & {
  profile?: string;
  tools: WebMcpToolWithMeta[];
};

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
// SDK type aliases (SDK is ESM, can't use static imports in this CJS file)
// ============================================================================

/**
 * Minimal shape matching the SDK's SetSessionConfigOptionRequest:
 * ({ type: "boolean"; value: boolean } | { value: string }) & { sessionId, configId, _meta? }
 */
interface SetSessionConfigOptionRequest {
  sessionId: string;
  configId: string;
  value: boolean | string;
  type?: 'boolean';
  _meta?: { [key: string]: unknown } | null;
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
   * Set session configuration options (e.g. permission levels).
   */
  setSessionConfigOption(params: { sessionId: string; configId: string; value: boolean | string }): Promise<void>;

  /** Fork a session (create a copy based on existing session state) */
  forkSession(params: { sessionId: string; cwd?: string; mcpServers?: McpServer[] }): Promise<{ sessionId: string }>;

  /** Resume a closed session */
  resumeSession(params: { sessionId: string; cwd?: string }): Promise<void>;

  /** Close a session without disposing the thread */
  closeSession(params: { sessionId: string }): Promise<void>;

  /** Switch the AI model for the session */
  setSessionModel(params: { sessionId: string; model: string }): Promise<void>;

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

  /**
   * Event fired when any session's thread status changes.
   * Persists across sendMessage() calls — unlike onEvent listeners
   * that only exist during stream lifetime.
   */
  readonly onThreadStatusChange: Event<{ sessionId: string; status: ThreadStatus }>;
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

  @Autowired(PermissionRoutingServiceToken)
  private permissionRouting: PermissionRoutingService;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  @Autowired(OpenSumiMcpHttpServer)
  private readonly opensumiMcpHttpServer: OpenSumiMcpHttpServer | undefined;

  @Autowired(AcpWebMcpCallerServiceToken)
  private readonly webmcpCallerService: AcpWebMcpCallerService | undefined;

  // Session -> Thread mapping (active sessions)
  private sessions = new Map<string, AcpThread>();

  // Thread pool: all thread instances (active + idle/disconnected)
  private threadPool: AcpThread[] = [];

  // Pool limit (configurable)
  private readonly maxPoolSize = 10;

  // Cached session info for backward compat (getSessionInfo without sessionId)
  private lastSessionInfo: AgentSessionInfo | null = null;

  // Persistent thread status change listeners (survives across sendMessage streams)
  private threadStatusDisposables = new Map<string, IDisposable>();

  private _onThreadStatusChange = new Emitter<{ sessionId: string; status: ThreadStatus }>();
  readonly onThreadStatusChange: Event<{ sessionId: string; status: ThreadStatus }> = this._onThreadStatusChange.event;

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
      agentId: config.agentId,
      command: config.command,
      args: config.args,
      env: config.env,
      cwd: config.cwd,
      nodePath: config.nodePath,
    };
    const thread = this.threadFactory(sessionId, runtimeConfig);
    this.logger.log(
      `[AcpAgentService] Created new thread ${thread.threadId} for session ${sessionId}, cwd=${config.cwd}`,
    );
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
        agentId: config.agentId,
        command: config.command,
        args: config.args,
        env: config.env,
        cwd: config.cwd,
        nodePath: config.nodePath,
      };
      const thread = this.threadFactory('', runtimeConfig);
      this.threadPool.push(thread);
      return thread;
    }

    throw new Error(`Thread pool is full (${this.maxPoolSize}), no idle thread available`);
  }

  private async getSessionMcpServers(thread: AcpThread, config: AgentProcessConfig): Promise<McpServer[]> {
    const mcpServers = config.mcpServers ?? [];

    const mcpCapabilities = thread.agentCapabilities?.mcpCapabilities;
    const configuredServers = mcpServers.filter((server) => {
      const type = (server as { type?: string }).type;
      if (type === 'http') {
        const supported = mcpCapabilities?.http === true;
        if (!supported) {
          this.logger.warn(`[AcpAgentService] Skipping HTTP MCP server "${server.name}"; agent does not support it`);
        }
        return supported;
      }
      if (type === 'sse') {
        const supported = mcpCapabilities?.sse === true;
        if (!supported) {
          this.logger.warn(`[AcpAgentService] Skipping SSE MCP server "${server.name}"; agent does not support it`);
        }
        return supported;
      }
      return true;
    });

    if (mcpCapabilities?.http !== true || !this.opensumiMcpHttpServer) {
      return configuredServers;
    }

    const serverName = this.opensumiMcpHttpServer.getServerName();
    if (configuredServers.some((server) => server.name === serverName)) {
      this.logger.warn(`[AcpAgentService] Skipping built-in MCP server "${serverName}"; name already configured`);
      return configuredServers;
    }

    try {
      await this.opensumiMcpHttpServer.start();
      return [
        ...configuredServers,
        {
          name: serverName,
          type: 'http',
          url: this.opensumiMcpHttpServer.getUrl(),
          headers: [],
        },
      ];
    } catch (error) {
      this.logger.warn(`[AcpAgentService] Skipping built-in MCP server "${serverName}"; failed to start`, error);
      return configuredServers;
    }
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
        mcpServers: await this.getSessionMcpServers(thread, config),
      } as any);

      realSessionId = newSessionResponse.sessionId;
      this.sessions.set(realSessionId, thread);
      this.permissionRouting.registerSession(realSessionId);
      this.registerThreadStatusListener(realSessionId, thread);

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
        this.permissionRouting.unregisterSession(realSessionId);
        this.unregisterThreadStatusListener(realSessionId);
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
      this.permissionRouting.registerSession(sessionId);
      this.registerThreadStatusListener(sessionId, existingThread);
      this.logger.log(
        `[AcpAgentService] loadSession() — thread already bound, threadId=${existingThread.threadId}, cwd=${existingThread.cwd}`,
      );
      return this.buildSessionLoadResult(sessionId, existingThread);
    }

    // 2. Pool has idle Thread
    const idleThread = this.threadPool.find(
      (t) => !this.hasActiveSession(t) && ['idle', 'awaiting_prompt'].includes(t.getStatus()),
    );
    if (idleThread) {
      this.logger.log(
        `[AcpAgentService] loadSession() — reusing idle thread ${idleThread.threadId}, cwd=${idleThread.cwd}`,
      );
      this.sessions.set(sessionId, idleThread);
      this.permissionRouting.registerSession(sessionId);
      this.registerThreadStatusListener(sessionId, idleThread);
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
          mcpServers: await this.getSessionMcpServers(idleThread, config),
        } as any);
      } catch (e) {
        this.sessions.delete(sessionId);
        this.permissionRouting.unregisterSession(sessionId);
        this.unregisterThreadStatusListener(sessionId);
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
      this.permissionRouting.registerSession(sessionId);
      this.registerThreadStatusListener(sessionId, thread);

      try {
        if (!thread.initialized) {
          await thread.initialize(config as any);
        }
        await thread.loadSession({
          sessionId,
          cwd: config.cwd,
          mcpServers: await this.getSessionMcpServers(thread, config),
        } as any);
      } catch (e) {
        const idx = this.threadPool.indexOf(thread);
        if (idx !== -1) {
          this.threadPool.splice(idx, 1);
        }
        this.sessions.delete(sessionId);
        this.permissionRouting.unregisterSession(sessionId);
        this.unregisterThreadStatusListener(sessionId);
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

    // Emit the current thread status as the first update so the browser
    // always receives the status even if no status_changed event fires
    // during this prompt (e.g. session was already awaiting_prompt).
    const currentStatus = thread.getStatus();
    if (currentStatus) {
      stream.emitData({ type: 'thread_status', content: '', threadStatus: currentStatus });
    }

    this.logger.log(
      `[AcpAgentService] sendMessage() — sessionId=${request.sessionId}, thread=${thread.threadId}, entries=${
        thread.getEntries().length
      }`,
    );

    // Subscribe thread.onEvent: session_notification -> emitData to stream
    const disposables: IDisposable[] = [];

    const eventDisposable = thread.onEvent((event: AcpThreadEvent) => {
      if (event.type === 'session_notification') {
        const agentUpdates = thread.toAgentUpdate(event.notification);
        const normalizedUpdates = Array.isArray(agentUpdates) ? agentUpdates : [];
        if (agentUpdates && !Array.isArray(agentUpdates)) {
          normalizedUpdates.push(agentUpdates);
        }
        for (const agentUpdate of normalizedUpdates) {
          agentUpdate.threadStatus = thread.getStatus();
          stream.emitData(agentUpdate);
        }
      } else if (event.type === 'status_changed') {
        // Emit standalone threadStatus update for status transitions that don't
        // coincide with a session_notification (e.g. disconnected, errored, idle).
        stream.emitData({ type: 'thread_status', content: '', threadStatus: event.status });
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
      const promptForAgent = await this.withWebMcpCapabilityHint(request.prompt, thread.getEntries().length <= 1);
      const promptBlocks = this.buildPromptBlocks(promptForAgent, request.images);
      this.logger.log(
        `[AcpAgentService] sendPrompt() — sessionId=${request.sessionId}, promptChars=${
          request.prompt.length
        }, promptBytes=${Buffer.byteLength(request.prompt, 'utf8')}, sentPromptChars=${
          promptForAgent.length
        }, sentPromptBytes=${Buffer.byteLength(promptForAgent, 'utf8')}, images=${
          request.images?.length ?? 0
        }, blocks=${promptBlocks.length}, entries=${thread.getEntries().length}`,
      );
      await thread.prompt({
        sessionId: request.sessionId,
        prompt: promptBlocks,
      } as any);

      thread.markAssistantComplete();
      stream.emitData({ type: 'done', content: '' });
      stream.end();
    } catch (error) {
      stream.emitError(normalizeAcpError(error));
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
    const sessionsMap = new Map<string, SessionInfo>();
    let lastNextCursor: string | undefined;
    let activeThreadCount = 0;

    for (const [sessionId, thread] of this.sessions) {
      if (thread.getStatus() !== 'disconnected') {
        activeThreadCount++;
        try {
          const result = await thread.listSessions(params);
          if (result?.sessions) {
            for (const info of result.sessions) {
              sessionsMap.set(info.sessionId, info);
            }
          }
          // nextCursor/_meta are thread-specific; only meaningful for single-thread results
          if (result?.nextCursor) {
            lastNextCursor = result.nextCursor;
          }
        } catch (error) {
          this.logger?.warn(`[AcpAgentService] listSessions error for thread ${sessionId}, cwd=${thread.cwd}:`, error);
        }
      }
    }

    // Single active thread: preserve its cursor for pagination
    // Multiple threads: cursors can't be meaningfully merged, so clear
    return {
      sessions: Array.from(sessionsMap.values()),
      nextCursor: activeThreadCount === 1 ? lastNextCursor : undefined,
    };
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
    this.permissionRouting.registerSession(sessionId);
    this.registerThreadStatusListener(sessionId, thread);
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
        mcpServers: await this.getSessionMcpServers(thread, config),
      } as any);
      return this.buildSessionLoadResult(sessionId, thread);
    } catch (e) {
      this.sessions.delete(sessionId);
      this.permissionRouting.unregisterSession(sessionId);
      this.unregisterThreadStatusListener(sessionId);
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
  // setSessionConfigOption
  // -----------------------------------------------------------------------

  async setSessionConfigOption(params: {
    sessionId: string;
    configId: string;
    value: boolean | string;
  }): Promise<void> {
    const thread = this.sessions.get(params.sessionId);
    if (!thread) {
      throw new Error(`No active session for sessionId: ${params.sessionId}`);
    }
    try {
      // SDK uses a discriminated union: { type: "boolean"; value: boolean } | { value: string }
      // We infer the correct variant from the value's runtime type.
      const request: SetSessionConfigOptionRequest = {
        sessionId: params.sessionId,
        configId: params.configId,
        value: params.value,
      };
      if (typeof params.value === 'boolean') {
        request.type = 'boolean';
      }

      await thread.setSessionConfigOption(request as any);
    } catch (error) {
      this.logger?.warn(`[AcpAgentService] setSessionConfigOption error for session ${params.sessionId}:`, error);
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // forkSession
  // -----------------------------------------------------------------------

  async forkSession(params: {
    sessionId: string;
    cwd?: string;
    mcpServers?: McpServer[];
  }): Promise<{ sessionId: string }> {
    const thread = this.sessions.get(params.sessionId);
    if (!thread) {
      throw new Error(`No active session for sessionId: ${params.sessionId}`);
    }
    try {
      const response = await thread.unstable_forkSession({
        sessionId: params.sessionId,
        cwd: params.cwd,
        mcpServers: params.mcpServers,
      } as any);
      return { sessionId: response.sessionId };
    } catch (error) {
      this.logger?.warn(`[AcpAgentService] forkSession error for session ${params.sessionId}:`, error);
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // resumeSession
  // -----------------------------------------------------------------------

  async resumeSession(params: { sessionId: string; cwd?: string }): Promise<void> {
    const thread = this.sessions.get(params.sessionId);
    if (!thread) {
      throw new Error(`No active session for sessionId: ${params.sessionId}`);
    }
    try {
      await thread.unstable_resumeSession({ sessionId: params.sessionId, cwd: params.cwd ?? thread.cwd });
    } catch (error) {
      this.logger?.warn(`[AcpAgentService] resumeSession error for session ${params.sessionId}:`, error);
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // closeSession
  // -----------------------------------------------------------------------

  async closeSession(params: { sessionId: string }): Promise<void> {
    const thread = this.sessions.get(params.sessionId);
    if (!thread) {
      throw new Error(`No active session for sessionId: ${params.sessionId}`);
    }
    try {
      await thread.unstable_closeSession({ sessionId: params.sessionId } as any);
    } catch (error) {
      this.logger?.warn(`[AcpAgentService] closeSession error for session ${params.sessionId}:`, error);
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // setSessionModel
  // -----------------------------------------------------------------------

  async setSessionModel(params: { sessionId: string; model: string }): Promise<void> {
    const thread = this.sessions.get(params.sessionId);
    if (!thread) {
      throw new Error(`No active session for sessionId: ${params.sessionId}`);
    }
    try {
      await thread.unstable_setSessionModel({ sessionId: params.sessionId, model: params.model } as any);
    } catch (error) {
      this.logger?.warn(`[AcpAgentService] setSessionModel error for session ${params.sessionId}:`, error);
      throw error;
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
      this.logger.log(
        `[AcpAgentService] disposeSession() — force disposing thread ${thread.threadId}, cwd=${thread.cwd}`,
      );
      await thread.dispose();
      const idx = this.threadPool.indexOf(thread);
      if (idx !== -1) {
        this.threadPool.splice(idx, 1);
      }
    }

    // Default: just remove from session mapping, thread returns to pool
    this.permissionRouting.unregisterSession(sessionId);
    this.unregisterThreadStatusListener(sessionId);
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
        this.logger?.warn(`[AcpAgentService] Error disposing thread ${thread.threadId}, cwd=${thread.cwd}:`, error);
      }
    }

    for (const sessionId of this.sessions.keys()) {
      this.permissionRouting.unregisterSession(sessionId);
      this.unregisterThreadStatusListener(sessionId);
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
    this._onThreadStatusChange.dispose();
    this.logger?.log('[AcpAgentService] dispose() — done');
  }

  // -----------------------------------------------------------------------
  // Thread status change tracking
  // -----------------------------------------------------------------------

  /**
   * Register a persistent listener for thread status changes.
   * Fires onThreadStatusChange for every status transition, even outside sendMessage streams.
   */
  private registerThreadStatusListener(sessionId: string, thread: AcpThread): void {
    this.unregisterThreadStatusListener(sessionId);
    this.logger.log(`[AcpAgentService] registerThreadStatusListener: sessionId=${sessionId}`);
    const disposable = thread.onEvent((event: AcpThreadEvent) => {
      if (event.type === 'status_changed') {
        this.logger.log(`[AcpAgentService] thread status_changed: sessionId=${sessionId}, status=${event.status}`);
        this._onThreadStatusChange.fire({ sessionId, status: event.status });
      }
    });
    this.threadStatusDisposables.set(sessionId, disposable);
  }

  private unregisterThreadStatusListener(sessionId: string): void {
    const disposable = this.threadStatusDisposables.get(sessionId);
    if (disposable) {
      this.logger.log(`[AcpAgentService] unregisterThreadStatusListener: sessionId=${sessionId}`);
      disposable.dispose();
      this.threadStatusDisposables.delete(sessionId);
    }
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

  private async withWebMcpCapabilityHint(input: string, includeHint: boolean): Promise<string> {
    const hints: string[] = [];
    if (includeHint) {
      hints.push(WEBMCP_CAPABILITY_HINT);
    }
    if (this.needsWebMcpCapabilityQuestionHint(input)) {
      hints.push(WEBMCP_CAPABILITY_QUESTION_HINT);
      const liveSummary = await this.getWebMcpCapabilitySummary();
      if (liveSummary) {
        hints.push(liveSummary);
      }
    }
    if (this.needsWebMcpTerminalHint(input)) {
      hints.push(WEBMCP_TERMINAL_CAPABILITY_HINT);
    }
    if (hints.length === 0) {
      return input;
    }
    return `${hints.join('\n')}\n\n${input}`;
  }

  private needsWebMcpTerminalHint(input: string): boolean {
    const normalized = input.toLowerCase();
    const hasTerminalIntent = /终端|terminal/.test(normalized);
    const hasInteractionIntent = /新建|创建|create|打开|open|输入|运行|执行|run|type|command|命令/.test(normalized);
    return hasTerminalIntent && hasInteractionIntent;
  }

  private needsWebMcpCapabilityQuestionHint(input: string): boolean {
    const normalized = input.toLowerCase();
    const hasIdeSubject = /ide|opensumi|webmcp|mcp|工具|tool|能力|capabilit/.test(normalized);
    const asksCapabilities =
      /提供.*能力|有什么能力|哪些能力|能力.*有哪些|有哪些.*能力|提供.*工具|有什么工具|哪些工具|工具.*有哪些|available.*tools|available.*capabilit/.test(
        normalized,
      );
    return hasIdeSubject && asksCapabilities;
  }

  private async getWebMcpCapabilitySummary(): Promise<string | undefined> {
    if (!this.webmcpCallerService) {
      return undefined;
    }
    try {
      const groups = (await this.webmcpCallerService.getGroupDefinitions({
        includeAllTools: true,
      })) as WebMcpGroupWithMeta[];
      const profile = groups.find((group) => group.profile)?.profile ?? 'unknown';
      const lines = groups.map((group) => {
        const tools = group.tools
          .filter((tool) => tool.exposedByDefault !== false)
          .map((tool) => this.toMcpToolName(group.name, tool.method))
          .slice(0, 12);
        const suffix =
          group.tools.length > tools.length ? `, +${group.tools.length - tools.length} hidden/protected` : '';
        return `- ${group.name}: defaultLoaded=${group.defaultLoaded}, profile=${
          group.profile ?? profile
        }, tools=${tools.join(', ')}${suffix}`;
      });
      return [
        'Live OpenSumi WebMCP registered capability metadata:',
        `profile=${profile}, groupCount=${groups.length}`,
        ...lines,
        'This metadata is the registered capability catalog, not the current per-session enabledGroups state.',
      ].join('\n');
    } catch (error) {
      this.logger.warn('[AcpAgentService] Failed to build WebMCP capability summary', error);
      return undefined;
    }
  }

  private toMcpToolName(groupName: string, method: string): string {
    const action = method.split('/').pop() ?? method;
    return `${groupName}_${action}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
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

import { Autowired, Injectable } from '@opensumi/di';
import { Deferred, Disposable, Emitter, Event, IDisposable } from '@opensumi/ide-core-common';
import { DEFAULT_ACP_THREAD_POOL_SIZE } from '@opensumi/ide-core-common/lib/settings/ai-native';
import {
  AcpDebugLogEntry,
  AvailableCommand,
  ListSessionsRequest,
  ListSessionsResponse,
  McpServer,
  OpenSumiMcpServerConnectionInfo,
  SessionInfo,
  SessionNotification,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';
import { AgentProcessConfig } from '@opensumi/ide-core-common/lib/types/ai-native/agent-types';
import { AppConfig, INodeLogger } from '@opensumi/ide-core-node';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

import { toAgentUpdate } from './acp-agent-update-adapter';
import { acpDebugLogStore } from './acp-debug-log';
import { getAcpErrorMessage, normalizeAcpError } from './acp-error';
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
export { AgentUpdate, AgentUpdateType, SimpleToolCall } from './acp-update-types';

// ============================================================================
// DI Token
// ============================================================================

export const AcpAgentServiceToken = Symbol('AcpAgentServiceToken');

const WEBMCP_CAPABILITY_HINT = [
  '<opensumi_mcp_usage_hint priority="low">',
  'Use the opensumi-ide MCP catalog tools to discover and enable IDE capability groups before invoking non-default OpenSumi tools.',
  '</opensumi_mcp_usage_hint>',
].join('\n');

const ACP_THREAD_POOL_SATURATED_ERROR_NAME = 'AcpThreadPoolSaturatedError';

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
  modes: Array<{ id: string; name: string; description?: string }>;
  currentModeId?: string;
  models?: Array<{ modelId: string; name: string; description?: string | null }>;
  currentModelId?: string;
  configOptions?: Record<string, any>[];
  status: AgentSessionStatus;
  threadStatus?: ThreadStatus;
  historyUpdates: SessionNotification[];
}

export interface AgentSessionSnapshot extends SessionLoadResult {
  threadStatus: ThreadStatus;
}

export type AgentSessionAttachmentUpdate =
  | { type: 'snapshot'; snapshot: AgentSessionSnapshot }
  | { type: 'update'; update: AgentUpdate };

interface PendingSessionLoad {
  promise: Promise<SessionLoadResult>;
  refCount: number;
  thread: AcpThread;
  closeRequested: boolean;
}

type AgentThreadRuntimeConfigKey = Pick<
  AgentProcessConfig,
  'agentId' | 'command' | 'args' | 'cwd' | 'env' | 'nodePath'
>;

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
   * Observe an active Agent Session without sending another prompt.
   */
  attachSession(sessionId: string): SumiReadableStream<AgentSessionAttachmentUpdate>;

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
  createSession(config: AgentProcessConfig): Promise<{
    sessionId: string;
    availableCommands: AvailableCommand[];
    modes?: Array<{ id: string; name: string; description?: string }>;
    currentModeId?: string;
    models?: Array<{ modelId: string; name: string; description?: string | null }>;
    currentModelId?: string;
    configOptions?: Record<string, any>[];
  }>;

  /**
   * Start and initialize the idle thread pool for one runtime configuration.
   * Does not create an ACP session.
   */
  warmUpAgentPool(config: AgentProcessConfig): Promise<void>;

  /**
   * List all ACP Agent sessions
   */
  listSessions(params?: ListSessionsRequest, config?: AgentProcessConfig): Promise<ListSessionsResponse>;

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

  getAcpDebugLog(): Promise<AcpDebugLogEntry[]>;

  clearAcpDebugLog(): Promise<void>;

  /**
   * Start and return the loopback HTTP MCP server connection for external MCP clients.
   */
  getOpenSumiMcpServerConnection(clientId?: string): Promise<OpenSumiMcpServerConnectionInfo>;

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

  // Session -> Thread mapping (active sessions)
  private sessions = new Map<string, AcpThread>();

  // Session -> in-flight load task. Prevents concurrent loadSession calls
  // from observing a pre-registered but not-yet-loaded thread.
  private pendingSessionLoads = new Map<string, PendingSessionLoad>();

  // Session -> number of UI/callers currently holding this loaded session.
  private sessionRefCounts = new Map<string, number>();

  // Sessions that actually received the built-in opensumi-ide MCP server.
  private builtInMcpSessionIds = new Set<string>();

  // Thread pool: all thread instances (active + idle/disconnected)
  private threadPool: AcpThread[] = [];

  // Thread -> agent process config key. Idle threads can only be reused when
  // they were created for the same agent process command and environment.
  private threadRuntimeConfigKeys = new WeakMap<AcpThread, string>();

  // Threads reserved by createSession() before the real ACP sessionId is known.
  private reservedThreads = new Set<AcpThread>();

  // Threads that have been added to the pool but are still completing ACP
  // initialize(). They cannot be used until a caller explicitly claims them.
  private warmingThreads = new Map<AcpThread, Promise<void>>();

  // One background warmup task per agent runtime configuration.
  private poolWarmups = new Map<string, Promise<void>>();

  // Pool limit (configurable)
  private maxPoolSize = DEFAULT_ACP_THREAD_POOL_SIZE;

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
    this.syncMaxPoolSize(config);

    // 1. Active session mapping exists
    const existing = this.sessions.get(sessionId);
    if (existing && existing.getStatus() !== 'disconnected') {
      this.touchSession(sessionId);
      return existing;
    }

    // 2. Pool has idle thread (idle or awaiting_prompt, not bound to active session)
    const idleThread = this.findReusableIdleThread(config);
    if (idleThread) {
      this.bindSession(sessionId, idleThread);
      return idleThread;
    }

    const warmingThread = await this.reserveWarmingThread(config);
    if (warmingThread) {
      this.bindSession(sessionId, warmingThread);
      return warmingThread;
    }

    // 3. Pool not full, create new
    if (this.threadPool.length < this.maxPoolSize) {
      const thread = this.createThreadInstance(sessionId, config);
      this.threadPool.push(thread);
      this.bindSession(sessionId, thread);
      return thread;
    }

    // 4. Pool full, no idle — replace the least recently used reusable thread.
    const recycledThread = await this.recycleLeastRecentlyUsedThread(sessionId, 'load-or-new', config);
    this.bindSession(sessionId, recycledThread);
    return recycledThread;
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

  private bindSession(sessionId: string, thread: AcpThread): void {
    this.sessions.delete(sessionId);
    this.sessions.set(sessionId, thread);
  }

  private touchSession(sessionId: string): void {
    const thread = this.sessions.get(sessionId);
    if (!thread) {
      return;
    }
    this.bindSession(sessionId, thread);
  }

  private syncMaxPoolSize(config: AgentProcessConfig): void {
    const { threadPoolSize } = config;
    if (typeof threadPoolSize !== 'number' || !Number.isFinite(threadPoolSize) || threadPoolSize < 1) {
      this.maxPoolSize = DEFAULT_ACP_THREAD_POOL_SIZE;
      return;
    }
    this.maxPoolSize = Math.floor(threadPoolSize);
  }

  private isThreadProcessReusable(thread: AcpThread): boolean {
    return ['idle', 'awaiting_prompt'].includes(thread.getStatus());
  }

  private isThreadCapacityReclaimable(thread: AcpThread, sessionId = this.getBoundSessionId(thread)): boolean {
    if (
      this.reservedThreads.has(thread) ||
      this.warmingThreads.has(thread) ||
      (sessionId ? this.pendingSessionLoads.has(sessionId) : false)
    ) {
      return false;
    }
    return ['idle', 'awaiting_prompt', 'disconnected'].includes(thread.getStatus());
  }

  private createThreadPoolSaturatedError(): Error {
    const error = new Error(`Thread pool is full (${this.maxPoolSize}), no reusable LRU thread available`);
    error.name = ACP_THREAD_POOL_SATURATED_ERROR_NAME;
    return error;
  }

  private createThreadRuntimeConfigKey(config: AgentThreadRuntimeConfigKey): string {
    const env = Array.isArray(config.env)
      ? config.env
          .map((item) => ({
            name: String((item as { name?: unknown }).name ?? ''),
            value: String((item as { value?: unknown }).value ?? ''),
          }))
          .sort((a, b) => a.name.localeCompare(b.name) || a.value.localeCompare(b.value))
      : [];

    return JSON.stringify({
      agentId: config.agentId,
      command: config.command,
      args: config.args ?? [],
      cwd: config.cwd,
      env,
      nodePath: config.nodePath ?? '',
    });
  }

  private rememberThreadRuntimeConfig(thread: AcpThread, config: AgentThreadRuntimeConfigKey): void {
    this.threadRuntimeConfigKeys.set(thread, this.createThreadRuntimeConfigKey(config));
  }

  private canReuseThreadForConfig(thread: AcpThread, config: AgentProcessConfig): boolean {
    return this.threadRuntimeConfigKeys.get(thread) === this.createThreadRuntimeConfigKey(config);
  }

  private findReusableIdleThread(config: AgentProcessConfig): AcpThread | undefined {
    return this.threadPool.find(
      (thread) =>
        !this.reservedThreads.has(thread) &&
        !this.warmingThreads.has(thread) &&
        !this.hasActiveSession(thread) &&
        this.canReuseThreadForConfig(thread, config) &&
        this.isThreadProcessReusable(thread),
    );
  }

  /**
   * Claim an in-flight prewarmed thread so the caller can wait for the same
   * initialization instead of starting a duplicate CLI process.
   */
  private async reserveWarmingThread(config: AgentProcessConfig): Promise<AcpThread | undefined> {
    const thread = this.threadPool.find(
      (candidate) =>
        !this.reservedThreads.has(candidate) &&
        !this.hasActiveSession(candidate) &&
        this.canReuseThreadForConfig(candidate, config) &&
        this.warmingThreads.has(candidate),
    );
    if (!thread) {
      return undefined;
    }

    const warmup = this.warmingThreads.get(thread);
    if (!warmup) {
      return undefined;
    }

    this.reservedThreads.add(thread);
    await warmup;
    if (this.threadPool.includes(thread)) {
      return thread;
    }

    this.reservedThreads.delete(thread);
    return undefined;
  }

  private getBoundSessionId(thread: AcpThread): string | undefined {
    for (const [sessionId, mappedThread] of this.sessions) {
      if (mappedThread === thread) {
        return sessionId;
      }
    }
    return undefined;
  }

  private async releaseSessionMapping(sessionId: string): Promise<void> {
    await this.terminalHandler.releaseSessionTerminals(sessionId);
    this.permissionRouting.unregisterSession(sessionId);
    this.unregisterThreadStatusListener(sessionId);
    this.sessions.delete(sessionId);
    this.sessionRefCounts.delete(sessionId);
    this.builtInMcpSessionIds.delete(sessionId);
  }

  private removeThreadFromPool(thread: AcpThread): void {
    const index = this.threadPool.indexOf(thread);
    if (index !== -1) {
      this.threadPool.splice(index, 1);
    }
  }

  private async replaceThreadForConfig(
    thread: AcpThread,
    sessionId: string | undefined,
    nextSessionId: string,
    reason: string,
    config: AgentProcessConfig,
  ): Promise<AcpThread> {
    this.reservedThreads.add(thread);
    this.logger.log(
      '[AcpAgentService] thread-pool-dispose — reason=' +
        reason +
        ', evictSessionId=' +
        (sessionId ?? '-') +
        ', nextSessionId=' +
        nextSessionId +
        ', threadId=' +
        thread.threadId +
        ', status=' +
        thread.getStatus() +
        ', pool=' +
        this.threadPool.length +
        '/' +
        this.maxPoolSize,
    );
    try {
      if (sessionId) {
        await this.releaseSessionMapping(sessionId);
      }
      await thread.dispose();
      this.removeThreadFromPool(thread);
      const replacement = this.createThreadInstance(
        nextSessionId === 'pending-create-session' ? '' : nextSessionId,
        config,
      );
      this.threadPool.push(replacement);
      this.reservedThreads.add(replacement);
      return replacement;
    } finally {
      this.reservedThreads.delete(thread);
    }
  }

  private async replaceIncompatibleWarmingThread(
    thread: AcpThread,
    nextSessionId: string,
    reason: string,
    config: AgentProcessConfig,
  ): Promise<AcpThread> {
    const warmup = this.warmingThreads.get(thread);
    if (!warmup) {
      throw this.createThreadPoolSaturatedError();
    }

    this.reservedThreads.add(thread);
    try {
      await warmup;
      if (this.threadPool.includes(thread)) {
        await thread.dispose();
        this.removeThreadFromPool(thread);
      }
      if (this.threadPool.length >= this.maxPoolSize) {
        this.throwThreadPoolSaturated(nextSessionId, reason, config);
      }
      const replacement = this.createThreadInstance(
        nextSessionId === 'pending-create-session' ? '' : nextSessionId,
        config,
      );
      this.threadPool.push(replacement);
      this.reservedThreads.add(replacement);
      return replacement;
    } finally {
      this.reservedThreads.delete(thread);
    }
  }

  private getThreadAllocationDiagnostics(thread: AcpThread, config: AgentProcessConfig) {
    const sessionId = this.getBoundSessionId(thread);
    const status = thread.getStatus();
    const reserved = this.reservedThreads.has(thread);
    const warming = this.warmingThreads.has(thread);
    const pendingLoad = sessionId ? this.pendingSessionLoads.has(sessionId) : false;
    const runtimeCompatible = this.canReuseThreadForConfig(thread, config);
    const processReusable = this.isThreadProcessReusable(thread);
    const capacityReclaimable = this.isThreadCapacityReclaimable(thread, sessionId);
    const exclusionReasons: string[] = [];
    if (reserved) {
      exclusionReasons.push('reserved');
    }
    if (warming) {
      exclusionReasons.push('warming');
    }
    if (pendingLoad) {
      exclusionReasons.push('pending-load');
    }
    if (!runtimeCompatible) {
      exclusionReasons.push('runtime-incompatible');
    }
    if (!processReusable) {
      exclusionReasons.push('process-not-reusable:' + status);
    }
    if (!capacityReclaimable) {
      exclusionReasons.push('capacity-not-reclaimable:' + status);
    }
    return {
      threadId: thread.threadId,
      sessionId: sessionId ?? '-',
      status,
      reserved,
      warming,
      pendingLoad,
      runtimeCompatible,
      processReusable,
      capacityReclaimable,
      exclusionReasons,
    };
  }

  private throwThreadPoolSaturated(nextSessionId: string, reason: string, config: AgentProcessConfig): never {
    const candidates = this.threadPool.map((thread) => this.getThreadAllocationDiagnostics(thread, config));
    this.logger.warn(
      '[AcpAgentService] thread-pool-saturated — reason=' +
        reason +
        ', nextSessionId=' +
        nextSessionId +
        ', pool=' +
        this.threadPool.length +
        '/' +
        this.maxPoolSize +
        ', candidates=' +
        JSON.stringify(candidates),
    );
    throw this.createThreadPoolSaturatedError();
  }

  private async recycleLeastRecentlyUsedThread(
    nextSessionId: string,
    reason: string,
    config: AgentProcessConfig,
  ): Promise<AcpThread> {
    for (const thread of this.threadPool) {
      const sessionId = this.getBoundSessionId(thread);
      const status = thread.getStatus();
      if (
        sessionId ||
        !this.isThreadCapacityReclaimable(thread, sessionId) ||
        (status !== 'disconnected' &&
          (this.canReuseThreadForConfig(thread, config) || !this.isThreadProcessReusable(thread)))
      ) {
        continue;
      }
      return this.replaceThreadForConfig(thread, undefined, nextSessionId, reason + '-unbound', config);
    }

    for (const [sessionId, thread] of this.sessions) {
      if (thread.getStatus() !== 'disconnected' || !this.isThreadCapacityReclaimable(thread, sessionId)) {
        continue;
      }
      return this.replaceThreadForConfig(thread, sessionId, nextSessionId, reason + '-disconnected', config);
    }

    for (const [sessionId, thread] of this.sessions) {
      if (
        this.reservedThreads.has(thread) ||
        this.warmingThreads.has(thread) ||
        this.pendingSessionLoads.has(sessionId) ||
        thread.getStatus() !== 'awaiting_prompt' ||
        !this.canReuseThreadForConfig(thread, config)
      ) {
        continue;
      }

      this.reservedThreads.add(thread);
      this.logger.log(
        `[AcpAgentService] thread-pool-switch — reason=${reason}, evictSessionId=${sessionId}, nextSessionId=${nextSessionId}, threadId=${
          thread.threadId
        }, status=${thread.getStatus()}, pool=${this.threadPool.length}/${this.maxPoolSize}`,
      );
      try {
        await this.releaseSessionMapping(sessionId);
        return thread;
      } catch (error) {
        this.reservedThreads.delete(thread);
        throw error;
      }
    }

    for (const [sessionId, thread] of this.sessions) {
      if (
        thread.getStatus() !== 'awaiting_prompt' ||
        !this.isThreadCapacityReclaimable(thread, sessionId) ||
        this.canReuseThreadForConfig(thread, config)
      ) {
        continue;
      }
      return this.replaceThreadForConfig(thread, sessionId, nextSessionId, reason + '-different-config', config);
    }

    const incompatibleWarmingThread = this.threadPool.find(
      (thread) =>
        !this.reservedThreads.has(thread) &&
        !this.hasActiveSession(thread) &&
        this.warmingThreads.has(thread) &&
        !this.canReuseThreadForConfig(thread, config),
    );
    if (incompatibleWarmingThread) {
      return this.replaceIncompatibleWarmingThread(incompatibleWarmingThread, nextSessionId, reason, config);
    }

    return this.throwThreadPoolSaturated(nextSessionId, reason, config);
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
    this.rememberThreadRuntimeConfig(thread, runtimeConfig);
    this.logger.log(
      `[AcpAgentService] Created new thread ${thread.threadId} for session ${sessionId}, cwd=${config.cwd}`,
    );
    return thread;
  }

  /**
   * Find an idle thread or create a new one, without binding to a sessionId.
   */
  private async findOrCreateIdleThread(config: AgentProcessConfig): Promise<AcpThread> {
    this.syncMaxPoolSize(config);

    const idleThread = this.findReusableIdleThread(config);
    if (idleThread) {
      this.reservedThreads.add(idleThread);
      return idleThread;
    }

    const warmingThread = await this.reserveWarmingThread(config);
    if (warmingThread) {
      return warmingThread;
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
      this.rememberThreadRuntimeConfig(thread, runtimeConfig);
      this.threadPool.push(thread);
      this.reservedThreads.add(thread);
      return thread;
    }

    const recycledThread = await this.recycleLeastRecentlyUsedThread(
      'pending-create-session',
      'create-session',
      config,
    );
    this.reservedThreads.add(recycledThread);
    return recycledThread;
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

    if (config.webMcp?.enabled === false) {
      this.logger.log('[AcpAgentService] Skipping built-in MCP server; WebMCP is disabled by configuration');
      return configuredServers;
    }

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

  /**
   * Initialize at most one process for one agent runtime configuration.
   * Callers with the same configuration can claim an in-flight warmup instead
   * of spawning another process.
   */
  async warmUpAgentPool(config: AgentProcessConfig): Promise<void> {
    this.syncMaxPoolSize(config);

    const runtimeConfigKey = this.createThreadRuntimeConfigKey(config);
    const existingWarmup = this.poolWarmups.get(runtimeConfigKey);
    if (existingWarmup) {
      return existingWarmup;
    }

    const warmup = this.doWarmUpAgentPool(config);
    this.poolWarmups.set(runtimeConfigKey, warmup);
    try {
      await warmup;
    } finally {
      if (this.poolWarmups.get(runtimeConfigKey) === warmup) {
        this.poolWarmups.delete(runtimeConfigKey);
      }
    }
  }

  private async doWarmUpAgentPool(config: AgentProcessConfig): Promise<void> {
    const hasMatchingThread = this.threadPool.some(
      (thread) => this.canReuseThreadForConfig(thread, config) && thread.getStatus() !== 'disconnected',
    );
    const capacity = Math.max(0, this.maxPoolSize - this.threadPool.length);
    const targetCount = hasMatchingThread || capacity === 0 ? 0 : 1;

    if (targetCount === 0) {
      return;
    }

    this.logger.log(
      `[AcpAgentService] warmUpAgentPool() — starting ${targetCount} threads for command=${config.command}, cwd=${config.cwd}`,
    );

    const warmups: Promise<void>[] = [];
    for (let index = 0; index < targetCount; index += 1) {
      const thread = this.createThreadInstance('', config);
      this.threadPool.push(thread);

      warmups.push(this.initializeWarmingThread(thread, config));
    }

    await Promise.all(warmups);
    this.logger.log(
      `[AcpAgentService] warmUpAgentPool() — completed, pool=${this.threadPool.length}/${this.maxPoolSize}`,
    );
    this.logPoolStatus('after-warmUpAgentPool');
  }

  private initializeWarmingThread(thread: AcpThread, config: AgentProcessConfig): Promise<void> {
    // Defer initialize to a microtask so the thread is visible as warming
    // before an implementation can synchronously throw.
    const warmup = Promise.resolve()
      .then(async () => {
        await thread.initialize(config as any);
      })
      .catch(async (error) => {
        this.logger.warn(
          `[AcpAgentService] warmUpAgentPool() — failed to initialize thread ${thread.threadId}: ${getAcpErrorMessage(
            error,
          )}`,
        );
        const index = this.threadPool.indexOf(thread);
        if (index !== -1) {
          this.threadPool.splice(index, 1);
        }
        try {
          await thread.dispose();
        } catch (disposeError) {
          this.logger.warn(
            `[AcpAgentService] warmUpAgentPool() — failed to dispose thread ${thread.threadId}: ${getAcpErrorMessage(
              disposeError,
            )}`,
          );
        }
      })
      .finally(() => {
        this.warmingThreads.delete(thread);
      });
    this.warmingThreads.set(thread, warmup);
    return warmup;
  }

  private didAppendBuiltInMcpServer(config: AgentProcessConfig, mcpServers: McpServer[]): boolean {
    const serverName = this.opensumiMcpHttpServer?.getServerName();
    if (!serverName || (config.mcpServers ?? []).some((server) => server.name === serverName)) {
      return false;
    }
    return mcpServers.some((server) => server.name === serverName);
  }

  private setBuiltInMcpSessionState(sessionId: string, enabled: boolean): void {
    if (enabled) {
      this.builtInMcpSessionIds.add(sessionId);
    } else {
      this.builtInMcpSessionIds.delete(sessionId);
    }
  }

  async getOpenSumiMcpServerConnection(clientId?: string): Promise<OpenSumiMcpServerConnectionInfo> {
    if (!this.opensumiMcpHttpServer) {
      throw new Error('[AcpAgentService] OpenSumi MCP server is not available');
    }
    await this.opensumiMcpHttpServer.start();
    return this.opensumiMcpHttpServer.getConnectionInfo(clientId);
  }

  // -----------------------------------------------------------------------
  // createSession — with Deferred pattern (NOT setTimeout)
  // -----------------------------------------------------------------------

  async createSession(config: AgentProcessConfig): Promise<{
    sessionId: string;
    availableCommands: AvailableCommand[];
    modes?: Array<{ id: string; name: string; description?: string }>;
    currentModeId?: string;
    models?: Array<{ modelId: string; name: string; description?: string | null }>;
    currentModelId?: string;
    configOptions?: Record<string, any>[];
  }> {
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

      const mcpServers = await this.getSessionMcpServers(thread, config);
      const newSessionResponse = await thread.newSession({
        cwd: config.cwd,
        mcpServers,
      } as any);

      realSessionId = newSessionResponse.sessionId;
      this.setBuiltInMcpSessionState(realSessionId, this.didAppendBuiltInMcpServer(config, mcpServers));
      await this.applyDefaultSessionOptions(realSessionId, thread, config);
      this.bindSession(realSessionId, thread);
      this.sessionRefCounts.set(realSessionId, 1);
      this.permissionRouting.registerSession(realSessionId);
      this.registerThreadStatusListener(realSessionId, thread);

      await Promise.race([deferred.promise, new Promise<void>((resolve) => setTimeout(resolve, 5000))]);

      const seen = new Set<string>();
      const deduplicated = availableCommands.filter((cmd) => {
        if (seen.has(cmd.name)) {
          return false;
        }
        seen.add(cmd.name);
        return true;
      });

      const sessionState = thread.getSessionState();
      const modes = sessionState.modes
        ? sessionState.modes.map(({ id, name, description }) => ({ id, name, description: description ?? undefined }))
        : [];
      this.updateLastSessionInfo(realSessionId, thread, modes);

      this.logger.log(
        `[AcpAgentService] createSession() — done, sessionId=${realSessionId}, commands=${deduplicated.length}`,
      );
      this.logPoolStatus('after-createSession');

      return {
        sessionId: realSessionId,
        availableCommands: deduplicated,
        modes,
        currentModeId: sessionState.currentModeId,
        models: sessionState.models ? [...sessionState.models] : undefined,
        currentModelId: sessionState.currentModelId,
        configOptions: sessionState.configOptions
          ? ([...sessionState.configOptions] as Record<string, any>[])
          : undefined,
      };
    } catch (e) {
      if (realSessionId) {
        this.sessions.delete(realSessionId);
        this.sessionRefCounts.delete(realSessionId);
        this.builtInMcpSessionIds.delete(realSessionId);
        this.permissionRouting.unregisterSession(realSessionId);
        this.unregisterThreadStatusListener(realSessionId);
      }
      this.logger.error(`[AcpAgentService] createSession() — failed: ${getAcpErrorMessage(e)}`);
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
      this.reservedThreads.delete(thread);
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
    this.syncMaxPoolSize(config);
    this.logger.log(`[AcpAgentService] loadSession() — sessionId=${sessionId}`);

    // 1. If a load for this session is already in flight, join it. The
    // sessions map may already contain a pre-registered thread at this point,
    // but that thread is not safe to expose until the load RPC completes.
    const pendingLoad = this.pendingSessionLoads.get(sessionId);
    if (pendingLoad) {
      pendingLoad.refCount += 1;
      this.logger.log(
        `[AcpAgentService] loadSession() — joining pending load, sessionId=${sessionId}, refs=${pendingLoad.refCount}`,
      );
      return pendingLoad.promise;
    }

    // 2. sessions.get(sessionId) exists and no pending load -> already loaded
    const existingThread = this.sessions.get(sessionId);
    if (existingThread && existingThread.getStatus() !== 'disconnected') {
      this.touchSession(sessionId);
      this.retainSession(sessionId);
      this.permissionRouting.registerSession(sessionId);
      this.registerThreadStatusListener(sessionId, existingThread);
      this.logger.log(
        `[AcpAgentService] loadSession() — thread already bound, threadId=${existingThread.threadId}, cwd=${existingThread.cwd}`,
      );
      return this.buildSessionLoadResult(sessionId, existingThread);
    }

    // 3. Pool has idle Thread
    const idleThread = this.findReusableIdleThread(config);
    if (idleThread) {
      this.logger.log(
        `[AcpAgentService] loadSession() — reusing idle thread ${idleThread.threadId}, cwd=${idleThread.cwd}`,
      );
      this.reservedThreads.add(idleThread);
      this.bindSession(sessionId, idleThread);
      this.permissionRouting.registerSession(sessionId);
      this.registerThreadStatusListener(sessionId, idleThread);
      return this.startPendingLoadSessionAndReleaseReservation(sessionId, idleThread, config, false);
    }

    const warmingThread = await this.reserveWarmingThread(config);
    if (warmingThread) {
      this.logger.log(
        `[AcpAgentService] loadSession() — waiting for prewarmed thread ${warmingThread.threadId}, cwd=${warmingThread.cwd}`,
      );
      this.bindSession(sessionId, warmingThread);
      this.permissionRouting.registerSession(sessionId);
      this.registerThreadStatusListener(sessionId, warmingThread);
      return this.startPendingLoadSessionAndReleaseReservation(sessionId, warmingThread, config, false);
    }

    // 4. Pool not full -> new Thread
    if (this.threadPool.length < this.maxPoolSize) {
      this.logger.log(
        `[AcpAgentService] loadSession() — creating new thread (pool=${this.threadPool.length}/${this.maxPoolSize})`,
      );
      const thread = this.createThreadInstance(sessionId, config);
      this.threadPool.push(thread);
      this.bindSession(sessionId, thread);
      this.permissionRouting.registerSession(sessionId);
      this.registerThreadStatusListener(sessionId, thread);
      return this.startPendingLoadSession(sessionId, thread, config, true);
    }

    // 5. Pool full, no idle -> recycle least recently used reusable Thread
    const recycledThread = await this.recycleLeastRecentlyUsedThread(sessionId, 'load-session', config);
    this.bindSession(sessionId, recycledThread);
    this.permissionRouting.registerSession(sessionId);
    this.registerThreadStatusListener(sessionId, recycledThread);
    return this.startPendingLoadSessionAndReleaseReservation(sessionId, recycledThread, config, false);
  }

  private startPendingLoadSessionAndReleaseReservation(
    sessionId: string,
    thread: AcpThread,
    config: AgentProcessConfig,
    shouldDisposeThreadOnFailure: boolean,
  ): Promise<SessionLoadResult> {
    const promise = this.startPendingLoadSession(sessionId, thread, config, shouldDisposeThreadOnFailure);
    this.reservedThreads.delete(thread);
    return promise;
  }

  private startPendingLoadSession(
    sessionId: string,
    thread: AcpThread,
    config: AgentProcessConfig,
    shouldDisposeThreadOnFailure: boolean,
  ): Promise<SessionLoadResult> {
    const pending: PendingSessionLoad = {
      promise: Promise.resolve(null as unknown as SessionLoadResult),
      refCount: 1,
      thread,
      closeRequested: false,
    };

    const promise = this.doLoadSession(sessionId, thread, config)
      .then(() => {
        if (pending.closeRequested) {
          throw new Error(`Session load was disposed before completion: ${sessionId}`);
        }
        this.sessionRefCounts.set(sessionId, pending.refCount);
        return this.buildSessionLoadResult(sessionId, thread);
      })
      .catch(async (e) => {
        this.sessions.delete(sessionId);
        this.sessionRefCounts.delete(sessionId);
        this.builtInMcpSessionIds.delete(sessionId);
        this.permissionRouting.unregisterSession(sessionId);
        this.unregisterThreadStatusListener(sessionId);
        if (shouldDisposeThreadOnFailure) {
          const idx = this.threadPool.indexOf(thread);
          if (idx !== -1) {
            this.threadPool.splice(idx, 1);
          }
          await thread.dispose();
        } else {
          thread.reset();
        }
        this.logger.error(`[AcpAgentService] loadSession() — failed: ${getAcpErrorMessage(e)}`);
        throw e;
      })
      .finally(() => {
        this.pendingSessionLoads.delete(sessionId);
      });

    pending.promise = promise;
    this.pendingSessionLoads.set(sessionId, pending);
    return promise;
  }

  private async doLoadSession(sessionId: string, thread: AcpThread, config: AgentProcessConfig): Promise<void> {
    if (!thread.initialized) {
      await thread.initialize(config as any);
    }
    if (thread.needsReset) {
      thread.reset();
    }
    const mcpServers = await this.getSessionMcpServers(thread, config);
    await thread.loadSession({
      sessionId,
      cwd: config.cwd,
      mcpServers,
    } as any);
    this.setBuiltInMcpSessionState(sessionId, this.didAppendBuiltInMcpServer(config, mcpServers));
    await this.applyDefaultSessionOptions(sessionId, thread, config);
  }

  private buildSessionLoadResult(sessionId: string, thread: AcpThread): SessionLoadResult {
    const historyUpdates = [...thread.getSessionNotifications()];
    const sessionState = thread.getSessionState();
    const modes = sessionState.modes
      ? sessionState.modes.map(({ id, name, description }) => ({ id, name, description: description ?? undefined }))
      : [];

    this.updateLastSessionInfo(sessionId, thread, modes);

    return {
      sessionId,
      processId: thread.threadId,
      modes,
      currentModeId: sessionState.currentModeId,
      models: sessionState.models ? [...sessionState.models] : undefined,
      currentModelId: sessionState.currentModelId,
      configOptions: sessionState.configOptions
        ? ([...sessionState.configOptions] as Record<string, any>[])
        : undefined,
      status: 'ready',
      threadStatus: thread.getStatus(),
      historyUpdates,
    };
  }

  private async applyDefaultSessionOptions(
    sessionId: string,
    thread: AcpThread,
    config: AgentProcessConfig,
  ): Promise<void> {
    const sessionState = thread.getSessionState();

    if (config.defaultMode) {
      const hasMode = sessionState.modes?.some((mode) => mode.id === config.defaultMode) === true;
      if (hasMode) {
        try {
          await thread.setSessionMode({ sessionId, modeId: config.defaultMode } as any);
        } catch (error) {
          this.logger.warn(`[AcpAgentService] Failed to apply defaultMode "${config.defaultMode}"`, error);
        }
      } else {
        this.logger.warn(`[AcpAgentService] Invalid defaultMode "${config.defaultMode}" for session ${sessionId}`);
      }
    }

    if (config.defaultModel) {
      const hasModel = sessionState.models?.some((model) => model.modelId === config.defaultModel) === true;
      if (hasModel) {
        try {
          await thread.unstable_setSessionModel({ sessionId, model: config.defaultModel } as any);
        } catch (error) {
          this.logger.warn(`[AcpAgentService] Failed to apply defaultModel "${config.defaultModel}"`, error);
        }
      } else {
        this.logger.warn(`[AcpAgentService] Invalid defaultModel "${config.defaultModel}" for session ${sessionId}`);
      }
    }

    const defaults = config.defaultConfigOptions;
    if (!defaults || Object.keys(defaults).length === 0) {
      return;
    }

    const configOptions = Array.isArray(sessionState.configOptions) ? sessionState.configOptions : [];
    for (const [configId, value] of Object.entries(defaults)) {
      const option = configOptions.find((item) => this.getConfigOptionId(item) === configId);
      if (!option) {
        this.logger.warn(`[AcpAgentService] Invalid defaultConfigOptions key "${configId}" for session ${sessionId}`);
        continue;
      }

      if (typeof value === 'string') {
        const validValues = this.collectConfigOptionValues(option);
        if (validValues.size === 0 || !validValues.has(value)) {
          this.logger.warn(
            `[AcpAgentService] Invalid defaultConfigOptions value "${value}" for config option "${configId}"`,
          );
          continue;
        }
      }

      try {
        await thread.setSessionConfigOption({ sessionId, configId, value } as any);
      } catch (error) {
        this.logger.warn(`[AcpAgentService] Failed to apply defaultConfigOptions "${configId}"`, error);
      }
    }
  }

  private getConfigOptionId(option: unknown): string | undefined {
    const rawId = (option as { id?: unknown; configId?: unknown })?.id ?? (option as { configId?: unknown })?.configId;
    if (typeof rawId === 'string') {
      return rawId;
    }
    if (rawId && typeof rawId === 'object' && typeof (rawId as { id?: unknown }).id === 'string') {
      return (rawId as { id: string }).id;
    }
    return undefined;
  }

  private collectConfigOptionValues(option: unknown): Set<string> {
    const values = new Set<string>();
    const roots = [
      (option as any)?.options,
      (option as any)?.values,
      (option as any)?.kind?.options,
      (option as any)?.kind?.select?.options,
      (option as any)?.select?.options,
    ].filter(Boolean);

    const visit = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (!node || typeof node !== 'object') {
        return;
      }
      const record = node as Record<string, unknown>;
      const value = record.value;
      if (typeof value === 'string') {
        values.add(value);
      } else if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
        values.add((value as { id: string }).id);
      }
      visit(record.options);
      visit(record.values);
      visit(record.groups);
    };

    roots.forEach(visit);
    return values;
  }

  // -----------------------------------------------------------------------
  // sendMessage — streaming forward
  // -----------------------------------------------------------------------

  attachSession(sessionId: string): SumiReadableStream<AgentSessionAttachmentUpdate> {
    const stream = new SumiReadableStream<AgentSessionAttachmentUpdate>();
    const thread = this.sessions.get(sessionId);
    if (!thread || thread.getStatus() === 'disconnected') {
      stream.emitError(new Error(`No active session for sessionId: ${sessionId}`));
      return stream;
    }

    this.touchSession(sessionId);
    let snapshotEmitted = false;
    const bufferedUpdates: AgentUpdate[] = [];

    const emitUpdate = (update: AgentUpdate) => {
      update.sessionId = update.sessionId || sessionId;
      update.threadStatus = update.threadStatus || thread.getStatus();
      if (!snapshotEmitted) {
        bufferedUpdates.push(update);
        return;
      }
      stream.emitData({ type: 'update', update });
    };

    const eventDisposable = thread.onEvent((event: AcpThreadEvent) => {
      if (event.type === 'session_notification') {
        if (event.notification.sessionId && event.notification.sessionId !== sessionId) {
          this.logger.warn(
            `[AcpAgentService] attachSession() — ignoring notification for ${event.notification.sessionId}; current session is ${sessionId}`,
          );
          return;
        }
        const agentUpdates = toAgentUpdate(event.notification);
        if (Array.isArray(agentUpdates)) {
          agentUpdates.forEach(emitUpdate);
        } else if (agentUpdates) {
          emitUpdate(agentUpdates);
        }
      } else if (event.type === 'status_changed') {
        emitUpdate({
          type: 'thread_status',
          content: '',
          sessionId,
          threadStatus: event.status,
        });
      }
    });

    const disposeSubscription = () => eventDisposable.dispose();
    stream.onEnd(disposeSubscription);
    stream.onError(disposeSubscription);

    stream.emitData({
      type: 'snapshot',
      snapshot: {
        ...this.buildSessionLoadResult(sessionId, thread),
        threadStatus: thread.getStatus(),
      },
    });
    snapshotEmitted = true;
    bufferedUpdates.splice(0).forEach((update) => stream.emitData({ type: 'update', update }));
    return stream;
  }

  sendMessage(request: AgentRequest, config: AgentProcessConfig): SumiReadableStream<AgentUpdate> {
    const stream = new SumiReadableStream<AgentUpdate>();
    void this.startSendMessage(request, config, stream);
    return stream;
  }

  private async startSendMessage(
    request: AgentRequest,
    config: AgentProcessConfig,
    stream: SumiReadableStream<AgentUpdate>,
  ): Promise<void> {
    let thread = this.sessions.get(request.sessionId);
    if (!thread) {
      this.logger.log(`[AcpAgentService] sendMessage() — session not active, loading sessionId=${request.sessionId}`);
      try {
        await this.loadSession(request.sessionId, config);
        thread = this.sessions.get(request.sessionId);
      } catch (error) {
        stream.emitError(normalizeAcpError(error));
        return;
      }
      if (!thread) {
        stream.emitError(new Error(`No active session for sessionId: ${request.sessionId}`));
        return;
      }
    }
    this.touchSession(request.sessionId);

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
        if (event.notification.sessionId && event.notification.sessionId !== request.sessionId) {
          this.logger.warn(
            `[AcpAgentService] sendMessage() — ignoring notification for ${event.notification.sessionId}; current session is ${request.sessionId}`,
          );
          return;
        }
        const agentUpdates = toAgentUpdate(event.notification);
        const normalizedUpdates = Array.isArray(agentUpdates) ? agentUpdates : [];
        if (agentUpdates && !Array.isArray(agentUpdates)) {
          normalizedUpdates.push(agentUpdates);
        }
        for (const agentUpdate of normalizedUpdates) {
          agentUpdate.threadStatus = thread.getStatus();
          agentUpdate.sessionId = agentUpdate.sessionId || event.notification.sessionId || request.sessionId;
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
    this.sendPrompt(thread, request, config, stream, disposables);
  }

  private async sendPrompt(
    thread: AcpThread,
    request: AgentRequest,
    config: AgentProcessConfig,
    stream: SumiReadableStream<AgentUpdate>,
    disposables: IDisposable[],
  ): Promise<void> {
    try {
      const webMcpHintsEnabled = config.webMcp?.enabled !== false && this.builtInMcpSessionIds.has(request.sessionId);
      const promptForAgent = await this.withWebMcpCapabilityHint(
        request.prompt,
        webMcpHintsEnabled && thread.getEntries().length <= 1,
        webMcpHintsEnabled,
      );
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
      this.logger.log(
        `[AcpAgentService] sendPrompt() — prompt returned, sessionId=${request.sessionId}, thread=${thread.threadId}`,
      );

      thread.markAssistantComplete();
      stream.emitData({ type: 'done', content: '' });
      stream.end();
    } catch (error) {
      this.logger.error(
        `[AcpAgentService] sendPrompt() — failed, sessionId=${request.sessionId}, thread=${
          thread.threadId
        }, error=${getAcpErrorMessage(error)}`,
      );
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
    this.touchSession(sessionId);

    try {
      await thread.cancel({ sessionId } as any);
    } catch (error) {
      this.logger?.warn('[AcpAgentService] cancelRequest error:', error);
    }
  }

  // -----------------------------------------------------------------------
  // listSessions
  // -----------------------------------------------------------------------

  async listSessions(params?: ListSessionsRequest, config?: AgentProcessConfig): Promise<ListSessionsResponse> {
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

    if (activeThreadCount === 0 && config) {
      const thread = await this.findOrCreateIdleThread(config);
      try {
        if (!thread.initialized) {
          await thread.initialize(config as any);
        }
        if (thread.needsReset) {
          thread.reset();
        }
        const result = await thread.listSessions(params);
        if (result?.sessions) {
          for (const info of result.sessions) {
            sessionsMap.set(info.sessionId, info);
          }
        }
        if (result?.nextCursor) {
          lastNextCursor = result.nextCursor;
        }
        activeThreadCount = 1;
      } catch (error) {
        this.logger?.warn(`[AcpAgentService] listSessions error for idle thread, cwd=${thread.cwd}:`, error);
      } finally {
        this.reservedThreads.delete(thread);
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
    this.touchSession(params.sessionId);

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
    this.syncMaxPoolSize(config);
    this.logger.log(`[AcpAgentService] loadSessionOrNew() — sessionId=${sessionId}`);

    const pendingLoad = this.pendingSessionLoads.get(sessionId);
    if (pendingLoad) {
      pendingLoad.refCount += 1;
      return pendingLoad.promise;
    }

    const existingThread = this.sessions.get(sessionId);
    if (existingThread && existingThread.getStatus() !== 'disconnected') {
      this.touchSession(sessionId);
      this.retainSession(sessionId);
      return this.buildSessionLoadResult(sessionId, existingThread);
    }

    const poolSizeBefore = this.threadPool.length;
    const thread = await this.findOrCreateThread(sessionId, config);
    this.permissionRouting.registerSession(sessionId);
    this.registerThreadStatusListener(sessionId, thread);
    const wasExisting = this.threadPool.length === poolSizeBefore;

    const pending: PendingSessionLoad = {
      promise: Promise.resolve(null as unknown as SessionLoadResult),
      refCount: 1,
      thread,
      closeRequested: false,
    };

    const promise = Promise.resolve()
      .then(async (): Promise<SessionLoadResult> => {
        if (!thread.initialized) {
          await thread.initialize(config as any);
        }
        if (thread.needsReset) {
          thread.reset();
        }
        const mcpServers = await this.getSessionMcpServers(thread, config);
        const loadResult = await thread.loadSessionOrNew({
          sessionId,
          cwd: config.cwd,
          mcpServers,
        } as any);
        const actualSessionId = (loadResult as { sessionId?: string }).sessionId || sessionId;
        if (pending.closeRequested) {
          throw new Error(`Session load was disposed before completion: ${sessionId}`);
        }
        if (actualSessionId !== sessionId) {
          this.sessions.delete(sessionId);
          this.sessionRefCounts.delete(sessionId);
          this.permissionRouting.unregisterSession(sessionId);
          this.builtInMcpSessionIds.delete(sessionId);
          this.unregisterThreadStatusListener(sessionId);
          this.bindSession(actualSessionId, thread);
          this.sessionRefCounts.set(actualSessionId, pending.refCount);
          this.permissionRouting.registerSession(actualSessionId);
          this.registerThreadStatusListener(actualSessionId, thread);
        } else {
          this.sessionRefCounts.set(sessionId, pending.refCount);
        }
        this.setBuiltInMcpSessionState(actualSessionId, this.didAppendBuiltInMcpServer(config, mcpServers));
        await this.applyDefaultSessionOptions(actualSessionId, thread, config);
        return this.buildSessionLoadResult(actualSessionId, thread);
      })
      .catch(async (e) => {
        this.sessions.delete(sessionId);
        this.sessionRefCounts.delete(sessionId);
        this.permissionRouting.unregisterSession(sessionId);
        this.builtInMcpSessionIds.delete(sessionId);
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
      })
      .finally(() => {
        this.pendingSessionLoads.delete(sessionId);
      });

    pending.promise = promise;
    this.pendingSessionLoads.set(sessionId, pending);
    this.reservedThreads.delete(thread);
    return promise;
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
    this.touchSession(params.sessionId);
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
    this.touchSession(params.sessionId);
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
    this.touchSession(params.sessionId);
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
    this.touchSession(params.sessionId);
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
    this.touchSession(params.sessionId);
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
    let thread = this.sessions.get(sessionId);
    this.logger.log(`[AcpAgentService] disposeSession() — sessionId=${sessionId}, force=${force}`);

    const pendingLoad = this.pendingSessionLoads.get(sessionId);
    if (pendingLoad) {
      pendingLoad.closeRequested = true;
      if (!force) {
        pendingLoad.refCount = Math.max(0, pendingLoad.refCount - 1);
        if (pendingLoad.refCount > 0) {
          pendingLoad.closeRequested = false;
          this.logger.log(
            `[AcpAgentService] disposeSession() — pending load still retained, sessionId=${sessionId}, refs=${pendingLoad.refCount}`,
          );
          return;
        }
        try {
          await pendingLoad.promise;
        } catch {
          // The pending load path owns its failure cleanup. Continue with the
          // normal release path to keep terminal/session cleanup idempotent.
        }
      }
      thread = this.sessions.get(sessionId) ?? pendingLoad.thread;
    }

    const refCount = this.sessionRefCounts.get(sessionId) ?? (thread ? 1 : 0);
    if (!force && refCount > 1) {
      this.sessionRefCounts.set(sessionId, refCount - 1);
      this.logger.log(
        `[AcpAgentService] disposeSession() — session still retained, sessionId=${sessionId}, refs=${refCount - 1}`,
      );
      return;
    }

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
    this.sessionRefCounts.delete(sessionId);
    this.logPoolStatus('after-disposeSession');
    this.builtInMcpSessionIds.delete(sessionId);
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

  async getAcpDebugLog(): Promise<AcpDebugLogEntry[]> {
    return acpDebugLogStore.getEntries();
  }

  async clearAcpDebugLog(): Promise<void> {
    acpDebugLogStore.clear();
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
    this.warmingThreads.clear();
    this.poolWarmups.clear();
    this.sessions.clear();
    this.pendingSessionLoads.clear();
    this.reservedThreads.clear();
    this.sessionRefCounts.clear();
    this.lastSessionInfo = null;
    this.builtInMcpSessionIds.clear();
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

  private updateLastSessionInfo(
    sessionId: string,
    thread: AcpThread,
    modes: Array<{ id: string; name: string }>,
  ): void {
    this.lastSessionInfo = {
      sessionId,
      processId: thread.threadId,
      modes,
      status: 'ready',
    };
  }

  private retainSession(sessionId: string): void {
    this.sessionRefCounts.set(sessionId, (this.sessionRefCounts.get(sessionId) ?? 1) + 1);
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

  private async withWebMcpCapabilityHint(
    input: string,
    includeHint: boolean,
    webMcpHintsEnabled = true,
  ): Promise<string> {
    if (!webMcpHintsEnabled || !includeHint) {
      return input;
    }
    return `${WEBMCP_CAPABILITY_HINT}\n\n${input}`;
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

/**
 * AcpThread — core Thread AI entity.
 *
 * Encapsulates:
 * 1. Agent process lifecycle (spawn / kill via child_process.spawn)
 * 2. SDK ClientSideConnection (via dynamic ESM import for Node 16 compat)
 * 3. Entries state management (ordered list of AgentThreadEntry)
 * 4. Client interface implementation for the SDK
 * 5. Event system via Emitter
 *
 * NOT decorated with @Injectable() — manually instantiated by AcpThreadFactory.
 */

import { ChildProcess, spawn } from 'node:child_process';
import { EventEmitter as NodeEventEmitter } from 'node:events';
import * as streamWeb from 'node:stream/web';

import { Autowired, Injectable, Injector, Provider } from '@opensumi/di';
import { Deferred, Disposable, Emitter, Event, ILogger, URI, uuid } from '@opensumi/ide-core-common';
import {
  AcpDebugLogDirection,
  AgentCapabilities,
  AvailableCommand,
  CancelNotification,
  CloseSessionRequest,
  CloseSessionResponse,
  ContentBlock,
  EnvVariable,
  ForkSessionRequest,
  ForkSessionResponse,
  InitializeRequest,
  InitializeResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  NewSessionRequest,
  NewSessionResponse,
  PermissionOption,
  PermissionOptionKind,
  Plan,
  PromptRequest,
  PromptResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  ResumeSessionRequest,
  ResumeSessionResponse,
  SessionNotification,
  SetSessionConfigOptionRequest,
  SetSessionConfigOptionResponse,
  SetSessionModeRequest,
  SetSessionModeResponse,
  SetSessionModelRequest,
  SetSessionModelResponse,
  ToolCall,
  ToolCallUpdate,
  WriteTextFileRequest,
  WriteTextFileResponse,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';
import { AgentProcessConfig } from '@opensumi/ide-core-common/lib/types/ai-native/agent-types';
import { INodeLogger } from '@opensumi/ide-core-node';

import { acpDebugLogStore } from './acp-debug-log';
import { resolveAgentSpawnConfig } from './acp-spawn-config';
import { AcpFileSystemHandler, AcpFileSystemHandlerToken } from './handlers/file-system.handler';
import { AcpTerminalHandler, AcpTerminalHandlerToken } from './handlers/terminal.handler';
import { PermissionRoutingService, PermissionRoutingServiceToken } from './permission-routing.service';

// ---------------------------------------------------------------------------
// Polyfill Web Streams for Node 16
// ---------------------------------------------------------------------------
function ensureWebStreamPolyfill(): void {
  if (typeof globalThis.ReadableStream === 'undefined' && streamWeb.ReadableStream) {
    (globalThis as any).ReadableStream = streamWeb.ReadableStream;
  }
  if (typeof globalThis.WritableStream === 'undefined' && streamWeb.WritableStream) {
    (globalThis as any).WritableStream = streamWeb.WritableStream;
  }
}

ensureWebStreamPolyfill();

// ---------------------------------------------------------------------------
// SDK dynamic import cache
// ---------------------------------------------------------------------------
let sdkModuleCache: any = null;

async function loadSdk(): Promise<any> {
  if (!sdkModuleCache) {
    sdkModuleCache = await import('@agentclientprotocol/sdk');
  }
  return sdkModuleCache;
}

// ---------------------------------------------------------------------------
// Node Stream → Web Stream conversion helpers
// ---------------------------------------------------------------------------
function nodeReadableToWebStream(
  readable: NodeJS.ReadableStream,
  onChunk?: (chunk: Uint8Array | Buffer | string) => void,
): ReadableStream<Uint8Array> {
  return new streamWeb.ReadableStream<Uint8Array>({
    start(controller) {
      readable.on('data', (chunk: Buffer) => {
        onChunk?.(chunk);
        controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
      });
      readable.on('end', () => {
        controller.close();
      });
      readable.on('error', (err) => {
        controller.error(err);
      });
    },
    cancel() {
      // no-op — we don't cancel the node stream from here
    },
  });
}

function nodeWritableToWebStream(
  writable: NodeJS.WritableStream,
  onChunk?: (chunk: Uint8Array | Buffer | string) => void,
): WritableStream<Uint8Array> {
  return new streamWeb.WritableStream<Uint8Array>({
    write(chunk) {
      onChunk?.(chunk);
      return new Promise<void>((resolve, reject) => {
        writable.write(chunk, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    },
    close() {
      // no-op — we let the caller manage lifecycle
    },
    abort() {
      // no-op
    },
  });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PROCESS_CONFIG = {
  /** Graceful shutdown timeout (ms) */
  GRACEFUL_SHUTDOWN_TIMEOUT_MS: 5000,
  /** Force kill timeout (ms) */
  FORCE_KILL_TIMEOUT_MS: 3000,
  /** Startup timeout (ms) */
  STARTUP_TIMEOUT_MS: 100,
} as const;

const ACP_PROTOCOL_VERSION = 1;
const ACP_AGENT_CONNECTION_CLOSED_DURING_PROMPT = 'ACP agent connection closed while waiting for prompt response.';

export class AcpThreadInitializationCancelledError extends Error {
  constructor() {
    super('ACP thread initialization was cancelled.');
    this.name = 'AcpThreadInitializationCancelledError';
  }
}

function isConnectionClosedDuringPromptError(error: unknown): boolean {
  return error instanceof Error && error.message === ACP_AGENT_CONNECTION_CLOSED_DURING_PROMPT;
}

// ---------------------------------------------------------------------------
// Thread status state machine
// ---------------------------------------------------------------------------
export type ThreadStatus =
  | 'idle'
  | 'working'
  | 'stopping'
  | 'awaiting_prompt'
  | 'auth_required'
  | 'errored'
  | 'disconnected';

// ---------------------------------------------------------------------------
// Tool call status state machine
// ---------------------------------------------------------------------------
export type ToolCallStatus =
  | 'pending'
  | 'in_progress'
  | 'waiting_for_confirmation'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'canceled';

// ---------------------------------------------------------------------------
// Entry data types — use SDK types for content, add local tracking fields
// ---------------------------------------------------------------------------

/** User message — simplified to string (SDK's PromptRequest.prompt is ContentBlock[]) */
export interface UserMessageEntry {
  id: string;
  content: string;
  timestamp: number;
}

/** Assistant message — chunks use SDK ContentBlock[], local isComplete flag */
export interface AssistantMessageEntry {
  chunks: ContentBlock[];
  isComplete: boolean;
  messageId?: string;
}

/** Tool Call — toolCall uses SDK ToolCall type, local status + result */
export interface ToolCallEntry {
  toolCall: ToolCall;
  status: ToolCallStatus;
  result?: unknown;
}

export interface AcpSessionInfoState {
  _meta?: { [key: string]: unknown } | null;
  title?: string | null;
  updatedAt?: string | null;
}

export interface AcpSessionState {
  notifications: ReadonlyArray<SessionNotification>;
  entries: ReadonlyArray<AgentThreadEntry>;
  modes?: ReadonlyArray<{ id: string; name: string; description?: string | null }>;
  currentModeId?: string;
  models?: ReadonlyArray<{ modelId: string; name: string; description?: string | null }>;
  currentModelId?: string;
  configOptions?: ReadonlyArray<unknown>;
  usage?: unknown;
  sessionInfo?: AcpSessionInfoState;
  availableCommands?: ReadonlyArray<AvailableCommand>;
}

/** Plan — SDK type directly, no wrapper needed */
// Plan = { entries: Array<{ content: string; completed: boolean }> }

/** AgentThreadEntry — discriminated union with data wrapper pattern */
export type AgentThreadEntry =
  | { type: 'user_message'; data: UserMessageEntry }
  | { type: 'assistant_message'; data: AssistantMessageEntry }
  | { type: 'tool_call'; data: ToolCallEntry }
  | { type: 'plan'; data: Plan };

// ---------------------------------------------------------------------------
// Event types — granular events (not bulk entries_changed)
// ---------------------------------------------------------------------------
export type AcpThreadEvent =
  | { type: 'entry_added'; entry: AgentThreadEntry }
  | { type: 'entry_updated'; entry: AgentThreadEntry }
  | { type: 'status_changed'; status: ThreadStatus }
  | { type: 'session_notification'; notification: SessionNotification }
  | { type: 'error'; error: Error }
  | { type: 'process_started' }
  | { type: 'process_stopped' };

// ---------------------------------------------------------------------------
// DI Token and Interface
// ---------------------------------------------------------------------------
export const AcpThreadToken = Symbol('AcpThreadToken');

export interface IAcpThread {
  /** Unique thread identifier */
  readonly threadId: string;

  /** Current session ID (bound after newSession/loadSession) */
  readonly sessionId: string;

  /** Current thread status */
  readonly status: ThreadStatus;

  /** Ordered list of thread entries */
  readonly entries: ReadonlyArray<AgentThreadEntry>;

  /** Whether the thread has been initialized */
  readonly initialized: boolean;

  /** Whether the agent process is running */
  readonly isProcessRunning: boolean;

  /** Whether the SDK connection is established */
  readonly isConnected: boolean;

  /** Whether the thread was bound to a session and needs reset() before reuse */
  readonly needsReset: boolean;

  /** Agent capabilities from initialize */
  readonly agentCapabilities: AgentCapabilities | null;

  /** Event emitter for thread events */
  readonly onEvent: Event<AcpThreadEvent>;

  // Process lifecycle
  initialize(config: AgentProcessConfig): Promise<InitializeResponse>;
  newSession(params?: Omit<NewSessionRequest, 'sessionId'>): Promise<NewSessionResponse>;
  loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse>;
  loadSessionOrNew(params: LoadSessionRequest): Promise<NewSessionResponse | LoadSessionResponse>;
  prompt(params: PromptRequest): Promise<PromptResponse>;
  cancel(params: CancelNotification): Promise<void>;
  listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse>;

  // Session mode & config
  setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse | void>;
  setSessionConfigOption(params: SetSessionConfigOptionRequest): Promise<SetSessionConfigOptionResponse>;

  // Unstable session operations
  unstable_forkSession(params: ForkSessionRequest): Promise<ForkSessionResponse>;
  unstable_resumeSession(params: ResumeSessionRequest): Promise<ResumeSessionResponse>;
  closeSession(params: CloseSessionRequest): Promise<CloseSessionResponse>;
  deleteSession(params: { sessionId: string }): Promise<void>;
  unstable_setSessionModel(params: SetSessionModelRequest): Promise<SetSessionModelResponse | void>;

  // State management (internal + testing)
  getEntries(): ReadonlyArray<AgentThreadEntry>;
  getSessionNotifications(): ReadonlyArray<SessionNotification>;
  getSessionState(): AcpSessionState;
  getStatus(): ThreadStatus;
  setStatus(status: ThreadStatus): void;
  setError(error: Error): void;
  handleNotification(notification: SessionNotification): void;

  // Message manipulation
  addUserMessage(content: string): UserMessageEntry;
  markAssistantComplete(): void;

  // ToolCall interaction
  markToolCallWaiting(toolCallId: string): void;
  respondToToolCall(toolCallId: string, allowed: boolean): void;

  // Lifecycle
  reset(): void;
  dispose(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Constructor options
// ---------------------------------------------------------------------------
export interface AcpThreadOptions {
  agentId: string;
  command: string;
  args: string[];
  env?: EnvVariable[];
  cwd: string;
  nodePath?: string;
  fileSystemHandler: AcpFileSystemHandler;
  terminalHandler: AcpTerminalHandler;
  permissionRouting: PermissionRoutingService;
  logger: INodeLogger;
}

// ---------------------------------------------------------------------------
// Factory — DI factory for creating AcpThread instances
// ---------------------------------------------------------------------------

/**
 * Runtime configuration for creating an AcpThread.
 * Provided by the caller (e.g., AcpAgentService) at thread creation time.
 */
export interface AcpThreadRuntimeConfig {
  agentId: string;
  command: string;
  args: string[];
  env?: EnvVariable[];
  cwd: string;
  nodePath?: string;
}

/**
 * Factory function type — creates an AcpThread for the given sessionId.
 * Dependencies (fileSystemHandler, terminalHandler, permissionCaller, logger)
 * are injected by the DI system. Runtime parameters (command, args, cwd, env)
 * are provided by the caller.
 */
export type AcpThreadFactory = (sessionId: string, config: AcpThreadRuntimeConfig) => AcpThread;

export const AcpThreadFactoryToken = Symbol('AcpThreadFactoryToken');

/**
 * Provider definition for the AcpThreadFactory.
 * Uses useFactory pattern with Injector to resolve dependencies.
 *
 * Usage in consumer:
 *   @Autowired(AcpThreadFactoryToken)
 *   private threadFactory: AcpThreadFactory;
 *
 *   const thread = this.threadFactory(sessionId, {
 *     command: '/path/to/agent',
 *     args: ['--stdio'],
 *     cwd: workspaceDir,
 *   });
 */
export const AcpThreadFactoryProvider: Provider = {
  token: AcpThreadFactoryToken,
  useFactory: (injector: Injector) => {
    const fileSystemHandler = injector.get(AcpFileSystemHandlerToken);
    const terminalHandler = injector.get(AcpTerminalHandlerToken);
    const permissionRouting = injector.get(PermissionRoutingServiceToken);
    const logger = injector.get(INodeLogger);

    return (sessionId: string, config: AcpThreadRuntimeConfig) =>
      new AcpThread({
        agentId: config.agentId,
        command: config.command,
        args: config.args,
        env: config.env,
        cwd: config.cwd,
        nodePath: config.nodePath,
        fileSystemHandler,
        terminalHandler,
        permissionRouting,
        logger,
      });
  },
};

// ---------------------------------------------------------------------------
// AcpThread Implementation
// ---------------------------------------------------------------------------
export class AcpThread extends Disposable implements IAcpThread {
  readonly threadId: string = uuid();

  /** Working directory of the thread's agent process */
  get cwd(): string {
    return this.options.cwd;
  }

  // State
  private _status: ThreadStatus = 'idle';
  private _entries: AgentThreadEntry[] = [];
  private _sessionNotifications: SessionNotification[] = [];
  private _pendingLocalUserMessageEcho: { content: string; matchedLength: number } | undefined;
  private _sessionId: string = '';
  private _needsReset = false;
  private _agentCapabilities: AgentCapabilities | null = null;
  private _initialized = false;
  private _modes: Array<{ id: string; name: string; description?: string | null }> | undefined;
  private _currentModeId: string | undefined;
  private _models: Array<{ modelId: string; name: string; description?: string | null }> | undefined;
  private _currentModelId: string | undefined;
  private _configOptions: unknown[] | undefined;
  private _usage: unknown;
  private _sessionInfo: AcpSessionInfoState | undefined;
  private _availableCommands: AvailableCommand[] | undefined;

  // Process
  private _childProcess: ChildProcess | null = null;
  private _startingChildProcess: ChildProcess | null = null;
  private _processRunning = false;
  private _debugLogRecorders = new Map<AcpDebugLogDirection, (chunk: Uint8Array | Buffer | string) => void>();

  // SDK
  private _connection: any = null; // ClientSideConnection instance
  private _connected = false;
  private _disposed = false;
  private _initializationCancellationRejectors = new Set<(error: Error) => void>();

  // Permission request tracking
  private _pendingPermissionRequests = new Map<
    string,
    { resolve: (resp: RequestPermissionResponse) => void; reject: (err: Error) => void }
  >();

  // Event emitter
  private _eventEmitter = new Emitter<AcpThreadEvent>();

  get onEvent(): Event<AcpThreadEvent> {
    return this._eventEmitter.event;
  }

  get status(): ThreadStatus {
    return this._status;
  }

  get entries(): ReadonlyArray<AgentThreadEntry> {
    return this._entries;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  get isProcessRunning(): boolean {
    return this._processRunning;
  }

  get isConnected(): boolean {
    return this._connected;
  }

  get sessionId(): string {
    return this._sessionId;
  }

  get needsReset(): boolean {
    return this._needsReset;
  }

  get agentCapabilities(): AgentCapabilities | null {
    return this._agentCapabilities;
  }

  constructor(private readonly options: AcpThreadOptions) {
    super();
  }

  // -----------------------------------------------------------------------
  // Public API — state accessors (spec)
  // -----------------------------------------------------------------------
  getEntries(): ReadonlyArray<AgentThreadEntry> {
    return this._entries;
  }

  getSessionNotifications(): ReadonlyArray<SessionNotification> {
    return this._sessionNotifications.map((notification) => this.cloneSessionNotification(notification));
  }

  getSessionState(): AcpSessionState {
    return {
      notifications: this.getSessionNotifications(),
      entries: this._entries,
      modes: this._modes ? [...this._modes] : undefined,
      currentModeId: this._currentModeId,
      models: this._models ? [...this._models] : undefined,
      currentModelId: this._currentModelId,
      configOptions: this._configOptions ? [...this._configOptions] : undefined,
      usage: this._usage,
      sessionInfo: this._sessionInfo ? { ...this._sessionInfo } : undefined,
      availableCommands: this._availableCommands ? [...this._availableCommands] : undefined,
    };
  }

  getStatus(): ThreadStatus {
    return this._status;
  }

  setStatus(status: ThreadStatus): void {
    if (this._status === status) {
      return;
    }
    this.logger?.log(`[AcpThread:${this.threadId}] setStatus() — ${this._status} → ${status}`);
    this._status = status;
    this.fireEvent({ type: 'status_changed', status } as AcpThreadEvent);
  }

  setError(error: Error): void {
    this._status = 'errored';
    this.fireEvent({ type: 'status_changed', status: 'errored' } as AcpThreadEvent);
    this.fireEvent({ type: 'error', error } as AcpThreadEvent);
  }

  // -----------------------------------------------------------------------
  // Process lifecycle
  // -----------------------------------------------------------------------
  private async startProcess(): Promise<void> {
    this.throwIfInitializationCancelled();
    if (this._childProcess && this.isProcessAlive()) {
      return;
    }

    // Clean up stale process reference
    this._childProcess = null;
    this._processRunning = false;

    const resolved = resolveAgentSpawnConfig({
      config: {
        agentId: this.options.agentId,
        command: this.options.command,
        args: this.options.args,
        env: this.options.env,
        cwd: this.options.cwd,
        nodePath: this.options.nodePath,
      },
      processEnv: process.env,
      processExecPath: process.execPath,
    });

    return new Promise<void>((resolve, reject) => {
      let startupError: Error | null = null;

      const childProcess = spawn(resolved.command, resolved.args, {
        cwd: this.options.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
        shell: false,
        env: resolved.env,
      });
      this._startingChildProcess = childProcess;

      childProcess.on('error', (err: Error) => {
        startupError = err;
        if (this._startingChildProcess === childProcess) {
          this._startingChildProcess = null;
        }
        this.logger?.error(`[AcpThread:${this.threadId}] Failed to start process: ${err.message}`);
        reject(this.wrapError(err, this.options.command));
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        this.recordDebugLog('stderr', data);
        this.logger?.warn(`[AcpThread:${this.threadId}] Agent stderr:`, data.toString('utf8'));
      });

      childProcess.on('exit', (code: number | null, signal: string | null) => {
        this.logger?.log(`[AcpThread:${this.threadId}] Process exited: code=${code}, signal=${signal}`);
        if (this._startingChildProcess === childProcess) {
          this._startingChildProcess = null;
        }
        if (this._childProcess !== childProcess || this._disposed) {
          return;
        }
        this._processRunning = false;
        this._connected = false;
        this.setStatus('disconnected');
        this.fireEvent({ type: 'process_stopped' } as AcpThreadEvent);
      });

      setTimeout(() => {
        if (startupError) {
          return;
        }
        if (this._disposed || this._startingChildProcess !== childProcess) {
          reject(new AcpThreadInitializationCancelledError());
          return;
        }
        if (!childProcess.pid) {
          this._startingChildProcess = null;
          reject(new Error(`Failed to get PID for agent process: ${this.options.command}`));
          return;
        }
        this._startingChildProcess = null;
        this._childProcess = childProcess;
        this._processRunning = true;
        this.recordDebugLog('system', `process started: ${resolved.command} ${resolved.args.join(' ')}`);
        this.fireEvent({ type: 'process_started' } as AcpThreadEvent);
        resolve();
      }, PROCESS_CONFIG.STARTUP_TIMEOUT_MS);
    });
  }

  private isProcessAlive(): boolean {
    if (!this._childProcess) {
      return false;
    }
    if (this._childProcess.killed || this._childProcess.exitCode !== null) {
      return false;
    }
    if (!this._childProcess.pid) {
      return false;
    }
    try {
      process.kill(this._childProcess.pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private async killProcess(): Promise<void> {
    const startingChildProcess = this._startingChildProcess;
    this._startingChildProcess = null;
    const childProcess = this._childProcess;
    this._childProcess = null;
    this._processRunning = false;
    const children = [startingChildProcess, childProcess].filter(
      (candidate, index, all): candidate is ChildProcess => Boolean(candidate) && all.indexOf(candidate) === index,
    );
    await Promise.all(children.map((candidate) => this.terminateChildProcess(candidate)));
  }

  private terminateChildProcess(childProcess: ChildProcess): Promise<void> {
    if (!childProcess.pid || childProcess.exitCode !== null) {
      return Promise.resolve();
    }

    const pid = childProcess.pid;
    (childProcess as any).killed = true;

    // Try SIGTERM first
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        // process already dead
      }
    }

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        // Force kill
        try {
          process.kill(-pid, 'SIGKILL');
        } catch {
          try {
            process.kill(pid, 'SIGKILL');
          } catch {
            // ignore
          }
        }
        resolve();
      }, PROCESS_CONFIG.GRACEFUL_SHUTDOWN_TIMEOUT_MS);

      childProcess.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  // -----------------------------------------------------------------------
  // SDK connection
  // -----------------------------------------------------------------------
  private async ensureSdkConnection(): Promise<void> {
    this.throwIfInitializationCancelled();
    if (this._connection) {
      return;
    }

    await this.startProcess();
    this.throwIfInitializationCancelled();

    const sdk = await loadSdk();
    this.throwIfInitializationCancelled();
    const { ClientSideConnection, ndJsonStream } = sdk;

    const stdout = this._childProcess!.stdio[1] as NodeJS.ReadableStream;
    const stdin = this._childProcess!.stdio[0] as NodeJS.WritableStream;

    const webOutputStream = nodeWritableToWebStream(stdin, (chunk) => this.recordDebugLog('outgoing', chunk));
    const webInputStream = nodeReadableToWebStream(stdout, (chunk) => this.recordDebugLog('incoming', chunk));

    const stream = ndJsonStream(webOutputStream, webInputStream);

    const clientImpl = this.createClientImpl();
    this._connection = new ClientSideConnection((_agent: any) => clientImpl, stream);

    this.throwIfInitializationCancelled();
    this._connected = true;
  }

  private throwIfInitializationCancelled(): void {
    if (this._disposed) {
      throw new AcpThreadInitializationCancelledError();
    }
  }

  private async rejectInitializationOnDispose<T>(operation: Promise<T>): Promise<T> {
    this.throwIfInitializationCancelled();
    let rejectOnDispose!: (error: Error) => void;
    const disposed = new Promise<never>((_resolve, reject) => {
      rejectOnDispose = reject;
      this._initializationCancellationRejectors.add(reject);
    });

    try {
      return await Promise.race([operation, disposed]);
    } finally {
      this._initializationCancellationRejectors.delete(rejectOnDispose);
    }
  }

  private async rejectOnConnectionClosed<T>(operation: Promise<T>, message: string): Promise<T> {
    const closed = this._connection?.closed;
    if (!closed || typeof closed.then !== 'function') {
      return operation;
    }

    let settled = false;
    const closedPromise = new Promise<T>((_resolve, reject) => {
      void closed.then(() => {
        if (!settled) {
          reject(new Error(message));
        }
      });
    });

    try {
      return await Promise.race([operation, closedPromise]);
    } finally {
      settled = true;
    }
  }

  private createClientImpl(): any {
    const self = this;

    return {
      async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
        return self.handlePermissionRequest(params);
      },

      async sessionUpdate(params: SessionNotification): Promise<void> {
        if (!self.isCurrentSessionNotification(params)) {
          return;
        }
        if (self.consumeLocalUserMessageEcho(params)) {
          return;
        }
        self.recordSessionNotification(params);
        self.handleNotification(params);
        self.fireEvent({
          type: 'session_notification',
          notification: params,
        } as AcpThreadEvent);
      },

      async readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse> {
        const result = await self.options.fileSystemHandler.readTextFile({
          sessionId: params.sessionId,
          path: params.path,
          line: params.line ?? undefined,
          limit: params.limit ?? undefined,
        });
        return result as unknown as ReadTextFileResponse;
      },

      async writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse> {
        const result = await self.options.fileSystemHandler.writeTextFile({
          sessionId: params.sessionId,
          path: params.path,
          content: params.content,
        });
        return result as unknown as WriteTextFileResponse;
      },

      async createTerminal(params: any): Promise<any> {
        const result = await self.options.terminalHandler.createTerminal({
          sessionId: params.sessionId,
          command: params.command,
          args: params.args,
          env: params.env,
          cwd: params.cwd,
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
        return { terminalId: result.terminalId! };
      },

      async terminalOutput(params: any): Promise<any> {
        const result = await self.options.terminalHandler.getTerminalOutput(params.terminalId, params.sessionId);
        if (result.error) {
          throw new Error(result.error.message);
        }
        return {
          output: result.output || '',
          truncated: result.truncated || false,
          exitStatus: result.exitStatus ?? null,
        };
      },

      async waitForTerminalExit(params: any): Promise<any> {
        const result = await self.options.terminalHandler.waitForTerminalExit(params.terminalId, params.sessionId);
        if (result.error) {
          throw new Error(result.error.message);
        }
        return {
          exitCode: result.exitCode ?? null,
        };
      },

      async killTerminal(params: any): Promise<any> {
        const result = await self.options.terminalHandler.killTerminal(params.terminalId, params.sessionId);
        if (result.error) {
          throw new Error(result.error.message);
        }
        return {};
      },

      async releaseTerminal(params: any): Promise<any> {
        const result = await self.options.terminalHandler.releaseTerminal(params.terminalId, params.sessionId);
        if (result.error) {
          throw new Error(result.error.message);
        }
      },
    };
  }

  // -----------------------------------------------------------------------
  // Public API — initialize (spec: accepts AgentProcessConfig)
  // -----------------------------------------------------------------------
  async initialize(config: AgentProcessConfig): Promise<InitializeResponse> {
    this.logger?.log(
      `[AcpThread:${this.threadId}] initialize() — agent=${config.command || this.options.command}, cwd=${config.cwd}`,
    );
    await this.rejectInitializationOnDispose(this.ensureSdkConnection());
    this.throwIfInitializationCancelled();

    const initParams: InitializeRequest = {
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: true,
        },
        terminal: true,
      },
      clientInfo: {
        name: 'opensumi',
        title: 'OpenSumi IDE',
        version: '3.0.0',
      },
    };

    // Override with config if provided
    if (config.env) {
      initParams.clientCapabilities = {
        ...initParams.clientCapabilities,
        ...((config as any).clientCapabilities || {}),
      };
    }

    const response: InitializeResponse = await this.rejectInitializationOnDispose(
      this._connection.initialize(initParams),
    );
    this.throwIfInitializationCancelled();

    if (response.protocolVersion !== initParams.protocolVersion) {
      if (response.protocolVersion > ACP_PROTOCOL_VERSION) {
        throw new Error(
          `Unsupported protocol version: ${response.protocolVersion}. ` +
            `This client supports up to version ${ACP_PROTOCOL_VERSION}.`,
        );
      }
    }

    if (response.agentCapabilities) {
      this._agentCapabilities = response.agentCapabilities;
    }

    this._initialized = true;
    this.logger?.log(
      `[AcpThread:${this.threadId}] initialize() — done, protocolVersion=${
        response.protocolVersion
      }, capabilities=${JSON.stringify(response.agentCapabilities)}`,
    );
    return response;
  }

  // -----------------------------------------------------------------------
  // Public API — session management
  // -----------------------------------------------------------------------
  async newSession(params?: Omit<NewSessionRequest, 'sessionId'>): Promise<NewSessionResponse> {
    await this.ensureInitialized();
    this.logger?.log(
      `[AcpThread:${this.threadId}] newSession() — cwd=${params?.cwd ?? this.options.cwd}, mcpServers=${
        params?.mcpServers?.length ?? 0
      }`,
    );

    const request: NewSessionRequest = {
      cwd: params?.cwd ?? this.options.cwd,
      mcpServers: params?.mcpServers ?? [],
      ...(params?._meta ? { _meta: params._meta } : {}),
    };

    const rpcStartedAt = Date.now();
    let response: NewSessionResponse;
    try {
      response = await this._connection.newSession(request);
    } catch (error) {
      this.logger?.error(
        `[AcpThread:${this.threadId}] newSession() — rpc failed, durationMs=${Date.now() - rpcStartedAt}`,
        error,
      );
      throw error;
    }
    this._sessionId = response.sessionId;
    acpDebugLogStore.setThreadSessionId(this.threadId, response.sessionId);
    this._needsReset = true;
    this.applySessionInitialState(response);
    this.setStatus('awaiting_prompt');
    this.logger?.log(
      `[AcpThread:${this.threadId}] newSession() — sessionId=${
        response.sessionId
      }, status=awaiting_prompt, rpcDurationMs=${Date.now() - rpcStartedAt}`,
    );
    return response;
  }

  async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
    await this.ensureInitialized();
    this.assertSessionCapability('session/load', this._agentCapabilities?.loadSession === true);
    this.logger?.log(`[AcpThread:${this.threadId}] loadSession() — sessionId=${params.sessionId}`);

    this._sessionId = params.sessionId;
    acpDebugLogStore.setThreadSessionId(this.threadId, params.sessionId);
    const response: LoadSessionResponse = await this._connection.loadSession(params);
    this._needsReset = true;
    this.applySessionInitialState(response);
    this.setStatus('awaiting_prompt');
    this.logger?.log(
      `[AcpThread:${this.threadId}] loadSession() — loaded sessionId=${params.sessionId}, status=awaiting_prompt`,
    );
    return response;
  }

  async loadSessionOrNew(params: LoadSessionRequest): Promise<NewSessionResponse | LoadSessionResponse> {
    await this.ensureInitialized();
    this.logger?.log(`[AcpThread:${this.threadId}] loadSessionOrNew() — sessionId=${params.sessionId}`);

    // Try loading first; fall back to new session
    try {
      return await this.loadSession(params);
    } catch {
      // Session doesn't exist, create a new one with same cwd/mcpServers
      this.logger?.log(
        `[AcpThread:${this.threadId}] loadSessionOrNew() — session not found, falling back to newSession`,
      );
      return await this.newSession({
        cwd: params.cwd ?? this.options.cwd,
        mcpServers: params.mcpServers ?? [],
      });
    }
  }

  async prompt(params: PromptRequest): Promise<PromptResponse> {
    await this.ensureInitialized();
    this.logger?.log(`[AcpThread:${this.threadId}] prompt() — status→working`);
    this.setStatus('working');

    let response: PromptResponse;
    try {
      response = await this.rejectOnConnectionClosed(
        this._connection.prompt(params),
        ACP_AGENT_CONNECTION_CLOSED_DURING_PROMPT,
      );
    } catch (error) {
      if (this._status === 'working' || this._status === 'stopping') {
        const nextStatus = isConnectionClosedDuringPromptError(error) ? 'disconnected' : 'awaiting_prompt';
        this.setStatus(nextStatus);
        this.logger?.log(
          `[AcpThread:${this.threadId}] prompt() — failed, status→${nextStatus}, entries=${this._entries.length}`,
        );
      }
      throw error;
    }

    // After prompt completes, transition to awaiting_prompt
    if (this._status === 'working' || this._status === 'stopping') {
      this.setStatus('awaiting_prompt');
      this.logger?.log(
        `[AcpThread:${this.threadId}] prompt() — done, status→awaiting_prompt, entries=${this._entries.length}`,
      );
    }
    return response;
  }

  async cancel(params: CancelNotification): Promise<void> {
    this.logger?.log(`[AcpThread:${this.threadId}] cancel() — sessionId=${params.sessionId}`);
    if (this._status === 'stopping') {
      this.logger?.log(`[AcpThread:${this.threadId}] cancel() — already stopping`);
      return;
    }

    const previousStatus = this._status;
    if (previousStatus === 'working' || previousStatus === 'auth_required') {
      this.setStatus('stopping');
    }

    try {
      await this.ensureInitialized();
      await this._connection.cancel(params);
      this.logger?.log(`[AcpThread:${this.threadId}] cancel() — done`);
    } catch (error) {
      if (this.getStatus() === 'stopping') {
        this.setStatus(previousStatus);
      }
      throw error;
    }
  }

  async listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse> {
    this.logger?.log(`[AcpThread:${this.threadId}] listSessions()`);
    await this.ensureInitialized();
    this.assertSessionCapability('session/list', this._agentCapabilities?.sessionCapabilities?.list != null);
    return this._connection.listSessions(params || {});
  }

  private assertSessionCapability(
    operation: 'session/list' | 'session/load' | 'session/close' | 'session/delete',
    supported: boolean,
  ): void {
    if (!supported) {
      throw new Error(`Agent does not support ACP ${operation}.`);
    }
  }

  async setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse | void> {
    this.logger?.log(`[AcpThread:${this.threadId}] setSessionMode() — modeId=${params.modeId}`);
    await this.ensureInitialized();
    const response = await this._connection.setSessionMode(params);
    this._currentModeId = params.modeId;
    return response;
  }

  async setSessionConfigOption(params: SetSessionConfigOptionRequest): Promise<SetSessionConfigOptionResponse> {
    this.logger?.log(`[AcpThread:${this.threadId}] setSessionConfigOption()`);
    await this.ensureInitialized();
    const response = await this._connection.setSessionConfigOption(params);
    if (Array.isArray((response as any)?.configOptions)) {
      this._configOptions = [...(response as any).configOptions];
    } else if (this._configOptions) {
      this._configOptions = this._configOptions.map((option: any) => {
        const optionId = option?.id ?? option?.configId;
        if (optionId !== params.configId) {
          return option;
        }
        const next = { ...option };
        if (next.kind && typeof next.kind === 'object') {
          next.kind = { ...next.kind, currentValue: params.value };
        }
        next.currentValue = params.value;
        return next;
      });
    }
    return response;
  }

  async unstable_forkSession(params: ForkSessionRequest): Promise<ForkSessionResponse> {
    this.logger?.log(`[AcpThread:${this.threadId}] unstable_forkSession()`);
    await this.ensureInitialized();
    return this._connection.unstable_forkSession(params);
  }

  async unstable_resumeSession(params: ResumeSessionRequest): Promise<ResumeSessionResponse> {
    this.logger?.log(`[AcpThread:${this.threadId}] unstable_resumeSession()`);
    await this.ensureInitialized();
    return this._connection.unstable_resumeSession(params);
  }

  async closeSession(params: CloseSessionRequest): Promise<CloseSessionResponse> {
    this.logger?.log(`[AcpThread:${this.threadId}] closeSession()`);
    await this.ensureInitialized();
    this.assertSessionCapability('session/close', this._agentCapabilities?.sessionCapabilities?.close != null);
    return this._connection.closeSession(params);
  }

  async deleteSession(params: { sessionId: string }): Promise<void> {
    this.logger?.log(`[AcpThread:${this.threadId}] deleteSession()`);
    await this.ensureInitialized();
    this.assertSessionCapability('session/delete', this._agentCapabilities?.sessionCapabilities?.delete != null);
    await this._connection.deleteSession(params as any);
  }

  async unstable_setSessionModel(params: SetSessionModelRequest): Promise<SetSessionModelResponse | void> {
    this.logger?.log(`[AcpThread:${this.threadId}] unstable_setSessionModel()`);
    await this.ensureInitialized();
    const response = await this._connection.unstable_setSessionModel(params);
    this._currentModelId = (params as any).model ?? params.modelId;
    return response;
  }

  // -----------------------------------------------------------------------
  // Entry manipulation
  // -----------------------------------------------------------------------
  addUserMessage(content: string): UserMessageEntry {
    this.logger?.log(
      `[AcpThread:${this.threadId}] addUserMessage() — content length=${content.length}, entries=${this._entries.length}`,
    );
    const entry: UserMessageEntry = {
      id: uuid(),
      content,
      timestamp: Date.now(),
    };
    const threadEntry: AgentThreadEntry = { type: 'user_message', data: entry };
    this._entries.push(threadEntry);
    if (this._sessionId) {
      this.recordSessionNotification({
        sessionId: this._sessionId,
        update: {
          sessionUpdate: 'user_message_chunk',
          content: { type: 'text', text: content },
          messageId: entry.id,
        } as any,
      });
      this._pendingLocalUserMessageEcho = { content, matchedLength: 0 };
    }
    this.fireEntryAdded(threadEntry);
    return entry;
  }

  /**
   * Mark the last assistant entry as complete.
   * No parameters — finds the last assistant entry automatically.
   * Transitions status to awaiting_prompt.
   * Fires entry_updated + status_changed.
   */
  markAssistantComplete(): void {
    // Find last assistant_message entry
    for (let i = this._entries.length - 1; i >= 0; i--) {
      const e = this._entries[i];
      if (e.type === 'assistant_message') {
        e.data.isComplete = true;
        this.fireEntryUpdated(e);
        if (this._status !== 'awaiting_prompt') {
          this.setStatus('awaiting_prompt');
        }
        return;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Tool call state management
  // -----------------------------------------------------------------------
  markToolCallWaiting(toolCallId: string): void {
    const entry = this._entries.find(
      (e): e is Extract<AgentThreadEntry, { type: 'tool_call' }> =>
        e.type === 'tool_call' && e.data.toolCall.toolCallId === toolCallId,
    );
    if (entry) {
      entry.data.status = 'waiting_for_confirmation';
      this.fireEntryUpdated(entry);
    }
  }

  /**
   * Respond to a tool call permission request.
   * Updates the ToolCallEntry.status to 'completed' if allowed, 'rejected' if not.
   * Fires entry_updated.
   */
  respondToToolCall(toolCallId: string, allowed: boolean): void {
    const entry = this._entries.find(
      (e): e is Extract<AgentThreadEntry, { type: 'tool_call' }> =>
        e.type === 'tool_call' && e.data.toolCall.toolCallId === toolCallId,
    );
    if (entry) {
      entry.data.status = allowed ? 'completed' : 'rejected';
      this.fireEntryUpdated(entry);
    }
  }

  // -----------------------------------------------------------------------
  // Reset and dispose
  // -----------------------------------------------------------------------
  /**
   * Lightweight reset for pool reuse.
   * Clears entries, status → idle, releases terminal mapping.
   * Does NOT clear _initialized — thread remains reusable.
   */
  reset(): void {
    this.logger?.log(
      `[AcpThread:${this.threadId}] reset() — clearing ${this._entries.length} entries, sessionId=${this._sessionId}, ${
        this._needsReset ? 'needsReset' : ''
      }`,
    );
    this._entries = [];
    this._sessionNotifications = [];
    this._pendingLocalUserMessageEcho = undefined;
    this._sessionId = '';
    this._needsReset = false;
    this.clearSessionState();
    // NOTE: Do NOT clear _initialized — thread remains initialized and reusable
    this.resolvePendingPermissionRequestsAsCancelled();
    this.setStatus('idle');
  }

  async dispose(): Promise<void> {
    this.logger?.log(
      `[AcpThread:${this.threadId}] dispose() — status=${this._status}, entries=${this._entries.length}`,
    );
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    const cancellationError = new AcpThreadInitializationCancelledError();
    for (const reject of this._initializationCancellationRejectors) {
      reject(cancellationError);
    }
    this._initializationCancellationRejectors.clear();
    this.resolvePendingPermissionRequestsAsCancelled();
    this._eventEmitter.dispose();
    await this.killProcess();
    this._connection = null;
    this._connected = false;
    super.dispose();
  }

  // -----------------------------------------------------------------------
  // Public — notification handling (spec: must be public)
  // -----------------------------------------------------------------------
  handleNotification(params: SessionNotification): void {
    if (!this.isCurrentSessionNotification(params)) {
      return;
    }

    const update = params.update;
    if (!update) {
      return;
    }

    // this.logger?.log(`[AcpThread:${this.threadId}] handleNotification() — ${update.sessionUpdate}`);

    switch (update.sessionUpdate) {
      case 'user_message_chunk': {
        this.mergeUserMessageChunk(update);
        break;
      }
      case 'agent_message_chunk':
      case 'agent_thought_chunk': {
        this.mergeAssistantMessageChunk(update);
        break;
      }
      case 'tool_call': {
        this.createToolCallEntry(update as any);
        break;
      }
      case 'tool_call_update': {
        this.updateToolCallEntry(update as ToolCallUpdate & { sessionUpdate: 'tool_call_update' });
        break;
      }
      case 'available_commands_update': {
        if (Array.isArray((update as any).availableCommands)) {
          this._availableCommands = [...(update as any).availableCommands];
        }
        break;
      }
      case 'plan': {
        this.updatePlanEntry(update);
        break;
      }
      case 'usage_update': {
        this._usage = this.omitSessionUpdate(update);
        break;
      }
      case 'current_mode_update': {
        this._currentModeId = (update as any).currentModeId;
        break;
      }
      case 'config_option_update': {
        if (Array.isArray((update as any).configOptions)) {
          this._configOptions = [...(update as any).configOptions];
        }
        break;
      }
      case 'session_info_update': {
        this._sessionInfo = {
          ...(this._sessionInfo || {}),
          ...(this.omitSessionUpdate(update) as AcpSessionInfoState),
        };
        break;
      }
      default:
        this.logger?.debug(
          `[AcpThread:${this.threadId}] Unknown session update: ${
            (update as { sessionUpdate?: unknown }).sessionUpdate
          }`,
        );
    }
  }

  private isCurrentSessionNotification(params: SessionNotification): boolean {
    if (!params.sessionId || !this._sessionId || params.sessionId === this._sessionId) {
      return true;
    }

    this.logger?.warn(
      `[AcpThread:${this.threadId}] Ignoring session notification for ${params.sessionId}; current session is ${this._sessionId}`,
    );
    return false;
  }

  private consumeLocalUserMessageEcho(notification: SessionNotification): boolean {
    const pending = this._pendingLocalUserMessageEcho;
    if (!pending) {
      return false;
    }

    const update = notification.update as any;
    if (update?.sessionUpdate === 'user_message_chunk') {
      const content = this.extractTextContent(update.content);
      if (!content) {
        return false;
      }
      const remaining = pending.content.slice(pending.matchedLength);
      if (!remaining.startsWith(content)) {
        this._pendingLocalUserMessageEcho = undefined;
        return false;
      }
      pending.matchedLength += content.length;
      if (pending.matchedLength === pending.content.length) {
        this._pendingLocalUserMessageEcho = undefined;
      }
      return true;
    }

    if (
      update?.sessionUpdate === 'agent_message_chunk' ||
      update?.sessionUpdate === 'agent_thought_chunk' ||
      update?.sessionUpdate === 'tool_call' ||
      update?.sessionUpdate === 'plan'
    ) {
      this._pendingLocalUserMessageEcho = undefined;
    }
    return false;
  }

  private mergeUserMessageChunk(update: any): void {
    const content = this.extractTextContent(update.content);
    if (!content) {
      return;
    }

    // Try to merge into last user message (user messages may arrive in chunks)
    const lastEntry = this._entries[this._entries.length - 1];
    if (lastEntry && lastEntry.type === 'user_message') {
      (lastEntry.data as UserMessageEntry).content += content;
      this.fireEntryUpdated(lastEntry);
    } else {
      // Create new entry
      const entry: UserMessageEntry = {
        id: uuid(),
        content,
        timestamp: Date.now(),
      };
      const threadEntry: AgentThreadEntry = { type: 'user_message', data: entry };
      this._entries.push(threadEntry);
      this.fireEntryAdded(threadEntry);
    }
  }

  private mergeAssistantMessageChunk(update: any): void {
    const content = this.extractTextContent(update.content);
    const thought =
      update.sessionUpdate === 'agent_thought_chunk' ? this.extractTextContent(update.content) : undefined;

    // Find last incomplete assistant message
    let lastAssistant: AssistantMessageEntry | undefined;
    for (let i = this._entries.length - 1; i >= 0; i--) {
      const e = this._entries[i];
      if (e.type === 'assistant_message' && !e.data.isComplete) {
        lastAssistant = e.data;
        break;
      }
    }

    if (lastAssistant) {
      // Append to existing message
      if (content) {
        const existingTextBlock = lastAssistant.chunks.find(
          (c): c is Extract<ContentBlock, { type: 'text' }> => c.type === 'text',
        );
        if (existingTextBlock) {
          existingTextBlock.text += content;
        } else {
          lastAssistant.chunks.push({ type: 'text', text: content });
        }
      }
      if (thought) {
        // Append thought as a separate text chunk or track separately
        lastAssistant.chunks.push({ type: 'text', text: thought, _role: 'assistant' } as any);
      }
      // Find the thread entry to fire updated event
      for (let i = this._entries.length - 1; i >= 0; i--) {
        const e = this._entries[i];
        if (e.type === 'assistant_message' && e.data === lastAssistant) {
          this.fireEntryUpdated(e);
          break;
        }
      }
    } else {
      // Create new entry
      const chunks: ContentBlock[] = [];
      if (content) {
        chunks.push({ type: 'text', text: content });
      }
      if (thought) {
        chunks.push({ type: 'text', text: thought, _role: 'assistant' } as any);
      }
      const entry: AssistantMessageEntry = {
        chunks,
        isComplete: false,
      };
      const threadEntry: AgentThreadEntry = { type: 'assistant_message', data: entry };
      this._entries.push(threadEntry);
      this.fireEntryAdded(threadEntry);
    }
  }

  private createToolCallEntry(update: any): void {
    // Build SDK ToolCall from update
    const toolCall: ToolCall = {
      toolCallId: update.toolCallId,
      title: update.toolName || update.title || update.toolCallId,
      kind: update.kind,
      rawInput: update.rawInput,
      status: 'pending',
    };

    const entry: ToolCallEntry = {
      toolCall,
      status: 'pending',
    };
    const threadEntry: AgentThreadEntry = { type: 'tool_call', data: entry };
    this._entries.push(threadEntry);
    this.fireEntryAdded(threadEntry);

    // Transition thread to working if idle
    if (this._status === 'idle' || this._status === 'awaiting_prompt') {
      this.setStatus('working');
    }
  }

  private updateToolCallEntry(update: ToolCallUpdate & { sessionUpdate: 'tool_call_update' }): void {
    // Find matching tool call entry by toolCallId
    for (let i = this._entries.length - 1; i >= 0; i--) {
      const e = this._entries[i];
      if (e.type === 'tool_call' && e.data.toolCall.toolCallId === update.toolCallId) {
        const entry = e.data as ToolCallEntry;

        if (update.rawInput !== undefined) {
          entry.toolCall.rawInput = update.rawInput;
        }

        if (update.status === 'completed') {
          entry.status = 'completed';
          entry.result = update.rawOutput;
          // Also update the embedded ToolCall.status
          entry.toolCall.status = 'completed';
        } else if (update.status === 'failed') {
          entry.status = 'failed';
          entry.toolCall.status = 'failed';
        } else if (update.status === 'in_progress') {
          if (entry.status === 'pending' || entry.status === 'waiting_for_confirmation') {
            entry.status = 'in_progress';
            entry.toolCall.status = 'in_progress';
          }
        }

        this.fireEntryUpdated(e);
        break;
      }
    }
  }

  private updatePlanEntry(update: any): void {
    // Remove existing plan entries
    this._entries = this._entries.filter((e) => e.type !== 'plan');

    const plan = (update.plan || (Array.isArray(update.entries) ? { entries: update.entries } : undefined)) as
      | Plan
      | undefined;
    if (plan) {
      const threadEntry: AgentThreadEntry = { type: 'plan', data: plan };
      this._entries.push(threadEntry);
      this.fireEntryAdded(threadEntry);
    } else {
      // Fallback: extract from content field for backward compat
      const content = this.extractTextContent(update.content);
      if (content) {
        const plan: Plan = {
          entries: [{ content, status: 'pending', priority: 'medium' }],
        };
        const threadEntry: AgentThreadEntry = { type: 'plan', data: plan };
        this._entries.push(threadEntry);
        this.fireEntryAdded(threadEntry);
      }
    }
  }

  private extractTextContent(contentBlock: any): string | undefined {
    if (!contentBlock) {
      return undefined;
    }
    if (typeof contentBlock === 'string') {
      return contentBlock;
    }
    if (contentBlock.type === 'text') {
      return contentBlock.text;
    }
    if (contentBlock.text) {
      return contentBlock.text;
    }
    return undefined;
  }

  private recordSessionNotification(notification: SessionNotification): void {
    this._sessionNotifications.push(this.cloneSessionNotification(notification));
  }

  private cloneSessionNotification(notification: SessionNotification): SessionNotification {
    return this.cloneJson(notification);
  }

  private cloneJson<T>(value: T): T {
    if (value === undefined || value === null) {
      return value;
    }
    const structuredCloneFn = (globalThis as any).structuredClone;
    if (typeof structuredCloneFn === 'function') {
      return structuredCloneFn(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  private recordDebugLog(direction: AcpDebugLogDirection, chunk: Uint8Array | Buffer | string): void {
    if (direction === 'system') {
      acpDebugLogStore.record({
        direction,
        agentId: this.options.agentId,
        threadId: this.threadId,
        sessionId: this._sessionId || undefined,
        raw: typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'),
      });
      return;
    }

    if (direction === 'stderr') {
      const raw = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
      raw
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) =>
          acpDebugLogStore.record({
            direction,
            agentId: this.options.agentId,
            threadId: this.threadId,
            sessionId: this._sessionId || undefined,
            raw: line,
          }),
        );
      return;
    }

    let recorder = this._debugLogRecorders.get(direction);
    if (!recorder) {
      recorder = acpDebugLogStore.createLineRecorder({
        direction,
        agentId: this.options.agentId,
        threadId: this.threadId,
        sessionId: this._sessionId || undefined,
      });
      this._debugLogRecorders.set(direction, recorder);
    }
    recorder(chunk);
  }

  private applySessionInitialState(
    response: { modes?: any; configOptions?: unknown[] | null; models?: any } | null,
  ): void {
    if (!response) {
      return;
    }
    this.applyModeState(response.modes);
    this.applyModelState(response.models);
    if (Array.isArray(response.configOptions)) {
      this._configOptions = [...response.configOptions];
    }
  }

  private applyModeState(modes: any): void {
    if (!modes) {
      return;
    }
    if (Array.isArray(modes.availableModes)) {
      this._modes = [...modes.availableModes];
    }
    if (typeof modes.currentModeId === 'string') {
      this._currentModeId = modes.currentModeId;
    }
  }

  private applyModelState(models: any): void {
    if (!models) {
      return;
    }
    if (Array.isArray(models.availableModels)) {
      this._models = [...models.availableModels];
    }
    if (typeof models.currentModelId === 'string') {
      this._currentModelId = models.currentModelId;
    }
  }

  private omitSessionUpdate(update: unknown): Record<string, unknown> {
    const { sessionUpdate, ...rest } = (update || {}) as Record<string, unknown>;
    return rest;
  }

  private clearSessionState(): void {
    this._modes = undefined;
    this._currentModeId = undefined;
    this._models = undefined;
    this._currentModelId = undefined;
    this._configOptions = undefined;
    this._usage = undefined;
    this._sessionInfo = undefined;
    this._availableCommands = undefined;
  }

  // -----------------------------------------------------------------------
  // Internal — permission request handling
  // -----------------------------------------------------------------------
  private async handlePermissionRequest(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    const sessionId = params.sessionId || this._sessionId;
    const toolCallId = params.toolCall.toolCallId;
    const requestId = `${sessionId}:${toolCallId}`;

    return new Promise<RequestPermissionResponse>((resolve, reject) => {
      this._pendingPermissionRequests.set(requestId, {
        resolve,
        reject,
      });

      // Forward to browser via permission caller
      this.forwardPermissionRequest(params, requestId, toolCallId);
    });
  }

  private async forwardPermissionRequest(
    params: RequestPermissionRequest,
    requestId: string,
    toolCallId: string,
  ): Promise<void> {
    try {
      const sessionId = params.sessionId || this._sessionId;
      const response = await this.options.permissionRouting.routePermissionRequest(params, sessionId);
      // Resolve the pending request
      const pending = this._pendingPermissionRequests.get(requestId);
      if (pending) {
        this._pendingPermissionRequests.delete(requestId);
        pending.resolve(response);
        this.respondToToolCall(toolCallId, response.outcome.outcome !== 'cancelled');
      }
    } catch (err) {
      const pending = this._pendingPermissionRequests.get(requestId);
      if (pending) {
        pending.reject(err instanceof Error ? err : new Error(String(err)));
        this._pendingPermissionRequests.delete(requestId);
      }
    }
  }

  private resolvePendingPermissionRequestsAsCancelled(): void {
    if (this._pendingPermissionRequests.size === 0) {
      return;
    }

    const response: RequestPermissionResponse = {
      outcome: {
        outcome: 'cancelled',
      },
    };

    for (const pending of this._pendingPermissionRequests.values()) {
      pending.resolve(response);
    }
    this._pendingPermissionRequests.clear();
  }

  // -----------------------------------------------------------------------
  // Internal — helpers
  // -----------------------------------------------------------------------
  private async ensureInitialized(): Promise<void> {
    if (!this._connection) {
      throw new Error('AcpThread not initialized. Call initialize() first.');
    }
  }

  private fireEntryAdded(entry: AgentThreadEntry): void {
    this.fireEvent({ type: 'entry_added', entry } as AcpThreadEvent);
  }

  private fireEntryUpdated(entry: AgentThreadEntry): void {
    this.fireEvent({ type: 'entry_updated', entry } as AcpThreadEvent);
  }

  private fireEvent(event: AcpThreadEvent): void {
    if (this._eventEmitter) {
      this._eventEmitter.fire(event);
    }
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

  // Logger passed via factory options (AcpThread is not @Injectable)
  private get logger(): INodeLogger {
    return this.options.logger;
  }

  private get fileSystemHandler(): AcpFileSystemHandler {
    return this.options.fileSystemHandler;
  }

  private get terminalHandler(): AcpTerminalHandler {
    return this.options.terminalHandler;
  }

  private get permissionRouting(): PermissionRoutingService {
    return this.options.permissionRouting;
  }
}

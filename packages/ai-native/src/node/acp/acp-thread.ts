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
  AgentCapabilities,
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
import { AcpWebMcpCallerServiceToken } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';
import { AgentProcessConfig } from '@opensumi/ide-core-common/lib/types/ai-native/agent-types';
import { INodeLogger } from '@opensumi/ide-core-node';

import { resolveAgentSpawnConfig } from './acp-spawn-config';
import { AcpWebMcpHandler } from './acp-webmcp-handler';
import { AcpFileSystemHandler, AcpFileSystemHandlerToken } from './handlers/file-system.handler';
import { AcpTerminalHandler, AcpTerminalHandlerToken } from './handlers/terminal.handler';
import { PermissionRoutingService, PermissionRoutingServiceToken } from './permission-routing.service';

import type { AgentUpdate, SimpleToolCall } from './acp-update-types';
import type { AcpWebMcpCallerService } from './acp-webmcp-caller.service';

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
function nodeReadableToWebStream(readable: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new streamWeb.ReadableStream<Uint8Array>({
    start(controller) {
      readable.on('data', (chunk: Buffer) => {
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

function nodeWritableToWebStream(writable: NodeJS.WritableStream): WritableStream<Uint8Array> {
  return new streamWeb.WritableStream<Uint8Array>({
    write(chunk) {
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

// ---------------------------------------------------------------------------
// Thread status state machine
// ---------------------------------------------------------------------------
export type ThreadStatus = 'idle' | 'working' | 'awaiting_prompt' | 'auth_required' | 'errored' | 'disconnected';

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
  unstable_closeSession(params: CloseSessionRequest): Promise<CloseSessionResponse>;
  unstable_setSessionModel(params: SetSessionModelRequest): Promise<SetSessionModelResponse | void>;

  // State management (internal + testing)
  getEntries(): ReadonlyArray<AgentThreadEntry>;
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
  webmcpCallerService?: AcpWebMcpCallerService;
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
    const webmcpCallerService = injector.get(AcpWebMcpCallerServiceToken) as AcpWebMcpCallerService;

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
        webmcpCallerService,
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
  private _sessionId: string = '';
  private _needsReset = false;
  private _agentCapabilities: AgentCapabilities | null = null;
  private _initialized = false;

  // Process
  private _childProcess: ChildProcess | null = null;
  private _processRunning = false;

  // SDK
  private _connection: any = null; // ClientSideConnection instance
  private _connected = false;

  // WebMCP handler
  private webmcpHandler: AcpWebMcpHandler | null = null;

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

      childProcess.on('error', (err: Error) => {
        startupError = err;
        this.logger?.error(`[AcpThread:${this.threadId}] Failed to start process: ${err.message}`);
        reject(this.wrapError(err, this.options.command));
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        this.logger?.warn(`[AcpThread:${this.threadId}] Agent stderr:`, data.toString('utf8'));
      });

      childProcess.on('exit', (code: number | null, signal: string | null) => {
        this.logger?.log(`[AcpThread:${this.threadId}] Process exited: code=${code}, signal=${signal}`);
        this._processRunning = false;
        this._connected = false;
        this.setStatus('disconnected');
        this.fireEvent({ type: 'process_stopped' } as AcpThreadEvent);
      });

      setTimeout(() => {
        if (startupError) {
          return;
        }
        if (!childProcess.pid) {
          reject(new Error(`Failed to get PID for agent process: ${this.options.command}`));
          return;
        }
        this._childProcess = childProcess;
        this._processRunning = true;
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
    if (!this._childProcess || !this._childProcess.pid) {
      this._childProcess = null;
      this._processRunning = false;
      return;
    }

    const pid = this._childProcess.pid;
    (this._childProcess as any).killed = true;

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
        this._childProcess = null;
        this._processRunning = false;
        resolve();
      }, PROCESS_CONFIG.GRACEFUL_SHUTDOWN_TIMEOUT_MS);

      this._childProcess!.once('exit', () => {
        clearTimeout(timeout);
        this._childProcess = null;
        this._processRunning = false;
        resolve();
      });
    });
  }

  // -----------------------------------------------------------------------
  // SDK connection
  // -----------------------------------------------------------------------
  private async ensureSdkConnection(): Promise<void> {
    if (this._connection) {
      return;
    }

    await this.startProcess();

    const sdk = await loadSdk();
    const { ClientSideConnection, ndJsonStream } = sdk;

    const stdout = this._childProcess!.stdio[1] as NodeJS.ReadableStream;
    const stdin = this._childProcess!.stdio[0] as NodeJS.WritableStream;

    const webOutputStream = nodeWritableToWebStream(stdin);
    const webInputStream = nodeReadableToWebStream(stdout);

    const stream = ndJsonStream(webOutputStream, webInputStream);

    const clientImpl = this.createClientImpl();
    this._connection = new ClientSideConnection((_agent: any) => clientImpl, stream);

    this._connected = true;

    // Initialize WebMCP handler if caller service is available
    // Handler uses lazy initialization — group definitions are fetched on first _opensumi/* call
    const webmcpCaller = this.options.webmcpCallerService;
    if (webmcpCaller) {
      this.webmcpHandler = new AcpWebMcpHandler(webmcpCaller, this.logger);
    }
  }

  private createClientImpl(): any {
    const self = this;

    return {
      async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
        return self.handlePermissionRequest(params);
      },

      async sessionUpdate(params: SessionNotification): Promise<void> {
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

      async extMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
        self.logger?.log(
          `[AcpThread:${self.threadId}] extMethod() — method=${method}, params=${JSON.stringify(params)}`,
        );
        if (method.startsWith('_opensumi/')) {
          if (self.webmcpHandler) {
            const result = await self.webmcpHandler.handleExtMethod(method, params);
            self.logger?.log(
              `[AcpThread:${self.threadId}] extMethod() — method=${method}, result=${JSON.stringify(result)}`,
            );
            return result;
          }
          self.logger?.warn(
            `[AcpThread:${self.threadId}] extMethod() — method=${method}, WebMCP handler not available`,
          );
          throw Object.assign(new Error(`Method not found: ${method} (WebMCP not available)`), { code: -32601 });
        }
        self.logger?.warn(`[AcpThread:${self.threadId}] extMethod() — method=${method} not implemented`);
        throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
      },

      async extNotification(method: string, params: Record<string, unknown>): Promise<void> {
        self.logger?.log(
          `[AcpThread:${self.threadId}] extNotification() — method=${method}, params=${JSON.stringify(params)}`,
        );
        if (method.startsWith('_opensumi/') && self.webmcpHandler) {
          self.webmcpHandler.handleExtNotification(method, params);
          return;
        }
        self.logger?.debug(`[AcpThread:${self.threadId}] extNotification: ${method} — unhandled`, params);
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
    await this.ensureSdkConnection();

    // Eagerly initialize WebMCP handler so group definitions are available
    // for the capability metadata sent in initParams.
    if (this.webmcpHandler) {
      await this.webmcpHandler.ensureInitialized();
    }

    const initParams: InitializeRequest = {
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: true,
        },
        terminal: true,
        _meta: this.webmcpHandler?.getCapabilityMeta() ?? {},
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

    this.logger?.log(
      `[AcpThread:${this.threadId}] initialize() — initParams.clientCapabilities._meta=${JSON.stringify(
        initParams.clientCapabilities?._meta ?? {},
      )}`,
    );

    const response: InitializeResponse = await this._connection.initialize(initParams);

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

    const response: NewSessionResponse = await this._connection.newSession(request);
    this._sessionId = response.sessionId;
    this._needsReset = true;
    this.setStatus('awaiting_prompt');
    this.logger?.log(
      `[AcpThread:${this.threadId}] newSession() — sessionId=${response.sessionId}, status=awaiting_prompt`,
    );
    return response;
  }

  async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
    await this.ensureInitialized();
    this.logger?.log(`[AcpThread:${this.threadId}] loadSession() — sessionId=${params.sessionId}`);

    const response: LoadSessionResponse = await this._connection.loadSession(params);
    this._sessionId = params.sessionId;
    this._needsReset = true;
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

    const response: PromptResponse = await this._connection.prompt(params);

    // After prompt completes, transition to awaiting_prompt
    if (this._status === 'working') {
      this.setStatus('awaiting_prompt');
      this.logger?.log(
        `[AcpThread:${this.threadId}] prompt() — done, status→awaiting_prompt, entries=${this._entries.length}`,
      );
    }
    return response;
  }

  async cancel(params: CancelNotification): Promise<void> {
    this.logger?.log(`[AcpThread:${this.threadId}] cancel() — sessionId=${params.sessionId}`);
    await this.ensureInitialized();
    await this._connection.cancel(params);
    this.logger?.log(`[AcpThread:${this.threadId}] cancel() — done`);
  }

  async listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse> {
    this.logger?.log(`[AcpThread:${this.threadId}] listSessions()`);
    await this.ensureInitialized();
    return this._connection.listSessions(params || {});
  }

  async setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse | void> {
    this.logger?.log(`[AcpThread:${this.threadId}] setSessionMode() — modeId=${params.modeId}`);
    await this.ensureInitialized();
    return this._connection.setSessionMode(params);
  }

  async setSessionConfigOption(params: SetSessionConfigOptionRequest): Promise<SetSessionConfigOptionResponse> {
    this.logger?.log(`[AcpThread:${this.threadId}] setSessionConfigOption()`);
    await this.ensureInitialized();
    return this._connection.setSessionConfigOption(params);
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

  async unstable_closeSession(params: CloseSessionRequest): Promise<CloseSessionResponse> {
    this.logger?.log(`[AcpThread:${this.threadId}] unstable_closeSession()`);
    await this.ensureInitialized();
    return this._connection.unstable_closeSession(params);
  }

  async unstable_setSessionModel(params: SetSessionModelRequest): Promise<SetSessionModelResponse | void> {
    this.logger?.log(`[AcpThread:${this.threadId}] unstable_setSessionModel()`);
    await this.ensureInitialized();
    return this._connection.unstable_setSessionModel(params);
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
    this._sessionId = '';
    this._needsReset = false;
    // NOTE: Do NOT clear _initialized — thread remains initialized and reusable
    this._pendingPermissionRequests.clear();
    this.setStatus('idle');
  }

  async dispose(): Promise<void> {
    this.logger?.log(
      `[AcpThread:${this.threadId}] dispose() — status=${this._status}, entries=${this._entries.length}`,
    );
    this._eventEmitter.dispose();
    await this.killProcess();
    this._connection = null;
    this._connected = false;
    this._pendingPermissionRequests.clear();
    super.dispose();
  }

  // -----------------------------------------------------------------------
  // Public — notification handling (spec: must be public)
  // -----------------------------------------------------------------------
  handleNotification(params: SessionNotification): void {
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
        // No entry change needed, just emit event (already done by sessionUpdate)
        break;
      }
      case 'plan': {
        this.updatePlanEntry(update);
        break;
      }
      case 'usage_update':
      case 'current_mode_update':
      case 'config_option_update':
      case 'session_info_update': {
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

  // -----------------------------------------------------------------------
  // Notification → AgentUpdate translation
  // -----------------------------------------------------------------------

  /**
   * Translate a SessionNotification into the legacy AgentUpdate format
   * for stream consumption by AcpAgentService.
   */
  toAgentUpdate(notification: SessionNotification): AgentUpdate | AgentUpdate[] | null {
    const update = (notification as any).update;
    if (!update) {
      return null;
    }

    switch (update.sessionUpdate) {
      case 'agent_thought_chunk': {
        const content = update.content;
        if (content?.type === 'text') {
          return { type: 'thought', content: content.text };
        }
        return null;
      }

      case 'agent_message_chunk': {
        const content = update.content;
        if (content?.type === 'text') {
          return { type: 'message', content: content.text };
        }
        return null;
      }

      case 'tool_call': {
        return {
          type: 'tool_call',
          content: update.title || update.toolCallId || '',
          toolCall: {
            toolCallId: update.toolCallId || '',
            name: update.title || update.toolCallId || '',
            input: update.rawInput !== undefined ? update.rawInput : {},
            status: 'pending' as const,
          },
        };
      }

      case 'tool_call_update': {
        const updates: AgentUpdate[] = [];
        if (update.rawInput !== undefined) {
          updates.push({
            type: 'tool_call_args',
            content: '',
            toolCall: {
              toolCallId: update.toolCallId || '',
              name: update.title || '',
              input: update.rawInput,
            },
          });
        }
        if (update.status === 'completed' || update.status === 'failed') {
          if (update.rawOutput != null) {
            const outputText =
              typeof update.rawOutput === 'string' ? update.rawOutput : JSON.stringify(update.rawOutput);
            updates.push({
              type: 'tool_result',
              content: outputText.slice(0, 2000),
              toolCall: {
                toolCallId: update.toolCallId || '',
                name: '',
                status: update.status as 'completed' | 'failed',
              },
            });
          }
          return updates.length ? updates : null;
        }
        if (update.status === 'in_progress') {
          updates.push({
            type: 'tool_call_status',
            content: update.title || '',
            toolCall: {
              toolCallId: update.toolCallId || '',
              name: update.title || '',
              status: 'in_progress' as const,
            },
          });
          return updates;
        }
        // Emit diff content if present
        if (update.content) {
          for (const item of update.content) {
            if (item.type === 'diff') {
              updates.push({
                type: 'tool_result',
                content: `Modified ${item.path}`,
              });
              break;
            }
          }
        }
        return updates.length ? updates : null;
      }

      case 'plan': {
        const plan = update.plan;
        if (plan?.entries?.length) {
          const planText = plan.entries
            .map((e: { content: string; completed?: boolean; status?: string }) =>
              e.completed ? `- [x] ${e.content}` : `- [ ] ${e.content}`,
            )
            .join('\n');
          return { type: 'plan', content: planText };
        }
        return null;
      }

      default:
        return null;
    }
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

    const plan = update.plan as Plan;
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

  // -----------------------------------------------------------------------
  // Internal — permission request handling
  // -----------------------------------------------------------------------
  private async handlePermissionRequest(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    const sessionId = params.sessionId || this._sessionId;
    const requestId = `${sessionId}:${params.toolCall.toolCallId}`;

    return new Promise<RequestPermissionResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pendingPermissionRequests.delete(requestId);
        resolve({
          outcome: {
            outcome: 'cancelled',
          },
        });
      }, 60000); // 60s timeout

      this._pendingPermissionRequests.set(requestId, {
        resolve: (resp) => {
          clearTimeout(timeout);
          resolve(resp);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });

      // Forward to browser via permission caller
      this.forwardPermissionRequest(params, requestId);
    });
  }

  private async forwardPermissionRequest(params: RequestPermissionRequest, requestId: string): Promise<void> {
    try {
      const sessionId = params.sessionId || this._sessionId;
      const response = await this.options.permissionRouting.routePermissionRequest(params, sessionId);
      // Resolve the pending request
      const pending = this._pendingPermissionRequests.get(requestId);
      if (pending) {
        pending.resolve(response);
      }
      this.respondToToolCall(requestId, response.outcome.outcome !== 'cancelled');
    } catch (err) {
      const pending = this._pendingPermissionRequests.get(requestId);
      if (pending) {
        pending.reject(err instanceof Error ? err : new Error(String(err)));
        this._pendingPermissionRequests.delete(requestId);
      }
    }
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

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

import { Autowired, Injectable } from '@opensumi/di';
import { Deferred, Disposable, Emitter, Event, ILogger, URI, uuid } from '@opensumi/ide-core-common';
import {
  AgentCapabilities,
  CancelNotification,
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
  PromptRequest,
  PromptResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
  ToolCallUpdate,
  WriteTextFileRequest,
  WriteTextFileResponse,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';
import { INodeLogger } from '@opensumi/ide-core-node';

import { AcpPermissionCallerManager } from './acp-permission-caller.service';
import { AcpFileSystemHandler } from './handlers/file-system.handler';
import { AcpTerminalHandler } from './handlers/terminal.handler';

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
          if (err) {reject(err);}
          else {resolve();}
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
// Entry types
// ---------------------------------------------------------------------------
export interface UserMessageEntry {
  type: 'user_message';
  id: string;
  content: string;
  timestamp: number;
}

export interface AssistantMessageEntry {
  type: 'assistant_message';
  id: string;
  content: string;
  thought?: string;
  timestamp: number;
  completed: boolean;
}

export interface ToolCallEntry {
  type: 'tool_call';
  id: string;
  toolCallId: string;
  toolName: string;
  input?: string;
  status: ToolCallStatus;
  result?: string;
  timestamp: number;
}

export interface PlanEntry {
  type: 'plan';
  id: string;
  content: string;
  timestamp: number;
}

export type AgentThreadEntry = UserMessageEntry | AssistantMessageEntry | ToolCallEntry | PlanEntry;

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------
export interface AcpThreadEvent {
  type: 'entries_changed' | 'status_changed' | 'session_notification' | 'process_started' | 'process_stopped' | 'error';
  threadId: string;
  entries?: AgentThreadEntry[];
  status?: ThreadStatus;
  notification?: SessionNotification;
  error?: Error;
}

// ---------------------------------------------------------------------------
// DI Token and Interface
// ---------------------------------------------------------------------------
export const AcpThreadToken = Symbol('AcpThreadToken');

export interface IAcpThread {
  /** Unique thread identifier */
  readonly threadId: string;

  /** Current thread status */
  readonly status: ThreadStatus;

  /** Ordered list of thread entries */
  readonly entries: AgentThreadEntry[];

  /** Whether the agent process is running */
  readonly isProcessRunning: boolean;

  /** Whether the SDK connection is established */
  readonly isConnected: boolean;

  /** Current session ID (if bound) */
  readonly sessionId: string | undefined;

  /** Whether the thread was bound to a session and needs reset() before reuse */
  readonly needsReset: boolean;

  /** Agent capabilities from initialize */
  readonly agentCapabilities: AgentCapabilities | null;

  /** Event emitter for thread events */
  readonly onEvent: Event<AcpThreadEvent>;

  // Process lifecycle
  initialize(): Promise<InitializeResponse>;
  newSession(params?: Omit<NewSessionRequest, 'sessionId'>): Promise<NewSessionResponse>;
  loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse>;
  loadSessionOrNew(params: LoadSessionRequest): Promise<NewSessionResponse | LoadSessionResponse>;
  prompt(params: PromptRequest): Promise<PromptResponse>;
  cancel(params: CancelNotification): Promise<void>;
  listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse>;

  // Entry manipulation
  addUserMessage(content: string): UserMessageEntry;
  markAssistantComplete(entryId: string, content: string): void;

  // Tool call state
  markToolCallWaiting(toolCallId: string): void;
  respondToToolCall(toolCallId: string, response: RequestPermissionResponse): void;

  // Lifecycle
  reset(): void;
  dispose(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Constructor options
// ---------------------------------------------------------------------------
export interface AcpThreadOptions {
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd: string;
  fileSystemHandler: AcpFileSystemHandler;
  terminalHandler: AcpTerminalHandler;
  permissionCaller: AcpPermissionCallerManager;
}

// ---------------------------------------------------------------------------
// AcpThread Implementation
// ---------------------------------------------------------------------------
export class AcpThread extends Disposable implements IAcpThread {
  readonly threadId: string = uuid();

  // State
  private _status: ThreadStatus = 'idle';
  private _entries: AgentThreadEntry[] = [];
  private _sessionId: string | undefined;
  private _needsReset = false;
  private _agentCapabilities: AgentCapabilities | null = null;
  private _initialized = false;

  // Process
  private _childProcess: ChildProcess | null = null;
  private _processRunning = false;

  // SDK
  private _connection: any = null; // ClientSideConnection instance
  private _connected = false;

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

  get entries(): AgentThreadEntry[] {
    return this._entries;
  }

  get isProcessRunning(): boolean {
    return this._processRunning;
  }

  get isConnected(): boolean {
    return this._connected;
  }

  get sessionId(): string | undefined {
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
  // Process lifecycle
  // -----------------------------------------------------------------------
  private async startProcess(): Promise<void> {
    if (this._childProcess && this.isProcessAlive()) {
      return;
    }

    // Clean up stale process reference
    this._childProcess = null;
    this._processRunning = false;

    const agentPath = process.env.SUMI_ACP_AGENT_PATH || this.options.command;
    const nodePath = process.env.SUMI_ACP_NODE_PATH || this.options.command;
    const nodeBinDir = nodePath.substring(0, nodePath.lastIndexOf('/'));

    const newEnv = {
      ...process.env,
      ...this.options.env,
      NODE: `${nodeBinDir}/node`,
      PATH: `${nodeBinDir}:${process.env.PATH || ''}`,
    };

    return new Promise<void>((resolve, reject) => {
      let startupError: Error | null = null;

      const childProcess = spawn(agentPath, this.options.args, {
        cwd: this.options.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
        shell: false,
        env: newEnv,
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
      });

      setTimeout(() => {
        if (startupError) {return;}
        if (!childProcess.pid) {
          reject(new Error(`Failed to get PID for agent process: ${this.options.command}`));
          return;
        }
        this._childProcess = childProcess;
        this._processRunning = true;
        this.fireEvent({ type: 'process_started', threadId: this.threadId });
        resolve();
      }, PROCESS_CONFIG.STARTUP_TIMEOUT_MS);
    });
  }

  private isProcessAlive(): boolean {
    if (!this._childProcess) {return false;}
    if (this._childProcess.killed || this._childProcess.exitCode !== null) {return false;}
    if (!this._childProcess.pid) {return false;}
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
    if (this._connection) {return;}

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
          threadId: self.threadId,
          notification: params,
        });
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
        const result = await self.options.terminalHandler.getTerminalOutput({
          sessionId: params.sessionId,
          terminalId: params.terminalId,
        });
        return {
          output: result.output || '',
          truncated: result.truncated || false,
          exitStatus: result.exitStatus ?? null,
        };
      },

      async waitForTerminalExit(params: any): Promise<any> {
        const result = await self.options.terminalHandler.waitForTerminalExit({
          sessionId: params.sessionId,
          terminalId: params.terminalId,
          timeout: params.timeout,
        });
        return {
          exitCode: result.exitCode ?? null,
          exitStatus: result.exitStatus ?? null,
        };
      },

      async killTerminal(params: any): Promise<any> {
        const result = await self.options.terminalHandler.killTerminal({
          sessionId: params.sessionId,
          terminalId: params.terminalId,
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
        return { exitCode: result.exitCode };
      },

      async releaseTerminal(params: any): Promise<any> {
        const result = await self.options.terminalHandler.releaseTerminal({
          sessionId: params.sessionId,
          terminalId: params.terminalId,
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
      },

      async extMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
        self.logger?.warn(`[AcpThread:${self.threadId}] extMethod called: ${method} — not implemented`);
        return {};
      },

      async extNotification(method: string, params: Record<string, unknown>): Promise<void> {
        self.logger?.debug(`[AcpThread:${self.threadId}] extNotification: ${method}`, params);
      },
    };
  }

  // -----------------------------------------------------------------------
  // Public API — initialize
  // -----------------------------------------------------------------------
  async initialize(params?: InitializeRequest): Promise<InitializeResponse> {
    await this.ensureSdkConnection();

    const initParams: InitializeRequest = params || {
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

    initParams.protocolVersion = initParams.protocolVersion || ACP_PROTOCOL_VERSION;

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
    return response;
  }

  // -----------------------------------------------------------------------
  // Public API — session management
  // -----------------------------------------------------------------------
  async newSession(params?: Omit<NewSessionRequest, 'sessionId'>): Promise<NewSessionResponse> {
    await this.ensureInitialized();

    const request: NewSessionRequest = {
      ...(params || {}),
    } as NewSessionRequest;

    const response: NewSessionResponse = await this._connection.newSession(request);
    this._sessionId = response.sessionId;
    this._needsReset = true;
    this.setStatus('awaiting_prompt');
    return response;
  }

  async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
    await this.ensureInitialized();

    const response: LoadSessionResponse = await this._connection.loadSession(params);
    this._sessionId = params.sessionId;
    this._needsReset = true;
    this.setStatus('awaiting_prompt');
    return response;
  }

  async loadSessionOrNew(params: LoadSessionRequest): Promise<NewSessionResponse | LoadSessionResponse> {
    await this.ensureInitialized();

    // Try loading first; fall back to new session
    try {
      return await this.loadSession(params);
    } catch {
      // Session doesn't exist, create a new one
      return await this.newSession();
    }
  }

  async prompt(params: PromptRequest): Promise<PromptResponse> {
    await this.ensureInitialized();
    this.setStatus('working');

    const response: PromptResponse = await this._connection.prompt(params);

    // After prompt completes, transition to awaiting_prompt
    if (this._status === 'working') {
      this.setStatus('awaiting_prompt');
    }
    return response;
  }

  async cancel(params: CancelNotification): Promise<void> {
    if (!this._connection) {return;}
    await this._connection.cancel(params);
  }

  async listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse> {
    await this.ensureInitialized();
    return this._connection.listSessions(params || {});
  }

  // -----------------------------------------------------------------------
  // Entry manipulation
  // -----------------------------------------------------------------------
  addUserMessage(content: string): UserMessageEntry {
    const entry: UserMessageEntry = {
      type: 'user_message',
      id: uuid(),
      content,
      timestamp: Date.now(),
    };
    this._entries.push(entry);
    this.fireEntriesChanged();
    return entry;
  }

  markAssistantComplete(entryId: string, content: string): void {
    const entry = this._entries.find(
      (e): e is AssistantMessageEntry => e.type === 'assistant_message' && e.id === entryId,
    );
    if (entry) {
      entry.content = content;
      entry.completed = true;
      this.fireEntriesChanged();
    }
  }

  // -----------------------------------------------------------------------
  // Tool call state management
  // -----------------------------------------------------------------------
  markToolCallWaiting(toolCallId: string): void {
    const entry = this._entries.find((e): e is ToolCallEntry => e.type === 'tool_call' && e.toolCallId === toolCallId);
    if (entry) {
      entry.status = 'waiting_for_confirmation';
      this.fireEntriesChanged();
    }
  }

  respondToToolCall(toolCallId: string, response: RequestPermissionResponse): void {
    const pending = this._pendingPermissionRequests.get(toolCallId);
    if (pending) {
      pending.resolve(response);
      this._pendingPermissionRequests.delete(toolCallId);
    }
  }

  // -----------------------------------------------------------------------
  // Reset and dispose
  // -----------------------------------------------------------------------
  reset(): void {
    this._entries = [];
    this._sessionId = undefined;
    this._needsReset = false;
    this._initialized = false;
    this._pendingPermissionRequests.clear();
    this.setStatus('idle');
  }

  async dispose(): Promise<void> {
    this._eventEmitter.dispose();
    await this.killProcess();
    this._connection = null;
    this._connected = false;
    this._pendingPermissionRequests.clear();
    super.dispose();
  }

  // -----------------------------------------------------------------------
  // Internal — notification handling
  // -----------------------------------------------------------------------
  private handleNotification(params: SessionNotification): void {
    const update = params.update;
    if (!update) {return;}

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
      default:
        this.logger?.debug(`[AcpThread:${this.threadId}] Unknown session update: ${update.sessionUpdate}`);
    }
  }

  private mergeUserMessageChunk(update: any): void {
    const content = this.extractTextContent(update.content);
    if (!content) {return;}

    // Try to merge into last user message (user messages may arrive in chunks)
    const lastEntry = this._entries[this._entries.length - 1];
    if (lastEntry && lastEntry.type === 'user_message') {
      (lastEntry as UserMessageEntry).content += content;
      this.fireEntriesChanged();
    } else {
      // Create new entry
      const entry: UserMessageEntry = {
        type: 'user_message',
        id: uuid(),
        content,
        timestamp: Date.now(),
      };
      this._entries.push(entry);
      this.fireEntriesChanged();
    }
  }

  private isUserMessageComplete(_entry: UserMessageEntry): boolean {
    // User messages may arrive in multiple chunks — only consider complete
    // when we receive an explicit completion signal (not yet implemented)
    return false;
  }

  private mergeAssistantMessageChunk(update: any): void {
    const content = this.extractTextContent(update.content);
    const thought =
      update.sessionUpdate === 'agent_thought_chunk' ? this.extractTextContent(update.content) : undefined;

    // Find last incomplete assistant message
    let lastAssistant: AssistantMessageEntry | undefined;
    for (let i = this._entries.length - 1; i >= 0; i--) {
      const e = this._entries[i];
      if (e.type === 'assistant_message' && !e.completed) {
        lastAssistant = e;
        break;
      }
    }

    if (lastAssistant) {
      // Append to existing message
      if (content) {
        lastAssistant.content += content;
      }
      if (thought) {
        lastAssistant.thought = (lastAssistant.thought || '') + thought;
      }
      this.fireEntriesChanged();
    } else {
      // Create new entry
      const entry: AssistantMessageEntry = {
        type: 'assistant_message',
        id: uuid(),
        content: content || '',
        thought,
        timestamp: Date.now(),
        completed: false,
      };
      this._entries.push(entry);
      this.fireEntriesChanged();
    }
  }

  private createToolCallEntry(update: any): void {
    const entry: ToolCallEntry = {
      type: 'tool_call',
      id: uuid(),
      toolCallId: update.toolCallId,
      toolName: update.toolName,
      input: update.input ? JSON.stringify(update.input) : undefined,
      status: 'pending',
      timestamp: Date.now(),
    };
    this._entries.push(entry);
    this.fireEntriesChanged();

    // Transition thread to working if idle
    if (this._status === 'idle' || this._status === 'awaiting_prompt') {
      this.setStatus('working');
    }
  }

  private updateToolCallEntry(update: ToolCallUpdate & { sessionUpdate: 'tool_call_update' }): void {
    // Find matching tool call entry by toolCallId
    for (let i = this._entries.length - 1; i >= 0; i--) {
      const e = this._entries[i];
      if (e.type === 'tool_call' && e.toolCallId === update.toolCallId) {
        const entry = e as ToolCallEntry;

        if (update.status === 'completed') {
          entry.status = 'completed';
          entry.result = update.rawOutput ? JSON.stringify(update.rawOutput) : undefined;
        } else if (update.status === 'failed') {
          entry.status = 'failed';
        } else if (update.status === 'in_progress') {
          if (entry.status === 'pending' || entry.status === 'waiting_for_confirmation') {
            entry.status = 'in_progress';
          }
        }

        this.fireEntriesChanged();
        break;
      }
    }
  }

  private updatePlanEntry(update: any): void {
    // Remove existing plan entries
    this._entries = this._entries.filter((e) => e.type !== 'plan');

    const content = this.extractTextContent(update.content);
    if (content) {
      const entry: PlanEntry = {
        type: 'plan',
        id: uuid(),
        content,
        timestamp: Date.now(),
      };
      this._entries.push(entry);
      this.fireEntriesChanged();
    }
  }

  private extractTextContent(contentBlock: any): string | undefined {
    if (!contentBlock) {return undefined;}
    if (typeof contentBlock === 'string') {return contentBlock;}
    if (contentBlock.type === 'text') {return contentBlock.text;}
    if (contentBlock.text) {return contentBlock.text;}
    return undefined;
  }

  // -----------------------------------------------------------------------
  // Internal — permission request handling
  // -----------------------------------------------------------------------
  private async handlePermissionRequest(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    const requestId = params.toolCall.toolCallId;

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
      const response = await this.options.permissionCaller.requestPermission(params);
      // Resolve the pending request
      this.respondToToolCall(requestId, response);
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

  private setStatus(status: ThreadStatus): void {
    if (this._status === status) {return;}
    this._status = status;
    this.fireEvent({ type: 'status_changed', threadId: this.threadId, status });
  }

  private fireEntriesChanged(): void {
    this.fireEvent({
      type: 'entries_changed',
      threadId: this.threadId,
      entries: this._entries,
    });
  }

  private fireEvent(event: Omit<AcpThreadEvent, 'threadId'> & { threadId: string }): void {
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

  // Logger via DI (set by factory after construction)
  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;
}

/**
 * ACP CLI 客户端服务
 *
 * 基于 NDJSON 格式（Newline Delimited JSON）的 JSON-RPC 2.0 传输层实现：
 * - 通过 Agent 子进程的 stdin/stdout 进行双向通信
 * - 发起请求（initialize / session/new / session/prompt 等）并等待匹配响应
 * - 处理 Agent 主动发起的请求（文件读写、终端操作、权限确认），路由到 AcpAgentRequestHandler
 * - 监听 session/update 通知并广播给已注册的 NotificationHandler
 * - 协商并存储协议版本、Agent 能力（capabilities）及会话模式（modes）
 */
import { Autowired, Injectable } from '@opensumi/di';
import { INodeLogger } from '@opensumi/ide-core-node';

import { AcpAgentRequestHandler } from './handlers/agent-request.handler';

import type {
  AgentCapabilities,
  AuthMethod,
  AuthenticateRequest,
  AuthenticateResponse,
  CancelNotification,
  ExtendedInitializeResponse,
  Implementation,
  InitializeRequest,
  InitializeResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
  SessionModeState,
  SessionNotification,
  SetSessionModeRequest,
  SetSessionModeResponse,
} from '../../common/acp-types';

export const ACP_PROTOCOL_VERSION = 1;

export const AcpCliClientServiceToken = Symbol('AcpCliClientServiceToken');

export interface IAcpCliClientService {
  setTransport(stdout: NodeJS.ReadableStream, stdin: NodeJS.WritableStream): void;

  initialize(params?: InitializeRequest): Promise<InitializeResponse>;
  authenticate(params: AuthenticateRequest): Promise<AuthenticateResponse>;

  newSession(params: NewSessionRequest): Promise<NewSessionResponse>;
  loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse>;
  listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse>;

  prompt(params: PromptRequest): Promise<PromptResponse>;
  cancel(params: CancelNotification): Promise<void>;
  setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse>;

  onNotification(handler: (notification: SessionNotification) => void): () => void;

  close(): Promise<void>;
  isConnected(): boolean;
  handleDisconnect(): void;

  getNegotiatedProtocolVersion(): number | null;
  getAgentCapabilities(): AgentCapabilities | null;
  getAgentInfo(): Implementation | null;
  getAuthMethods(): AuthMethod[];
  getSessionModes(): SessionModeState | null;
}

// ============================================================================
// Implementation
// ============================================================================

@Injectable()
export class AcpCliClientService implements IAcpCliClientService {
  private stdout: NodeJS.ReadableStream | null = null;
  private stdin: NodeJS.WritableStream | null = null;
  private connected = false;
  private requestId = 0;
  private buffer = '';

  // Support multiple notification handlers (subscribe/unsubscribe pattern)
  private notificationHandlers: ((notification: SessionNotification) => void)[] = [];

  // Store negotiated protocol version and capabilities
  private negotiatedProtocolVersion: number | null = null;
  private agentCapabilities: AgentCapabilities | null = null;
  private agentInfo: Implementation | null = null;
  private authMethods: AuthMethod[] = [];
  private sessionModes: SessionModeState | null = null;

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  @Autowired(AcpAgentRequestHandler)
  private agentRequestHandler: AcpAgentRequestHandler;

  /**
   * Set up the transport streams (Node.js stdin/stdout from agent process)
   * Uses NDJSON (Newline Delimited JSON) format for JSON-RPC messages
   */
  setTransport(stdout: NodeJS.ReadableStream, stdin: NodeJS.WritableStream): void {
    this.logger?.log('[ACP] Setting up transport streams');

    // 1. 立即 reject 旧的 pending requests，不等 120s 超时
    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error('Transport reset'));
    }
    this.pendingRequests.clear();

    // 2. 清理旧 stdout 监听
    if (this.stdout) {
      this.logger?.log('[ACP] Removing old stdout listeners');
      this.stdout.removeAllListeners();
    }

    // 3. 关闭旧 stdin
    if (this.stdin) {
      this.logger?.log('[ACP] Closing old stdin');
      try {
        this.stdin.end();
      } catch (_) {}
    }

    // 4. 重置协商数据
    this.negotiatedProtocolVersion = null;
    this.agentCapabilities = null;
    this.agentInfo = null;
    this.authMethods = [];
    this.sessionModes = null;

    // 5. 设置引用（先设置 streams，此时 connected=false）
    this.stdout = stdout;
    this.stdin = stdin;
    this.connected = false;

    this.logger?.log('[ACP] Registering stdout listeners');

    // 6. 先注册监听器（确保在 buffer 重置之前）
    // 这样可以避免在 buffer 重置后、监听器注册前的竞态条件
    const dataHandler = (data: Buffer) => {
      this.handleData(data.toString('utf8'));
    };
    this.stdout.on('data', dataHandler);

    this.stdout.on('end', () => {
      this.logger?.error('[ACP] stdout ended - connection lost');
      this.handleDisconnect();
    });

    this.stdout.on('error', (err) => {
      this.logger?.error('[ACP] stdout error - connection lost:', err);
      this.handleDisconnect();
    });

    // 7. 最后重置 buffer（确保监听器已经注册）
    this.buffer = '';

    this.connected = true;
    this.logger?.log('[ACP] Transport setup complete, connected=true');
  }

  // -- Phase 1: Initialization --

  /**
   * Initialize the ACP connection with the Agent.
   * Negotiates protocol version, capabilities, and authentication methods.
   *
   * @param params - Optional initialization parameters. If not provided,
   *                 uses default client capabilities and info.
   * @returns InitializeResponse from the Agent with protocol version and capabilities
   * @throws Error if protocol version negotiation fails
   */
  async initialize(params?: InitializeRequest): Promise<ExtendedInitializeResponse> {
    if (!this.stdin || !this.stdout) {
      throw new Error('Transport not set up');
    }

    // Build default initialization params if not provided
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

    // Ensure protocol version is always set
    initParams.protocolVersion = initParams.protocolVersion || ACP_PROTOCOL_VERSION;

    // this.logger?.log('[ACP] Sending initialize request with protocol version:', initParams.protocolVersion);

    const response = await this.sendRequest<ExtendedInitializeResponse>('initialize', initParams);

    // Validate protocol version negotiation
    if (response.protocolVersion !== initParams.protocolVersion) {
      this.logger?.warn(
        `Agent responded with different protocol version: ${response.protocolVersion}. ` +
          `Client requested: ${initParams.protocolVersion}`,
      );

      // According to ACP spec: If Client does not support the version specified by Agent,
      // Client SHOULD close the connection and inform the user
      // For now, we accept the Agent's version if it's lower than requested
      // but warn if it's higher (unsupported)
      if (response.protocolVersion > ACP_PROTOCOL_VERSION) {
        await this.close();
        throw new Error(
          'Unsupported protocol version: ' +
            response.protocolVersion +
            '. ' +
            'This client supports up to version ' +
            ACP_PROTOCOL_VERSION +
            '. ' +
            'Please update the client to use the latest version.',
        );
      }
    }

    // Store negotiated protocol version
    this.negotiatedProtocolVersion = response.protocolVersion;

    // Store agent capabilities
    if (response.agentCapabilities) {
      this.agentCapabilities = response.agentCapabilities;
      // this.logger?.log('[ACP] Agent capabilities:', JSON.stringify(response.agentCapabilities, null, 2));
    }

    // Store agent info
    if (response.agentInfo) {
      this.agentInfo = response.agentInfo;
      // this.logger?.log(
      // `[ACP] Connected to Agent: ${response.agentInfo.title || response.agentInfo.name} ` +
      //   `v${response.agentInfo.version}`,
      // );
    }

    // Store auth methods
    if (response.authMethods && response.authMethods.length > 0) {
      this.authMethods = response.authMethods;
      // this.logger?.log('[ACP] Agent requires authentication with methods:', response.authMethods);
    }

    // Store session modes
    if (response.modes) {
      this.sessionModes = response.modes;
      // this.logger?.log(
      // `[ACP] Agent session modes: current=${response.modes.currentModeId}, ` +
      //   `available=${(response.modes.availableModes || []).map(((m: any) => m.id)).join(', ')}`,
      // );
    }

    // this.logger?.log('[ACP] ACP connection initialized successfully');
    return response;
  }

  async authenticate(params: AuthenticateRequest): Promise<AuthenticateResponse> {
    return this.sendRequest<AuthenticateResponse>('authenticate', params);
  }

  async newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
    return this.sendRequest<NewSessionResponse>('session/new', params);
  }

  async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
    return this.sendRequest<LoadSessionResponse>('session/load', params);
  }

  async listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse> {
    return this.sendRequest<ListSessionsResponse>('session/list', params);
  }

  async prompt(params: PromptRequest): Promise<PromptResponse> {
    return this.sendRequest<PromptResponse>('session/prompt', params);
  }

  async cancel(params: CancelNotification): Promise<void> {
    // cancel is a notification (no id, no response expected)
    this.sendNotification('session/cancel', params);
  }

  async setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse> {
    return this.sendRequest<SetSessionModeResponse>('session/set_mode', params);
  }

  /**
   * Register a notification handler for session/update notifications.
   * @param handler - The notification handler function
   * @returns A function to unsubscribe the handler
   */
  onNotification(handler: (notification: SessionNotification) => void): () => void {
    this.notificationHandlers.push(handler);
    // Return unsubscribe function
    return () => {
      const index = this.notificationHandlers.indexOf(handler);
      if (index > -1) {
        this.notificationHandlers.splice(index, 1);
      }
    };
  }

  // -- Lifecycle --

  async close(): Promise<void> {
    this.connected = false;

    // Clear negotiated capabilities
    this.negotiatedProtocolVersion = null;
    this.agentCapabilities = null;
    this.agentInfo = null;
    this.authMethods = [];
    this.sessionModes = null;

    // Clear all notification handlers
    this.notificationHandlers = [];

    // Clean up streams
    if (this.stdout) {
      this.stdout.removeAllListeners();
    }

    this.stdout = null;
    this.stdin = null;
    this.buffer = '';

    // this.logger?.log('[ACP] ACP connection closed');
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ========================================================================
  // Private: Request/Response handling using NDJSON
  // ========================================================================

  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();

  // Default timeout for requests (120 seconds for agent operations)
  // session/new can take a while as the Agent needs to initialize the session
  private requestTimeoutMs = 120000; // 120 seconds

  /**
   * Send a JSON-RPC request and wait for a matching response by id.
   * Uses NDJSON format (newline-delimited JSON)
   */
  private async sendRequest<T>(method: string, params: unknown): Promise<T> {
    if (!this.stdin) {
      throw new Error('Not connected');
    }

    const id = ++this.requestId;

    this.logger?.log(`[ACP] Sending request: ${method}  (id=${id}) ${JSON.stringify(params)}`);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      // Send JSON-RPC request as NDJSON line
      const message = { jsonrpc: '2.0', id, method, params };
      const json = JSON.stringify(message);

      this.stdin!.write(json + '\n');
      this.logger?.debug(`[ACP] Sent JSON: ${json.substring(0, 200)}`);
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected).
   */
  private sendNotification(method: string, params?: unknown): void {
    if (!this.stdin) {
      throw new Error('Not connected');
    }

    // this.logger?.log(`[ACP] Sending notification: ${method}`);
    const message = { jsonrpc: '2.0', method, params };
    const json = JSON.stringify(message);

    this.stdin.write(json + '\n');
  }

  /**
   * Handle incoming data from stdout
   */
  private handleData(dataStr: string): void {
    // 调试日志：记录接收到的原始数据
    this.logger?.log(`[ACP] Received raw data (${dataStr.length} bytes): `, dataStr.substring(0, 500));

    this.buffer += dataStr;

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        continue;
      }

      // Parse single JSON object per line (NDJSON format)
      // Reference: qwen-code uses simple JSON.parse per line
      try {
        const message = JSON.parse(trimmedLine);
        this.logger?.debug('[ACP] Parsed message:', JSON.stringify(message).substring(0, 200));
        this.handleMessage(message);
      } catch (error) {
        this.logger?.error('Failed to parse ACP JSON-RPC message:', {
          line: trimmedLine,
          error,
        });
      }
    }
  }

  /**
   * Route an incoming message to the correct handler:
   *   1. Response -> match pending request
   *   2. Request -> Agent->Client request (file ops, terminal, permission)
   *   3. Notification -> Agent->Client notification (session/update)
   */
  private handleMessage(message: any): void {
    if ('id' in message && ('result' in message || 'error' in message)) {
      // 响应前端的request
      this.handleResponse(message);
    } else if ('id' in message && 'method' in message) {
      // 调用处理agent传入的request，比如读文件之类的操作
      this.handleIncomingRequest(message);
    } else if ('method' in message && !('id' in message)) {
      // 3. Notification (Agent->Client): session/update
      this.handleIncomingNotification(message);
    } else {
      throw new Error(`无法处理的 Invalid ACP JSON-RPC message: ${JSON.stringify(message)}`);
    }
  }

  /**
   * Match a JSON-RPC response to its pending request by id.
   */
  private handleResponse(response: {
    jsonrpc: '2.0';
    id: string | number;
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
  }): void {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      this.logger?.log(`[ACP] Matching response to request id=${response.id}`);
      this.pendingRequests.delete(response.id);

      if (response.error) {
        this.logger?.error(`[ACP] Request id=${response.id} failed:`, response.error);
        pending.reject(this.createError(response.error));
      } else {
        this.logger?.log(`[ACP] Request id=${response.id} succeeded`);
        pending.resolve(response.result);
      }
    } else {
      this.logger?.warn(
        `Response received for unknown request id: ${response.id}. ` + 'This may be a late arrival after timeout.',
      );
    }
  }

  /**
   * Handle an incoming request from Agent (Agent->Client).
   * Route to the appropriate handler and send back a response.
   */
  private async handleIncomingRequest(message: {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: unknown;
  }): Promise<void> {
    try {
      let result: unknown;
      switch (message.method) {
        case 'fs/read_text_file':
          result = await this.agentRequestHandler.handleReadTextFile(message.params as any);
          break;
        case 'fs/write_text_file':
          result = await this.agentRequestHandler.handleWriteTextFile(message.params as any);
          break;
        case 'session/request_permission':
          result = await this.agentRequestHandler.handlePermissionRequest(message.params as any);
          break;
        case 'terminal/create':
          result = await this.agentRequestHandler.handleCreateTerminal(message.params as any);
          break;
        case 'terminal/output':
          result = await this.agentRequestHandler.handleTerminalOutput(message.params as any);
          break;
        case 'terminal/wait_for_exit':
          result = await this.agentRequestHandler.handleWaitForTerminalExit(message.params as any);
          break;
        case 'terminal/kill':
          result = await this.agentRequestHandler.handleKillTerminal(message.params as any);
          break;
        case 'terminal/release':
          result = await this.agentRequestHandler.handleReleaseTerminal(message.params as any);
          break;
        default:
          this.logger?.warn(`Unknown incoming request method: ${message.method}`);
          this.sendMessage({
            jsonrpc: '2.0',
            id: message.id,
            error: { code: -32601, message: ` handleIncomingRequest Method not found: ${message.method}` },
          });
          return;
      }
      // Send back success response
      this.sendMessage({ jsonrpc: '2.0', id: message.id, result });
    } catch (err: any) {
      // Send back error response, preserving the original error code if available
      this.sendMessage({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: err.code || -32603, message: err.message || 'Internal error' + JSON.stringify(message) },
      });
    }
  }

  /**
   * Handle an incoming notification from Agent (Agent->Client).
   * Currently only handles session/update.
   */
  private handleIncomingNotification(message: { jsonrpc: '2.0'; method: string; params?: unknown }): void {
    if (message.method === 'session/update') {
      const notification = message.params as SessionNotification;
      // this.logger?.log('[ACP] Received notification: session/update', notification);

      // Handle current_mode_update notification
      if (notification.update?.sessionUpdate === 'current_mode_update' && notification.update?.currentModeId) {
        if (this.sessionModes) {
          this.sessionModes.currentModeId = notification.update.currentModeId;
          // this.logger?.log(`[ACP] Session mode updated to: ${notification.update.currentModeId}`);
        } else {
          this.logger?.warn('[ACP] Received current_mode_update but sessionModes is not initialized');
        }
      }

      // Forward notification to ALL registered handlers
      for (const handler of this.notificationHandlers) {
        handler(notification);
      }
    }
  }

  /**
   * Send a JSON-RPC message as a single NDJSON line to stdin.
   */
  private sendMessage(message: {
    jsonrpc: '2.0';
    id?: string | number;
    method?: string;
    params?: unknown;
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
  }): void {
    if (!this.stdin) {
      throw new Error('Not connected');
    }

    const json = JSON.stringify(message);

    this.stdin.write(json + '\n');
  }

  public handleDisconnect(): void {
    if (!this.connected) {
      return;
    }

    this.logger?.log('[ACP] Handling disconnect');

    this.connected = false;

    // Clear negotiated capabilities
    this.negotiatedProtocolVersion = null;
    this.agentCapabilities = null;
    this.agentInfo = null;
    this.authMethods = [];
    this.sessionModes = null;

    // Reject all pending requests
    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error('Connection lost'));
    }
    this.pendingRequests.clear();

    this.logger?.warn('[ACP] ACP connection lost');
  }

  private createError(error: { code: number; message: string; data?: unknown }): Error {
    const err = new Error(error.message);
    (err as any).code = error.code;
    if (error.data !== undefined) {
      (err as any).data = error.data;
    }
    return err;
  }

  // ========================================================================
  // Accessors for negotiated capabilities
  // ========================================================================

  /**
   * Get the negotiated protocol version from initialize.
   */
  getNegotiatedProtocolVersion(): number | null {
    return this.negotiatedProtocolVersion;
  }

  /**
   * Get the agent capabilities negotiated during initialize.
   */
  getAgentCapabilities(): AgentCapabilities | null {
    return this.agentCapabilities;
  }

  /**
   * Get the agent info (name, title, version) from initialize.
   */
  getAgentInfo(): Implementation | null {
    return this.agentInfo;
  }

  /**
   * Get the list of authentication methods supported by the agent.
   */
  getAuthMethods(): AuthMethod[] {
    return this.authMethods;
  }

  /**
   * Get the session modes information from initialize.
   */
  getSessionModes(): SessionModeState | null {
    return this.sessionModes;
  }
}

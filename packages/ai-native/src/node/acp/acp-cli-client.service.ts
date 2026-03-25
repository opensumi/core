/**
 * ACP CLI 客户端服务 - 基于 NDJSON 格式的 JSON-RPC 2.0 传输层实现
 */
import { Autowired, Injectable } from '@opensumi/di';
import {
  AgentCapabilities,
  AuthMethod,
  AuthenticateRequest,
  AuthenticateResponse,
  CancelNotification,
  ExtendedInitializeResponse,
  IAcpCliClientService,
  InitializeRequest,
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
} from '@opensumi/ide-core-common';
import { INodeLogger, Implementation } from '@opensumi/ide-core-node';

import { AcpAgentRequestHandler, AcpAgentRequestHandlerToken } from './handlers/agent-request.handler';

export const ACP_PROTOCOL_VERSION = 1;

const ACP_NOT_CONNECTED_ERROR = 'Not connected to agent process';

type TransportState = 'disconnected' | 'connecting' | 'connected';

@Injectable()
export class AcpCliClientService implements IAcpCliClientService {
  private stdout: NodeJS.ReadableStream | null = null;
  private stdin: NodeJS.WritableStream | null = null;
  private transportState: TransportState = 'disconnected';
  private requestId = 0;
  private buffer = '';

  private notificationHandlers: ((notification: SessionNotification) => void)[] = [];

  private negotiatedProtocolVersion: number | null = null;
  private agentCapabilities: AgentCapabilities | null = null;
  private agentInfo: Implementation | null = null;
  private authMethods: AuthMethod[] = [];
  private sessionModes: SessionModeState | null = null;

  private disconnectHandlers: (() => void)[] = [];

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  @Autowired(AcpAgentRequestHandlerToken)
  private agentRequestHandler: AcpAgentRequestHandler;

  /**
   * 统一的可写性检查，替代分散在各处的连接状态判断
   */
  private ensureWritable(): void {
    if (this.transportState !== 'connected' || !this.stdin) {
      throw new Error(ACP_NOT_CONNECTED_ERROR);
    }
  }

  /**
   * 订阅断开事件，供上层（如 AcpAgentService）监听并清理状态
   */
  onDisconnect(handler: () => void): () => void {
    this.disconnectHandlers.push(handler);
    return () => {
      const index = this.disconnectHandlers.indexOf(handler);
      if (index > -1) {
        this.disconnectHandlers.splice(index, 1);
      }
    };
  }

  setTransport(stdout: NodeJS.ReadableStream, stdin: NodeJS.WritableStream): void {
    this.logger?.log('[ACP] Setting up transport streams');

    // 先移除旧监听器，防止旧 stdout 的 end/error 事件触发 handleDisconnect
    if (this.stdout) {
      this.logger?.log('[ACP] Removing old stdout listeners');
      this.stdout.removeAllListeners();
    }

    if (this.stdin) {
      this.logger?.log('[ACP] Closing old stdin');
      try {
        this.stdin.end();
      } catch (_) {}
    }

    this.transportState = 'connecting';

    // 拒绝 pending 请求
    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error(ACP_NOT_CONNECTED_ERROR));
    }
    this.pendingRequests.clear();

    // 清空请求队列并拒绝所有待处理请求
    for (const request of this.requestQueue) {
      request.reject(new Error(ACP_NOT_CONNECTED_ERROR));
    }

    this.requestQueue = [];

    this.negotiatedProtocolVersion = null;
    this.agentCapabilities = null;
    this.agentInfo = null;
    this.authMethods = [];
    this.sessionModes = null;

    this.stdout = stdout;
    this.stdin = stdin;

    this.logger?.log('[ACP] Registering stdout listeners');

    this.stdout.on('data', (data: Buffer) => {
      this.handleData(data.toString('utf8'));
    });

    this.stdout.on('end', () => {
      this.logger?.error('[ACP] stdout ended - connection lost');
      this.handleDisconnect();
    });

    this.stdout.on('error', (err) => {
      this.logger?.error('[ACP] stdout error - connection lost:', err);
      this.handleDisconnect();
    });

    this.buffer = '';

    this.transportState = 'connected';
    this.logger?.log('[ACP] Transport setup complete');
  }

  async initialize(params?: InitializeRequest): Promise<ExtendedInitializeResponse> {
    this.ensureWritable();

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

    const response = await this.sendRequest<ExtendedInitializeResponse>('initialize', initParams);

    if (response.protocolVersion !== initParams.protocolVersion) {
      this.logger?.warn(
        `Agent responded with different protocol version: ${response.protocolVersion}. ` +
          `Client requested: ${initParams.protocolVersion}`,
      );

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

    this.negotiatedProtocolVersion = response.protocolVersion;

    if (response.agentCapabilities) {
      this.agentCapabilities = response.agentCapabilities;
    }

    if (response.agentInfo) {
      this.agentInfo = response.agentInfo;
    }

    if (response.authMethods && response.authMethods.length > 0) {
      this.authMethods = response.authMethods;
    }

    if (response.modes) {
      this.sessionModes = response.modes;
    }

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
    this.sendNotification('session/cancel', params);
  }

  async setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse> {
    return this.sendRequest<SetSessionModeResponse>('session/set_mode', params);
  }

  onNotification(handler: (notification: SessionNotification) => void): () => void {
    this.notificationHandlers.push(handler);
    return () => {
      const index = this.notificationHandlers.indexOf(handler);
      if (index > -1) {
        this.notificationHandlers.splice(index, 1);
      }
    };
  }

  async close(): Promise<void> {
    this.handleDisconnect();

    this.notificationHandlers = [];
    this.disconnectHandlers = [];

    if (this.stdout) {
      this.stdout.removeAllListeners();
    }

    if (this.stdin) {
      try {
        this.stdin.end();
      } catch (_) {}
    }

    this.stdout = null;
    this.stdin = null;
    this.buffer = '';
  }

  isConnected(): boolean {
    return this.transportState === 'connected';
  }

  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();

  // 请求队列，确保按顺序发送请求
  private requestQueue: Array<{
    method: string;
    params: unknown;
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = [];
  private isProcessingRequest = false;

  private async sendRequest<T>(method: string, params: unknown): Promise<T> {
    this.ensureWritable();

    return new Promise<T>((resolve, reject) => {
      // 将请求加入队列
      this.requestQueue.push({
        method,
        params,
        resolve,
        reject,
      });

      // 处理队列
      this.processRequestQueue();
    });
  }

  private processRequestQueue(): void {
    // 如果正在处理请求或队列为空，则直接返回
    if (this.isProcessingRequest || this.requestQueue.length === 0) {
      return;
    }

    // 检查连接状态
    if (this.transportState !== 'connected' || !this.stdin) {
      while (this.requestQueue.length > 0) {
        const request = this.requestQueue.shift();
        if (request) {
          request.reject(new Error(ACP_NOT_CONNECTED_ERROR));
        }
      }
      return;
    }

    this.isProcessingRequest = true;

    // 取出队列中的第一个请求
    const request = this.requestQueue.shift();

    if (!request) {
      this.isProcessingRequest = false;
      return;
    }

    const id = ++this.requestId;

    this.logger?.log(`[ACP] Sending request: ${request.method}  (id=${id}) ${JSON.stringify(request.params)}`);

    this.pendingRequests.set(id, {
      resolve: (value: unknown) => {
        this.isProcessingRequest = false;
        request.resolve(value);
        // 处理下一个请求
        this.processRequestQueue();
      },
      reject: (error: Error) => {
        this.isProcessingRequest = false;
        request.reject(error);
        // 处理下一个请求
        this.processRequestQueue();
      },
    });

    try {
      const message = { jsonrpc: '2.0', id, method: request.method, params: request.params };
      const json = JSON.stringify(message);

      // 在写入前再次检查流的状态
      if (this.transportState !== 'connected' || !this.stdin || !(this.stdin as NodeJS.WritableStream).writable) {
        this.pendingRequests.delete(id);
        this.isProcessingRequest = false;
        request.reject(new Error(ACP_NOT_CONNECTED_ERROR));
        this.processRequestQueue();
        return;
      }

      this.stdin.write(json + '\n');
      this.logger?.debug(`[ACP] Sent JSON: ${json}`);
    } catch (error) {
      // 写入失败时，handleDisconnect 会 reject 所有 pending 请求并清空队列
      this.handleDisconnect();
    }
  }

  private sendNotification(method: string, params?: unknown): void {
    if (this.transportState !== 'connected' || !this.stdin) {
      return;
    }

    const message = { jsonrpc: '2.0', method, params };
    const json = JSON.stringify(message);

    try {
      this.stdin.write(json + '\n');
    } catch (error) {
      this.logger?.warn(`[ACP] Failed to send notification: ${method}`, error);
    }
  }

  private handleData(dataStr: string): void {
    this.buffer += dataStr;

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        continue;
      }

      try {
        const message = JSON.parse(trimmedLine);
        this.logger?.debug('[ACP] Parsed message:', JSON.stringify(message).substring(0, 400));
        this.handleMessage(message);
      } catch (error) {
        this.logger?.error('Failed to parse ACP JSON-RPC message:', {
          line: trimmedLine,
          error,
        });
      }
    }
  }

  private handleMessage(message: any): void {
    if ('id' in message && ('result' in message || 'error' in message)) {
      this.handleResponse(message);
    } else if ('id' in message && 'method' in message) {
      this.handleIncomingRequest(message);
    } else if ('method' in message && !('id' in message)) {
      this.handleIncomingNotification(message);
    } else {
      this.logger?.warn(`Invalid ACP JSON-RPC message: ${JSON.stringify(message)}`);
    }
  }

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
            error: { code: -32601, message: `Method not found: ${message.method}` },
          });
          return;
      }
      this.sendMessage({ jsonrpc: '2.0', id: message.id, result });
    } catch (err: any) {
      try {
        this.sendMessage({
          jsonrpc: '2.0',
          id: message.id,
          error: { code: err.code || -32603, message: err.message || `Internal error: ${JSON.stringify(message)}` },
        });
      } catch (_) {
        this.logger?.warn(`[ACP] Failed to send error response for ${message.method}: disconnected`);
      }
    }
  }

  private handleIncomingNotification(message: { jsonrpc: '2.0'; method: string; params?: unknown }): void {
    if (message.method === 'session/update') {
      const notification = message.params as SessionNotification;

      if (notification.update?.sessionUpdate === 'current_mode_update' && notification.update?.currentModeId) {
        if (this.sessionModes) {
          this.sessionModes.currentModeId = notification.update.currentModeId;
        } else {
          this.logger?.warn('[ACP] Received current_mode_update but sessionModes is not initialized');
        }
      }

      for (const handler of [...this.notificationHandlers]) {
        handler(notification);
      }
    }
  }

  private sendMessage(message: {
    jsonrpc: '2.0';
    id?: string | number;
    method?: string;
    params?: unknown;
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
  }): void {
    this.ensureWritable();
    this.stdin!.write(JSON.stringify(message) + '\n');
  }

  public handleDisconnect(): void {
    if (this.transportState === 'disconnected') {
      return;
    }

    this.logger?.log('[ACP] Handling disconnect');

    this.transportState = 'disconnected';

    this.negotiatedProtocolVersion = null;
    this.agentCapabilities = null;
    this.agentInfo = null;
    this.authMethods = [];
    this.sessionModes = null;

    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error(ACP_NOT_CONNECTED_ERROR));
    }
    this.pendingRequests.clear();

    for (const request of this.requestQueue) {
      request.reject(new Error(ACP_NOT_CONNECTED_ERROR));
    }
    this.requestQueue = [];
    this.isProcessingRequest = false;

    // 通知上层（如 AcpAgentService）连接已断开
    for (const handler of [...this.disconnectHandlers]) {
      try {
        handler();
      } catch (e) {
        this.logger?.error('[ACP] Disconnect handler error:', e);
      }
    }

    this.logger?.warn('[ACP] Connection lost');
  }

  private createError(error: { code: number; message: string; data?: unknown }): Error {
    const err = new Error(error.message);
    (err as any).code = error.code;
    if (error.data !== undefined) {
      (err as any).data = error.data;
    }
    return err;
  }

  getNegotiatedProtocolVersion(): number | null {
    return this.negotiatedProtocolVersion;
  }

  getAgentCapabilities(): AgentCapabilities | null {
    return this.agentCapabilities;
  }

  getAgentInfo(): Implementation | null {
    return this.agentInfo;
  }

  getAuthMethods(): AuthMethod[] {
    return this.authMethods;
  }

  getSessionModes(): SessionModeState | null {
    return this.sessionModes;
  }
}

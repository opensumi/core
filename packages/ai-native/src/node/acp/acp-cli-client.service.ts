/**
 * ACP CLI 客户端服务 - 基于 NDJSON 格式的 JSON-RPC 2.0 传输层实现
 */
import { Autowired, Injectable } from '@opensumi/di';
import { IAcpCliClientService } from '@opensumi/ide-core-common';
import { INodeLogger, Implementation } from '@opensumi/ide-core-node';

import { AcpAgentRequestHandler } from './handlers/agent-request.handler';

import type {
  AgentCapabilities,
  AuthMethod,
  AuthenticateRequest,
  AuthenticateResponse,
  CancelNotification,
  ExtendedInitializeResponse,
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
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

export const ACP_PROTOCOL_VERSION = 1;

@Injectable()
export class AcpCliClientService implements IAcpCliClientService {
  private stdout: NodeJS.ReadableStream | null = null;
  private stdin: NodeJS.WritableStream | null = null;
  private connected = false;
  private requestId = 0;
  private buffer = '';

  private notificationHandlers: ((notification: SessionNotification) => void)[] = [];

  private negotiatedProtocolVersion: number | null = null;
  private agentCapabilities: AgentCapabilities | null = null;
  private agentInfo: Implementation | null = null;
  private authMethods: AuthMethod[] = [];
  private sessionModes: SessionModeState | null = null;

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  @Autowired(AcpAgentRequestHandler)
  private agentRequestHandler: AcpAgentRequestHandler;

  setTransport(stdout: NodeJS.ReadableStream, stdin: NodeJS.WritableStream): void {
    this.logger?.log('[ACP] Setting up transport streams');

    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error('Transport reset'));
    }
    this.pendingRequests.clear();

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

    this.negotiatedProtocolVersion = null;
    this.agentCapabilities = null;
    this.agentInfo = null;
    this.authMethods = [];
    this.sessionModes = null;

    this.stdout = stdout;
    this.stdin = stdin;
    this.connected = false;

    this.logger?.log('[ACP] Registering stdout listeners');

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

    this.buffer = '';

    this.connected = true;
    this.logger?.log('[ACP] Transport setup complete, connected=true');
  }

  async initialize(params?: InitializeRequest): Promise<ExtendedInitializeResponse> {
    if (!this.stdin || !this.stdout) {
      throw new Error('Transport not set up');
    }

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
    this.connected = false;

    this.negotiatedProtocolVersion = null;
    this.agentCapabilities = null;
    this.agentInfo = null;
    this.authMethods = [];
    this.sessionModes = null;

    this.notificationHandlers = [];

    if (this.stdout) {
      this.stdout.removeAllListeners();
    }

    this.stdout = null;
    this.stdin = null;
    this.buffer = '';
  }

  isConnected(): boolean {
    return this.connected;
  }

  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();

  private requestTimeoutMs = 120000;

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

      const message = { jsonrpc: '2.0', id, method, params };
      const json = JSON.stringify(message);

      this.stdin!.write(json + '\n');
      this.logger?.debug(`[ACP] Sent JSON: ${json.substring(0, 200)}`);
    });
  }

  private sendNotification(method: string, params?: unknown): void {
    if (!this.stdin) {
      throw new Error('Not connected');
    }

    const message = { jsonrpc: '2.0', method, params };
    const json = JSON.stringify(message);

    this.stdin.write(json + '\n');
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
      throw new Error(`Invalid ACP JSON-RPC message: ${JSON.stringify(message)}`);
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
      this.sendMessage({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: err.code || -32603, message: err.message || 'Internal error' + JSON.stringify(message) },
      });
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

      for (const handler of this.notificationHandlers) {
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

    this.negotiatedProtocolVersion = null;
    this.agentCapabilities = null;
    this.agentInfo = null;
    this.authMethods = [];
    this.sessionModes = null;

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

// @ts-nocheck
import type {
  AgentCapabilities,
  AuthMethod,
  AuthenticateRequest,
  AuthenticateResponse,
  CancelNotification,
  Implementation,
  InitializeRequest,
  InitializeResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  NewSessionRequest,
  NewSessionResponse,
  PermissionOption,
  PromptRequest,
  PromptResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionModeState,
  SessionNotification,
  SetSessionModeRequest,
  SetSessionModeResponse,
} from '@agentclientprotocol/sdk';
/**
 * CJS-compatible re-export bridge for @agentclientprotocol/sdk types.
 *
 * The @agentclientprotocol/sdk package declares "type": "module" in its package.json,
 * which causes TS1479 errors in CJS modules when using `nodenext` module resolution.
 * Since all imports here are type-only (zero runtime impact), we use @ts-nocheck
 * to suppress the diagnostic. All other files import from this bridge instead
 * of directly from the SDK.
 */
export type {
  AgentCapabilities,
  AuthenticateRequest,
  AuthenticateResponse,
  AuthMethod,
  CancelNotification,
  ClientCapabilities,
  ContentBlock,
  CreateTerminalRequest,
  CreateTerminalResponse,
  Implementation,
  InitializeRequest,
  InitializeResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  McpCapabilities,
  NewSessionRequest,
  NewSessionResponse,
  PermissionOption,
  PermissionOptionKind,
  PromptCapabilities,
  PromptRequest,
  PromptResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionCapabilities,
  SessionInfo,
  SessionMode,
  SessionModeState,
  SessionNotification,
  SetSessionModeRequest,
  SetSessionModeResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  ToolCallLocation,
  ToolCallUpdate,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
  KillTerminalCommandResponse,
  KillTerminalCommandRequest,
  ToolKind,
} from '@agentclientprotocol/sdk';

// Extend InitializeResponse to include modes field (not in official SDK yet)
export type ExtendedInitializeResponse = InitializeResponse & {
  modes?: SessionModeState;
};

// Permission RPC Service Types
export interface AcpPermissionDialogParams {
  requestId: string;
  sessionId: string;
  title: string;
  kind?: string;
  content: string;
  locations?: Array<{ path: string; line?: number }>;
  command?: string;
  options: PermissionOption[];
  timeout: number;
}

export type AcpPermissionDecision =
  | { type: 'allow'; optionId?: string; always?: boolean }
  | { type: 'reject'; optionId?: string; always?: boolean }
  | { type: 'timeout' }
  | { type: 'cancelled' };

export const AcpPermissionServicePath = 'AcpPermissionServicePath';

/**
 * Browser-side RPC service interface
 * Called from Node layer to show permission dialogs
 */
export interface IAcpPermissionService {
  $showPermissionDialog(params: AcpPermissionDialogParams): Promise<AcpPermissionDecision>;
  $cancelRequest(requestId: string): Promise<void>;
}

export const AcpPermissionServiceToken = Symbol('AcpPermissionServiceToken');

/**
 * Node-side caller interface (for internal use)
 * This is what Node layer uses to call browser
 * Implemented by AcpPermissionCallerManager (multi-instance, per clientId)
 */
export interface IAcpPermissionCaller {
  requestPermission(request: RequestPermissionRequest): Promise<RequestPermissionResponse>;
  cancelRequest(requestId: string): Promise<void>;
}

// ACP CLI Client Service Types

/**
 * Connection state for ACP CLI client
 * Represents the lifecycle states of the JSON-RPC connection
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting';

/**
 * ACP CLI 客户端服务接口 - 基于 JSON-RPC 2.0 协议的传输层
 */
export interface IAcpCliClientService {
  /**
   * Set up transport streams for JSON-RPC communication
   * @param stdout - Readable stream from agent process
   * @param stdin - Writable stream to agent process
   */
  setTransport(stdout: NodeJS.ReadableStream, stdin: NodeJS.WritableStream): void;

  /**
   * Initialize the ACP connection
   */
  initialize(params?: InitializeRequest): Promise<InitializeResponse>;

  /**
   * Authenticate with the agent
   */
  authenticate(params: AuthenticateRequest): Promise<AuthenticateResponse>;

  /**
   * Create a new session
   */
  newSession(params: NewSessionRequest): Promise<NewSessionResponse>;

  /**
   * Load an existing session
   */
  loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse>;

  /**
   * List all sessions
   */
  listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse>;

  /**
   * Send a prompt to the session
   */
  prompt(params: PromptRequest): Promise<PromptResponse>;

  /**
   * Cancel an ongoing operation
   */
  cancel(params: CancelNotification): Promise<void>;

  /**
   * Change the session mode
   */
  setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse>;

  /**
   * Register a notification handler
   * @returns Unsubscribe function
   */
  onNotification(handler: (notification: SessionNotification) => void): () => void;

  /**
   * Close the connection and cleanup resources
   */
  close(): Promise<void>;

  /**
   * Check if currently connected
   */
  isConnected(): boolean;

  /**
   * Handle unexpected disconnect
   */
  handleDisconnect(): void;

  /**
   * Get the negotiated protocol version
   */
  getNegotiatedProtocolVersion(): number | null;

  /**
   * Get agent capabilities from initialize response
   */
  getAgentCapabilities(): AgentCapabilities | null;

  /**
   * Get agent info from initialize response
   */
  getAgentInfo(): Implementation | null;

  /**
   * Get available authentication methods
   */
  getAuthMethods(): AuthMethod[];

  /**
   * Get available session modes
   */
  getSessionModes(): SessionModeState | null;
}

/**
 * Symbol token for dependency injection
 */
export const AcpCliClientServiceToken = Symbol('AcpCliClientServiceToken');

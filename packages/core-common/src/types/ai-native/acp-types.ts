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
  AvailableCommand,
  AvailableCommandsUpdate,
  CancelNotification,
  ClientCapabilities,
  CloseSessionRequest,
  CloseSessionResponse,
  ContentBlock,
  CreateTerminalRequest,
  CreateTerminalResponse,
  EnvVariable,
  ForkSessionRequest,
  ForkSessionResponse,
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
  Plan,
  PlanEntry,
  PlanEntryPriority,
  PlanEntryStatus,
  PromptCapabilities,
  PromptRequest,
  PromptResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  ResumeSessionRequest,
  ResumeSessionResponse,
  SessionCapabilities,
  SessionInfo,
  SessionMode,
  SessionModeState,
  SessionNotification,
  SetSessionConfigOptionRequest,
  SetSessionConfigOptionResponse,
  SetSessionModeRequest,
  SetSessionModeResponse,
  SetSessionModelRequest,
  SetSessionModelResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  ToolCall,
  ToolCallContent,
  ToolCallId,
  ToolCallLocation,
  ToolCallStatus,
  ToolCallUpdate,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
  KillTerminalCommandResponse,
  KillTerminalCommandRequest,
  HttpHeader,
  McpServer,
  McpServerHttp,
  McpServerSse,
  McpServerStdio,
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

export const AcpThreadStatusServicePath = 'AcpThreadStatusServicePath';

export interface IAcpThreadStatusService {
  $onThreadStatusChange(sessionId: string, status: string): Promise<void>;
}

export type AcpDebugLogDirection = 'incoming' | 'outgoing' | 'stderr' | 'system';

export interface AcpDebugLogEntry {
  id: number;
  timestamp: number;
  direction: AcpDebugLogDirection;
  agentId: string;
  threadId: string;
  sessionId?: string;
  raw: string;
  payload?: unknown;
}

// WebMCP Group types for OpenSumi IDE capability tools
export const AcpWebMcpBridgePath = 'AcpWebMcpBridgePath';

export type WebMcpToolRiskLevel = 'read' | 'write' | 'destructive' | 'shell' | 'ui';
export type WebMcpProfile = 'minimal' | 'default' | 'interactive' | 'full';

export interface WebMcpToolDef {
  name: string; // "file_read"
  description: string;
  inputSchema: Record<string, unknown>;
  /**
   * Describes the tool's operational risk for catalog output, logging, and
   * future policy evolution. It is not a complete authorization decision by
   * itself; concrete tools still own their permission checks.
   */
  riskLevel?: WebMcpToolRiskLevel;
  /**
   * Lightweight escape hatch for tools that should stay out of normal MCP
   * exposure while the capability model is still being validated in practice.
   */
  exposedByDefault?: boolean;
  /**
   * Controls the default tool surface for each WebMCP profile. Session-level
   * capability enablement may reveal additional tools, but execution-time
   * safety must still live in the target tool.
   */
  profiles?: WebMcpProfile[];
}

export interface WebMcpGroupDef {
  name: string;
  description: string;
  defaultLoaded: boolean;
  profile?: WebMcpProfile;
  tools: WebMcpToolDef[];
}

export interface WebMcpToolResult {
  success: boolean;
  result?: unknown;
  error?: string; // machine-readable error code
  details?: string; // human-readable error description
}

export interface WebMcpGroupInfo {
  name: string;
  description: string;
  toolCount: number;
  loaded: boolean;
}

export interface WebMcpGroupDefinitionOptions {
  includeAllTools?: boolean;
}

export interface IAcpWebMcpBridgeService {
  $getGroupDefinitions(options?: WebMcpGroupDefinitionOptions): Promise<WebMcpGroupDef[]>;
  $executeTool(group: string, tool: string, params: Record<string, unknown>): Promise<WebMcpToolResult>;
}

export const AcpWebMcpCallerServiceToken = Symbol('AcpWebMcpCallerServiceToken');
export const AcpWebMcpHandlerToken = Symbol('AcpWebMcpHandlerToken');
export const WebMcpGroupRegistryToken = Symbol('WebMcpGroupRegistryToken');

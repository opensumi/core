export { AcpPermissionHandler } from './permission.handler';
export { AcpChatRelayStore } from './acp-chat-relay-store';
export type { AcpChatRelayPutOptions, AcpChatRelayRecord } from './acp-chat-relay-store';
export { AcpChatRelaySummaryProvider } from './acp-chat-relay-summary-provider';
export type {
  AcpChatRelaySummaryOptions,
  AcpChatRelaySummaryResult,
  AcpChatRelaySummarySession,
} from './acp-chat-relay-summary-provider';
export { AcpPermissionBridgeService, ShowPermissionDialogParams } from './permission-bridge.service';
export { AcpPermissionTitleIndicatorService } from './permission-title-indicator.service';
export { AcpPermissionRpcService } from './acp-permission-rpc.service';
export { AcpThreadStatusRpcService } from './acp-thread-status-rpc.service';
export { AgenticTaskRegistryService } from './agentic-task-registry.service';
export type {
  AgenticPendingTaskActivation,
  AgenticPendingTaskLaunch,
  AgenticProjectRecord,
  AgenticProjectRegistration,
  AgenticTaskGroup,
  AgenticTaskRecord,
  AgenticTaskRegistryState,
  AgenticTaskStatus,
  RegisterFirstPromptOptions,
} from './agentic-task-registry.service';
export { PermissionDialog, PermissionDialogProps } from './permission-dialog.view';
export { default as PermissionDialogStyles } from './permission-dialog.module.less';
export { WebMcpGroupRegistry, WebMcpGroupRegistration, WebMcpToolExecute } from './webmcp-group-registry';
export { createAcpChatGroup } from './webmcp-groups/acp-chat.webmcp-group';
export { createDiagnosticsGroup } from './webmcp-groups/diagnostics.webmcp-group';
export { createEditorGroup } from './webmcp-groups/editor.webmcp-group';
export { createFileGroup } from './webmcp-groups/file.webmcp-group';
export { createSearchGroup } from './webmcp-groups/search.webmcp-group';
export { createTerminalGroup } from './webmcp-groups/terminal.webmcp-group';
export { createWorkspaceGroup } from './webmcp-groups/workspace.webmcp-group';
export { AcpWebMcpRpcService } from './acp-webmcp-rpc.service';
export { getWebMcpModelContextToolDefinitions, registerWebMcpModelContextTools } from './webmcp-model-context-adapter';
export type {
  WebMcpModelContextAdapterOptions,
  WebMcpModelContextToolDefinition,
} from './webmcp-model-context-adapter';
export {
  tryGetService,
  classifyError,
  safeErrorMessage,
  successResult,
  errorResult,
  serviceUnavailableResult,
} from './webmcp-utils';
export type { ErrorCode, WebMcpToolResult as BrowserWebMcpToolResult } from './webmcp-utils';

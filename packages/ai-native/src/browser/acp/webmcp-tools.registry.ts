// @ts-nocheck
/**
 * WebMCP tool registry for the ACP (Agent Control Protocol) module.
 *
 * Registers browser-side tools on `navigator.modelContext` that allow an external
 * AI agent to interact with the ACP chat system — listing sessions, sending messages,
 * switching sessions, and managing session state.
 *
 * Tools follow the naming convention: acp_<action>
 *
 * PHASE 1: Register ALL public methods from ALL services (no filtering).
 * Phase 2: Later, add input schemas, descriptions, and filter out internal/dangerous methods.
 */
import { Injector, IDisposable } from '@opensumi/di';
import { ensureModelContext } from '@opensumi/ide-core-browser/lib/webmcp-polyfill';
import type { NavigatorModelContext } from '@opensumi/ide-core-browser/lib/webmcp-types';

import {
  IChatInternalService,
  IChatManagerService,
  IChatAgentService,
  ChatProxyServiceToken,
  IChatMessageStructure,
  InlineDiffServiceToken,
} from '../../common';
import { LLMContextServiceToken } from '../../common/llm-context';
import { MCPConfigServiceToken, RulesServiceToken } from '../../common';

import { AcpPermissionRpcService } from '../acp/acp-permission-rpc.service';
import { AcpPermissionBridgeService } from '../acp/permission-bridge.service';
import { ApplyService } from '../chat/apply.service';
import { ChatAgentViewService } from '../chat/chat-agent.view.service';
import { ChatService } from '../chat/chat.api.service';
import { ChatManagerService } from '../chat/chat-manager.service';
import { ChatProxyService } from '../chat/chat-proxy.service';
import { AcpChatProxyService } from '../chat/chat-proxy.service.acp';
import { ChatInternalService } from '../chat/chat.internal.service';
import { AcpChatInternalService } from '../chat/chat.internal.service.acp';
import { AICompletionsService } from '../contrib/inline-completions/service/ai-completions.service';
import { CodeActionService } from '../contrib/code-action/code-action.service';
import { ProblemFixService } from '../contrib/problem-fix/problem-fix.service';
import { RenameSuggestionsService } from '../contrib/rename/rename.service';
import { AITerminalService } from '../contrib/terminal/ai-terminal.service';
import { AITerminalDecorationService } from '../contrib/terminal/decoration/terminal-decoration';
import { PS1TerminalService } from '../contrib/terminal/ps1-terminal.service';
import { LanguageParserService } from '../languages/service';
import { BaseApplyService } from '../mcp/base-apply.service';
import { MCPConfigService } from '../mcp/config/mcp-config.service';
import { MCPServerProxyService } from '../mcp/mcp-server-proxy.service';
import { RulesService } from '../rules/rules.service';
import { InlineChatService } from '../widget/inline-chat/inline-chat.service';
import { InlineDiffService } from '../widget/inline-diff/inline-diff.service';
import { InlineInputService } from '../widget/inline-input/inline-input.service';
import { InlineStreamDiffService } from '../widget/inline-stream-diff/inline-stream-diff.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryGetService<T>(container: Injector, token: symbol): T | null {
  try {
    return container.get(token) as T;
  } catch {
    return null;
  }
}

function classifyError(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const name = (err as Error).name || '';
    if (name.includes('Timeout') || name.includes('timeout')) return 'RPC_TIMEOUT';
    if (name.includes('Injector') || name.includes('DI')) return 'DI_ERROR';
    if (name.includes('Permission') || name.includes('denied')) return 'PERMISSION_DENIED';
    if (name.includes('Abort')) return 'ABORTED';
  }
  return 'EXECUTION_ERROR';
}

function safeErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/[A-Za-z_]*token[A-Za-z_]*[:=\s]+["']?[A-Za-z0-9+/=]+["']?/gi, '[REDACTED]')
    .replace(/[A-Za-z_]*key[A-Za-z_]*[:=\s]+["']?[A-Za-z0-9+/=]+["']?/gi, '[REDACTED]')
    .substring(0, 200);
}

/**
 * Generic tool executor: resolve service by token, call method by name with args.
 * Used for bulk registration of all public methods without hand-crafted schemas.
 */
function createGenericToolExecutor(
  container: Injector,
  serviceToken: symbol,
  methodName: string,
): (args?: Record<string, unknown>) => Promise<unknown> {
  return async (args?: Record<string, unknown>) => {
    const service = tryGetService(container, serviceToken);
    if (!service) {
      return {
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        details: `Service not found in DI container`,
      };
    }
    try {
      const method = (service as Record<string, unknown>)[methodName];
      if (typeof method !== 'function') {
        return {
          success: false,
          error: 'METHOD_NOT_FOUND',
          details: `Method ${methodName} not found on service`,
        };
      }
      // Pass args as spread if provided, otherwise call with no args
      const result = args ? await (method as Function)(...Object.values(args)) : await (method as Function)();
      return { success: true, result };
    } catch (err) {
      return {
        success: false,
        error: classifyError(err),
        details: safeErrorMessage(err),
      };
    }
  };
}

/**
 * Register a generic tool with a simple input schema derived from argNames.
 */
function registerGenericTool(
  ctx: NavigatorModelContext,
  container: Injector,
  controller: AbortController,
  name: string,
  description: string,
  serviceToken: symbol,
  methodName: string,
  argNames: string[] = [],
): void {
  const properties: Record<string, { type: string; description: string }> = {};
  for (const arg of argNames) {
    properties[arg] = { type: 'string', description: `Parameter: ${arg}` };
  }

  ctx.registerTool(
    {
      name,
      description,
      inputSchema: {
        type: 'object',
        properties,
        required: [],
      },
      execute: createGenericToolExecutor(container, serviceToken, methodName),
    },
    { signal: controller.signal },
  );
}

// ---------------------------------------------------------------------------
// Service definitions: [token, class ref, method list]
// Each entry defines which methods to register as tools.
// ---------------------------------------------------------------------------

interface ServiceMethodRegistry {
  token: symbol;
  methods: { name: string; args?: string[] }[];
}

const SERVICE_METHODS: Record<string, ServiceMethodRegistry> = {
  // ChatService
  ChatService: {
    token: ChatService as unknown as symbol,
    methods: [
      { name: 'showChatView' },
      { name: 'sendMessage', args: ['data'] },
      { name: 'clearHistoryMessages' },
      { name: 'sendReplyMessage', args: ['data'] },
      { name: 'sendMessageList', args: ['list'] },
      { name: 'scrollToBottom' },
    ],
  },

  // IChatInternalService / AcpChatInternalService
  IChatInternalService: {
    token: IChatInternalService,
    methods: [
      { name: 'setLatestRequestId', args: ['id'] },
      { name: 'createRequest', args: ['input', 'agentId', 'images', 'command'] },
      { name: 'sendRequest', args: ['request', 'regenerate'] },
      { name: 'cancelRequest' },
      { name: 'createSessionModel' },
      { name: 'clearSessionModel', args: ['sessionId'] },
      { name: 'getSessions' },
      { name: 'getSession', args: ['sessionId'] },
      { name: 'activateSession', args: ['sessionId'] },
      // AcpChatInternalService extras
      { name: 'getAvailableCommands' },
      { name: 'setAvailableCommands', args: ['commands'] },
      { name: 'setSessionMode', args: ['modeId'] },
      { name: 'getSessionsByAcp' },
    ],
  },

  // IChatManagerService / AcpChatManagerService
  IChatManagerService: {
    token: IChatManagerService,
    methods: [
      { name: 'getSessions' },
      { name: 'startSession' },
      { name: 'getSession', args: ['sessionId'] },
      { name: 'clearSession', args: ['sessionId'] },
      { name: 'createRequest', args: ['sessionId', 'message', 'agentId', 'command', 'images'] },
      { name: 'sendRequest', args: ['sessionId', 'request', 'regenerate'] },
      { name: 'cancelRequest', args: ['sessionId'] },
      // AcpChatManagerService extras
      { name: 'loadSessionList' },
      { name: 'loadSession', args: ['sessionId'] },
      { name: 'getAvailableCommands' },
      { name: 'fallbackToLocal' },
    ],
  },

  // IChatAgentService / ChatAgentService
  IChatAgentService: {
    token: IChatAgentService,
    methods: [
      { name: 'getAgents' },
      { name: 'hasAgent', args: ['id'] },
      { name: 'getAgent', args: ['id'] },
      { name: 'getDefaultAgentId' },
      { name: 'populateChatInput', args: ['id', 'message'] },
      { name: 'getCommands' },
      { name: 'getAllSampleQuestions' },
      { name: 'parseMessage', args: ['value', 'currentAgentId'] },
      { name: 'sendMessage', args: ['chunk'] },
    ],
  },

  // ChatAgentViewService
  ChatAgentViewService: {
    token: ChatAgentViewService,
    methods: [
      { name: 'getRenderAgents' },
      { name: 'getChatComponent', args: ['id'] },
      { name: 'getChatComponentDeferred', args: ['id'] },
    ],
  },

  // AcpPermissionBridgeService
  AcpPermissionBridgeService: {
    token: AcpPermissionBridgeService,
    methods: [
      { name: 'setActiveSession', args: ['sessionId'] },
      { name: 'getActiveSession' },
      { name: 'cancelRequest', args: ['requestId'] },
      { name: 'getActiveDialogCount' },
      { name: 'getActiveDialogs' },
      { name: 'clearSessionDialogs', args: ['sessionId'] },
    ],
  },

  // LLMContextService
  LLMContextService: {
    token: LLMContextServiceToken,
    methods: [
      { name: 'addRuleToContext', args: ['uri'] },
      { name: 'addFileToContext', args: ['uri', 'selection', 'isManual'] },
      { name: 'addFolderToContext', args: ['uri'] },
      { name: 'cleanFileContext' },
      { name: 'removeFileFromContext', args: ['uri', 'isManual'] },
      { name: 'removeFolderFromContext', args: ['uri'] },
      { name: 'removeRuleFromContext', args: ['uri'] },
      { name: 'startAutoCollection' },
      { name: 'stopAutoCollection' },
      { name: 'serialize' },
    ],
  },

  // RulesService
  RulesService: {
    token: RulesServiceToken,
    methods: [
      { name: 'initProjectRules' },
      { name: 'openRule', args: ['rule'] },
      { name: 'createNewRule' },
      { name: 'updateGlobalRules', args: ['rules'] },
      { name: 'parseMDCContent', args: ['content'] },
      { name: 'serializeMDCContent', args: ['mdcContent'] },
    ],
  },

  // MCPConfigService
  MCPConfigService: {
    token: MCPConfigServiceToken,
    methods: [
      { name: 'getServers' },
      { name: 'controlServer', args: ['serverName', 'start'] },
      { name: 'saveServer', args: ['prev', 'data'] },
      { name: 'deleteServer', args: ['serverName'] },
      { name: 'syncServer', args: ['serverName'] },
      { name: 'getServerConfigByName', args: ['serverName'] },
      { name: 'getReadableServerType', args: ['type'] },
      { name: 'getDisabledTools' },
      { name: 'toggleToolEnabled', args: ['toolName'] },
      { name: 'isToolEnabled', args: ['toolName'] },
      { name: 'openConfigFile' },
    ],
  },

  // BaseApplyService
  BaseApplyService: {
    token: BaseApplyService,
    methods: [
      { name: 'getUriCodeBlocks', args: ['uri'] },
      { name: 'getPendingPaths', args: ['sessionId'] },
      { name: 'getSessionCodeBlocks', args: ['sessionId'] },
      { name: 'getCodeBlock', args: ['toolCallId', 'messageId'] },
      { name: 'registerCodeBlock', args: ['relativePath', 'content', 'toolCallId', 'instructions'] },
      { name: 'apply', args: ['codeBlock'] },
      { name: 'cancelApply', args: ['blockData', 'keepStatus'] },
      { name: 'cancelAllApply', args: ['sessionId'] },
      { name: 'revealApplyPosition', args: ['blockData'] },
      { name: 'processAll', args: ['type', 'uri'] },
    ],
  },

  // ApplyService (concrete subclass of BaseApplyService)
  ApplyService: {
    token: ApplyService,
    methods: [
      { name: 'getUriCodeBlocks', args: ['uri'] },
      { name: 'getPendingPaths', args: ['sessionId'] },
      { name: 'getSessionCodeBlocks', args: ['sessionId'] },
      { name: 'getCodeBlock', args: ['toolCallId', 'messageId'] },
      { name: 'registerCodeBlock', args: ['relativePath', 'content', 'toolCallId', 'instructions'] },
      { name: 'apply', args: ['codeBlock'] },
      { name: 'cancelApply', args: ['blockData', 'keepStatus'] },
      { name: 'cancelAllApply', args: ['sessionId'] },
      { name: 'revealApplyPosition', args: ['blockData'] },
      { name: 'processAll', args: ['type', 'uri'] },
    ],
  },

  // ChatProxyService (public methods already covered by skipMethods)
  ChatProxyService: {
    token: ChatProxyServiceToken,
    methods: [
      { name: 'getRequestOptions' },
    ],
  },

  // AcpChatProxyService (extends ChatProxyService, public methods already covered by skipMethods)
  AcpChatProxyService: {
    token: ChatProxyServiceToken,
    methods: [
      { name: 'getRequestOptions' },
    ],
  },

  // AICompletionsService
  AICompletionsService: {
    token: AICompletionsService,
    methods: [
      { name: 'complete', args: ['data'] },
      { name: 'report', args: ['data'] },
      { name: 'reporterEnd', args: ['relationId', 'data'] },
      { name: 'setVisibleCompletion', args: ['visible'] },
      { name: 'setLastSessionId', args: ['sessionId'] },
      { name: 'setLastRelationId', args: ['relationId'] },
      { name: 'setLastCompletionContent', args: ['content'] },
      { name: 'cancelRequest' },
      { name: 'hideStatusBarItem' },
    ],
  },

  // AITerminalService
  AITerminalService: {
    token: AITerminalService,
    methods: [
      { name: 'active' },
    ],
  },

  // PS1TerminalService
  PS1TerminalService: {
    token: PS1TerminalService,
    methods: [
      { name: 'active' },
    ],
  },

  // AITerminalDecorationService
  AITerminalDecorationService: {
    token: AITerminalDecorationService,
    methods: [
      { name: 'active' },
      { name: 'addZoneDecoration', args: ['terminal', 'marker', 'height', 'inlineWidget'] },
    ],
  },

  // CodeActionService
  CodeActionService: {
    token: CodeActionService,
    methods: [
      { name: 'fireCodeActionRun', args: ['id', 'range'] },
      { name: 'getCodeActions' },
      { name: 'deleteCodeActionById', args: ['id'] },
      { name: 'registerCodeAction', args: ['operational'] },
    ],
  },

  // ProblemFixService
  ProblemFixService: {
    token: ProblemFixService,
    methods: [
      { name: 'triggerHoverFix', args: ['isTrigger'] },
    ],
  },

  // RenameSuggestionsService
  RenameSuggestionsService: {
    token: RenameSuggestionsService,
    methods: [
      { name: 'provideRenameSuggestions', args: ['model', 'range', 'triggerKind', 'token'] },
    ],
  },

  // InlineDiffService
  InlineDiffService: {
    token: InlineDiffServiceToken,
    methods: [
      { name: 'firePartialEdit', args: ['event'] },
    ],
  },

  // InlineInputService
  InlineInputService: {
    token: InlineInputService,
    methods: [
      { name: 'visibleByPosition', args: ['position'] },
      { name: 'visibleBySelection', args: ['selection'] },
      { name: 'visibleByNearestCodeBlock', args: ['position', 'monacoEditor'] },
      { name: 'hide' },
      { name: 'getSequenceKeyString' },
    ],
  },

  // InlineStreamDiffService
  InlineStreamDiffService: {
    token: InlineStreamDiffService,
    methods: [
      { name: 'launchAcceptDiscardPartialEdit', args: ['isAccept'] },
    ],
  },

  // InlineChatService
  InlineChatService: {
    token: InlineChatService,
    methods: [
      { name: 'fireThumbsEvent', args: ['isThumbsUp'] },
    ],
  },

  // AcpPermissionRpcService
  AcpPermissionRpcService: {
    token: AcpPermissionRpcService,
    methods: [
      { name: '$showPermissionDialog', args: ['params'] },
      { name: '$cancelRequest', args: ['requestId'] },
    ],
  },

  // MCPServerProxyService
  MCPServerProxyService: {
    token: MCPServerProxyService,
    methods: [
      { name: '$callMCPTool', args: ['name', 'args'] },
      { name: '$getBuiltinMCPTools' },
      { name: '$updateMCPServers' },
      { name: 'getAllMCPTools' },
      { name: '$getServers' },
      { name: '$startServer', args: ['serverName'] },
      { name: '$stopServer', args: ['serverName'] },
      { name: '$compressToolResult', args: ['result', 'options'] },
    ],
  },

  // LanguageParserService
  LanguageParserService: {
    token: LanguageParserService,
    methods: [
      { name: 'createParser', args: ['language'] },
    ],
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export function registerAcpWebMCPTools(container: Injector): IDisposable {
  ensureModelContext();

  const ctx = navigator.modelContext!;
  const controller = new AbortController();

  // =========================================================================
  // PHASE 1: Hand-crafted tools with proper descriptions and schemas
  // =========================================================================

  // ----- acp_listSessions -----
  ctx.registerTool(
    {
      name: 'acp_listSessions',
      description:
        'List all ACP chat sessions. Returns an array of session objects with sessionId, title, modelId, and threadStatus. Use this to discover existing sessions before switching or sending messages.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const chatInternalService = tryGetService<IChatInternalService>(container, IChatInternalService);
        if (!chatInternalService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IChatInternalService not registered in DI container',
          };
        }
        try {
          const sessions = (chatInternalService as AcpChatInternalService).getSessions();
          const result = sessions.map((s: any) => ({
            sessionId: s.sessionId,
            title: s.title || '',
            modelId: s.modelId,
            threadStatus: s.threadStatus,
            requestCount: s.requests?.length ?? 0,
          }));
          return { success: true, result };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- acp_createSession -----
  ctx.registerTool(
    {
      name: 'acp_createSession',
      description:
        'Create a new ACP chat session and make it the active session. Returns the new sessionId. Use this when you want to start a fresh conversation.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const chatInternalService = tryGetService<IChatInternalService>(container, IChatInternalService);
        if (!chatInternalService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IChatInternalService not registered in DI container',
          };
        }
        try {
          await (chatInternalService as AcpChatInternalService).createSessionModel();
          const sessionModel = (chatInternalService as AcpChatInternalService).sessionModel;
          return {
            success: true,
            result: {
              sessionId: sessionModel?.sessionId,
              title: sessionModel?.title,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- acp_switchSession -----
  ctx.registerTool(
    {
      name: 'acp_switchSession',
      description:
        'Switch the active ACP chat session to the one specified by sessionId. Use this to load a previous conversation or switch between sessions.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'The sessionId to switch to. Get valid IDs from acp_listSessions.',
          },
        },
        required: ['sessionId'],
      },
      execute: async (args: { sessionId: string }) => {
        if (!args.sessionId) {
          return {
            success: false,
            error: 'INVALID_INPUT',
            details: 'sessionId is required',
          };
        }
        const chatInternalService = tryGetService<IChatInternalService>(container, IChatInternalService);
        if (!chatInternalService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IChatInternalService not registered in DI container',
          };
        }
        try {
          await (chatInternalService as AcpChatInternalService).activateSession(args.sessionId);
          const sessionModel = (chatInternalService as AcpChatInternalService).sessionModel;
          return {
            success: true,
            result: {
              sessionId: sessionModel?.sessionId,
              title: sessionModel?.title,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- acp_getSessionState -----
  ctx.registerTool(
    {
      name: 'acp_getSessionState',
      description:
        'Get the current active ACP session state, including sessionId, title, modelId, threadStatus (idle/working/errored), message count, and recent request history. Use this to check the agent status after sending a message.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const chatInternalService = tryGetService<IChatInternalService>(container, IChatInternalService);
        if (!chatInternalService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IChatInternalService not registered in DI container',
          };
        }
        try {
          const sessionModel = (chatInternalService as AcpChatInternalService).sessionModel;
          if (!sessionModel) {
            return {
              success: false,
              error: 'NO_ACTIVE_SESSION',
              details: 'No active session. Use acp_createSession first.',
            };
          }
          const requests = sessionModel.requests || [];
          return {
            success: true,
            result: {
              sessionId: sessionModel.sessionId,
              title: sessionModel.title,
              modelId: sessionModel.modelId,
              threadStatus: sessionModel.threadStatus,
              requestCount: requests.length,
              lastRequest: requests.length > 0 ? requests[requests.length - 1]?.message?.prompt : null,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- acp_sendMessage -----
  ctx.registerTool(
    {
      name: 'acp_sendMessage',
      description:
        'Send a text message to the active ACP chat session. The message is queued and the agent will process it asynchronously. Use acp_getSessionState to check the response progress. Optionally include image URLs as base64 data URIs.',
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The message text to send to the agent.',
          },
          images: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional array of image data URIs (base64) to include with the message.',
          },
          command: {
            type: 'string',
            description: 'Optional slash command to use (e.g. "/explain", "/fix"). Get available commands via acp_getAvailableCommands.',
          },
        },
        required: ['message'],
      },
      execute: async (args: { message: string; images?: string[]; command?: string }) => {
        if (!args.message || args.message.trim().length === 0) {
          return {
            success: false,
            error: 'INVALID_INPUT',
            details: 'message is required and cannot be empty',
          };
        }
        const chatService = tryGetService<ChatService>(container, ChatService);
        if (!chatService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'ChatService not registered in DI container',
          };
        }
        const chatInternalService = tryGetService<IChatInternalService>(container, IChatInternalService);
        if (!chatInternalService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IChatInternalService not registered in DI container',
          };
        }
        try {
          const sessionModel = (chatInternalService as AcpChatInternalService).sessionModel;
          if (!sessionModel) {
            return {
              success: false,
              error: 'NO_ACTIVE_SESSION',
              details: 'No active session. Use acp_createSession first.',
            };
          }
          const messageData: IChatMessageStructure = {
            message: args.message,
            images: args.images,
            command: args.command,
            immediate: true,
          };
          chatService.sendMessage(messageData);
          return {
            success: true,
            result: {
              sessionId: sessionModel.sessionId,
              status: 'message_sent',
              message: args.message,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- acp_clearSession -----
  ctx.registerTool(
    {
      name: 'acp_clearSession',
      description:
        'Clear the active ACP chat session history and create a new blank session. Use this to reset the conversation context. Optionally specify a sessionId to clear a specific session; otherwise clears the current one.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'Optional sessionId to clear. If omitted, clears the current active session.',
          },
        },
      },
      execute: async (args?: { sessionId?: string }) => {
        const chatInternalService = tryGetService<IChatInternalService>(container, IChatInternalService);
        if (!chatInternalService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IChatInternalService not registered in DI container',
          };
        }
        try {
          await (chatInternalService as AcpChatInternalService).clearSessionModel(args?.sessionId);
          const sessionModel = (chatInternalService as AcpChatInternalService).sessionModel;
          return {
            success: true,
            result: {
              sessionId: sessionModel?.sessionId,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- acp_cancelRequest -----
  ctx.registerTool(
    {
      name: 'acp_cancelRequest',
      description:
        'Cancel the current in-progress agent request in the active session. Use this to stop a running agent task.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const chatInternalService = tryGetService<IChatInternalService>(container, IChatInternalService);
        if (!chatInternalService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IChatInternalService not registered in DI container',
          };
        }
        try {
          const sessionModel = (chatInternalService as AcpChatInternalService).sessionModel;
          if (!sessionModel) {
            return {
              success: false,
              error: 'NO_ACTIVE_SESSION',
              details: 'No active session',
            };
          }
          const chatManagerService = tryGetService<IChatManagerService>(container, IChatManagerService);
          if (!chatManagerService) {
            return {
              success: false,
              error: 'SERVICE_UNAVAILABLE',
              details: 'IChatManagerService not registered in DI container',
            };
          }
          chatManagerService.cancelRequest(sessionModel.sessionId);
          return { success: true, result: { status: 'cancelled' } };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- acp_getAvailableCommands -----
  ctx.registerTool(
    {
      name: 'acp_getAvailableCommands',
      description:
        'Get the list of available slash commands for the current ACP session. Each command has a name and description. Use the command name with acp_sendMessage to invoke a specific command.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const chatInternalService = tryGetService<IChatInternalService>(container, IChatInternalService);
        if (!chatInternalService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IChatInternalService not registered in DI container',
          };
        }
        try {
          const commands = (chatInternalService as AcpChatInternalService).getAvailableCommands();
          return {
            success: true,
            result: commands.map((c: any) => ({
              name: c.name,
              description: c.description,
            })),
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- acp_setSessionMode -----
  ctx.registerTool(
    {
      name: 'acp_setSessionMode',
      description:
        'Switch the mode of the active ACP session (e.g. "agent", "chat"). Different modes change how the agent behaves and what tools it has access to.',
      inputSchema: {
        type: 'object',
        properties: {
          modeId: {
            type: 'string',
            description: 'The mode ID to switch to (e.g. "agent", "chat").',
          },
        },
        required: ['modeId'],
      },
      execute: async (args: { modeId: string }) => {
        if (!args.modeId) {
          return {
            success: false,
            error: 'INVALID_INPUT',
            details: 'modeId is required',
          };
        }
        const chatInternalService = tryGetService<IChatInternalService>(container, IChatInternalService);
        if (!chatInternalService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IChatInternalService not registered in DI container',
          };
        }
        try {
          await (chatInternalService as AcpChatInternalService).setSessionMode(args.modeId);
          return { success: true, result: { modeId: args.modeId } };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- acp_showChatView -----
  ctx.registerTool(
    {
      name: 'acp_showChatView',
      description:
        'Show/open the ACP chat view panel in the IDE. Use this to ensure the chat panel is visible to the user.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const chatService = tryGetService<ChatService>(container, ChatService);
        if (!chatService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'ChatService not registered in DI container',
          };
        }
        try {
          chatService.showChatView();
          return { success: true, result: { status: 'shown' } };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- acp_getPermissionDialogState -----
  ctx.registerTool(
    {
      name: 'acp_getPermissionDialogState',
      description:
        'Get the current state of ACP permission dialogs — including the number of active (pending) permission dialogs and the active session ID. Use this to check if the agent is waiting for user permission.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const permissionBridge = tryGetService<AcpPermissionBridgeService>(container, AcpPermissionBridgeService);
        if (!permissionBridge) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'AcpPermissionBridgeService not registered in DI container',
          };
        }
        try {
          return {
            success: true,
            result: {
              activeDialogCount: permissionBridge.getActiveDialogCount(),
              activeSessionId: permissionBridge.getActiveSession(),
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // =========================================================================
  // PHASE 1: Bulk registration of ALL remaining public methods from ALL
  // services. No filtering — register everything first, filter later.
  // =========================================================================

  const skipMethods = new Set([
    // Already registered above as hand-crafted tools
    'showChatView',
    'sendMessage',
    'clearHistoryMessages',
    'sendReplyMessage',
    'sendMessageList',
    'scrollToBottom',
    'setLatestRequestId',
    'createRequest',
    'sendRequest',
    'cancelRequest',
    'createSessionModel',
    'clearSessionModel',
    'getSessions',
    'getSession',
    'activateSession',
    'getAvailableCommands',
    'setAvailableCommands',
    'setSessionMode',
    'getSessionsByAcp',
    'startSession',
    'clearSession',
    'loadSessionList',
    'loadSession',
    'fallbackToLocal',
    'getAgents',
    'hasAgent',
    'getAgent',
    'getDefaultAgentId',
    'populateChatInput',
    'getCommands',
    'getAllSampleQuestions',
    'parseMessage',
    'getRenderAgents',
    'getChatComponent',
    'getChatComponentDeferred',
    'setActiveSession',
    'getActiveSession',
    'getActiveDialogCount',
    'getActiveDialogs',
    'clearSessionDialogs',
    'addRuleToContext',
    'addFileToContext',
    'addFolderToContext',
    'cleanFileContext',
    'removeFileFromContext',
    'removeFolderFromContext',
    'removeRuleFromContext',
    'startAutoCollection',
    'stopAutoCollection',
    'serialize',
    'initProjectRules',
    'openRule',
    'createNewRule',
    'updateGlobalRules',
    'parseMDCContent',
    'serializeMDCContent',
    'getServers',
    'controlServer',
    'saveServer',
    'deleteServer',
    'syncServer',
    'getServerConfigByName',
    'getReadableServerType',
    'getDisabledTools',
    'toggleToolEnabled',
    'isToolEnabled',
    'openConfigFile',
    'getUriCodeBlocks',
    'getPendingPaths',
    'getSessionCodeBlocks',
    'getCodeBlock',
    'registerCodeBlock',
    'apply',
    'cancelApply',
    'cancelAllApply',
    'revealApplyPosition',
    'processAll',
    // Newly added services (Phase 1 bulk registration)
    'getRequestOptions',
    'complete',
    'report',
    'reporterEnd',
    'setVisibleCompletion',
    'setLastSessionId',
    'setLastRelationId',
    'setLastCompletionContent',
    'hideStatusBarItem',
    'active',
    'addZoneDecoration',
    'fireCodeActionRun',
    'getCodeActions',
    'deleteCodeActionById',
    'registerCodeAction',
    'triggerHoverFix',
    'provideRenameSuggestions',
    'firePartialEdit',
    'visibleByPosition',
    'visibleBySelection',
    'visibleByNearestCodeBlock',
    'hide',
    'getSequenceKeyString',
    'launchAcceptDiscardPartialEdit',
    'fireThumbsEvent',
    '$showPermissionDialog',
    '$cancelRequest',
    '$callMCPTool',
    '$getBuiltinMCPTools',
    '$updateMCPServers',
    'getAllMCPTools',
    '$getServers',
    '$startServer',
    '$stopServer',
    '$compressToolResult',
    'createParser',
    // Skip lifecycle / non-tool methods
    'init',
    'dispose',
    'registerAgent',
    'registerDefaultAgent',
    'registerFallbackAgent',
    'registerChatComponent',
    'updateAgent',
    'invokeAgent',
    'getFollowups',
    'getSampleQuestions',
    'showPermissionDialog',
    'handleUserDecision',
    'handleDialogClose',
    'getRequestOptions',
    'postApplyHandler',
    'doApply',
    'doProcess',
    'renderApplyResult',
    'listenPartialEdit',
    'getDiffResult',
    'getDiagnosticInfos',
    'updateCodeBlock',
    'getMessageCodeBlocks',
  ]);

  for (const [serviceName, serviceDef] of Object.entries(SERVICE_METHODS)) {
    for (const method of serviceDef.methods) {
      const toolName = `acp_${serviceName.charAt(0).toLowerCase() + serviceName.slice(1)}_${method.name}`;

      // Skip if already registered above
      if (skipMethods.has(method.name)) {
        continue;
      }

      const description = `WebMCP tool: ${method.name} from ${serviceName}. (PHASE 1: auto-generated, needs description/schema refinement)`;

      registerGenericTool(
        ctx,
        container,
        controller,
        toolName,
        description,
        serviceDef.token,
        method.name,
        method.args || [],
      );
    }
  }

  return { dispose: () => controller.abort() };
}

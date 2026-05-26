/**
 * WebMCP tool registry for the ACP (Agent Control Protocol) module.
 *
 * Registers browser-side tools on `navigator.modelContext` that allow an external
 * AI agent to interact with the ACP chat system — listing sessions, sending messages,
 * switching sessions, managing session state, and handling permission dialogs.
 *
 * Tools follow the naming convention: acp_<action>
 *
 * PHASE 2: All tools are hand-crafted with proper descriptions, typed input schemas,
 * and direct service method calls. Generic registration helpers are kept for Phase 3
 * modules that have not yet been refined.
 */
import { IDisposable, Injector } from '@opensumi/di';
import { ensureModelContext } from '@opensumi/ide-core-browser/lib/webmcp-polyfill';
import { ChatServiceToken } from '@opensumi/ide-core-common';

import { IChatInternalService, IChatManagerService, IChatMessageStructure } from '../../common';
import { AcpPermissionBridgeService } from '../acp/permission-bridge.service';
import { ChatService } from '../chat/chat.api.service';
import { AcpChatInternalService } from '../chat/chat.internal.service.acp';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryGetService(container: Injector, token: unknown): unknown {
  try {
    return container.get(token as symbol);
  } catch {
    return null;
  }
}

function classifyError(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const name = (err as Error).name || '';
    if (name.includes('Timeout') || name.includes('timeout')) {
      return 'RPC_TIMEOUT';
    }
    if (name.includes('Injector') || name.includes('DI')) {
      return 'DI_ERROR';
    }
    if (name.includes('Permission') || name.includes('denied')) {
      return 'PERMISSION_DENIED';
    }
    if (name.includes('Abort')) {
      return 'ABORTED';
    }
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

export function createGenericToolExecutor(
  container: Injector,
  serviceToken: unknown,
  methodName: string,
): (args?: Record<string, unknown>) => Promise<unknown> {
  return async (args?: Record<string, unknown>) => {
    const service = tryGetService(container, serviceToken);
    if (!service) {
      return {
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        details: 'Service not found in DI container',
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

// ---------------------------------------------------------------------------
// PHASE 2: Hand-crafted tools with proper descriptions and typed input schemas
// ---------------------------------------------------------------------------

export function registerAcpWebMCPTools(container: Injector): IDisposable {
  ensureModelContext();

  const ctx = navigator.modelContext!;
  const controller = new AbortController();

  ctx.registerTool(
    {
      name: 'acp_listSessions',
      description:
        'List all ACP chat sessions. Returns an array of session objects with sessionId, title, modelId, and threadStatus. Use this to discover existing sessions before switching or sending messages.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const chatInternalService = tryGetService(container, IChatInternalService);
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
          return { success: false, error: classifyError(err), details: safeErrorMessage(err) };
        }
      },
    },
    { signal: controller.signal },
  );

  ctx.registerTool(
    {
      name: 'acp_createSession',
      description:
        'Create a new ACP chat session and make it the active session. Returns the new sessionId. Use this when you want to start a fresh conversation.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const chatInternalService = tryGetService(container, IChatInternalService);
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
          return { success: true, result: { sessionId: sessionModel?.sessionId, title: sessionModel?.title } };
        } catch (err) {
          return { success: false, error: classifyError(err), details: safeErrorMessage(err) };
        }
      },
    },
    { signal: controller.signal },
  );

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
          return { success: false, error: 'INVALID_INPUT', details: 'sessionId is required' };
        }
        const chatInternalService = tryGetService(container, IChatInternalService);
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
          return { success: true, result: { sessionId: sessionModel?.sessionId, title: sessionModel?.title } };
        } catch (err) {
          return { success: false, error: classifyError(err), details: safeErrorMessage(err) };
        }
      },
    },
    { signal: controller.signal },
  );

  ctx.registerTool(
    {
      name: 'acp_getSessionState',
      description:
        'Get the current active ACP session state, including sessionId, title, modelId, threadStatus (idle/working/errored), message count, and recent request history. Use this to check the agent status after sending a message.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const chatInternalService = tryGetService(container, IChatInternalService);
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
          return { success: false, error: classifyError(err), details: safeErrorMessage(err) };
        }
      },
    },
    { signal: controller.signal },
  );

  ctx.registerTool(
    {
      name: 'acp_sendMessage',
      description:
        'Send a text message to the active ACP chat session. The message is queued and the agent will process it asynchronously. Use acp_getSessionState to check the response progress. Optionally include image URLs as base64 data URIs.',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'The message text to send to the agent.' },
          images: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional array of image data URIs (base64) to include with the message.',
          } as any,
          command: {
            type: 'string',
            description:
              'Optional slash command to use (e.g. "/explain", "/fix"). Get available commands via acp_getAvailableCommands.',
          },
        },
        required: ['message'],
      },
      execute: async (args: { message: string; images?: string[]; command?: string }) => {
        if (!args.message || args.message.trim().length === 0) {
          return { success: false, error: 'INVALID_INPUT', details: 'message is required and cannot be empty' };
        }
        const chatService = tryGetService(container, ChatServiceToken) as ChatService;
        if (!chatService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'ChatService not registered in DI container',
          };
        }
        const chatInternalService = tryGetService(container, IChatInternalService);
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
            result: { sessionId: sessionModel.sessionId, status: 'message_sent', message: args.message },
          };
        } catch (err) {
          return { success: false, error: classifyError(err), details: safeErrorMessage(err) };
        }
      },
    },
    { signal: controller.signal },
  );

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
        const chatInternalService = tryGetService(container, IChatInternalService);
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
          return { success: true, result: { sessionId: sessionModel?.sessionId } };
        } catch (err) {
          return { success: false, error: classifyError(err), details: safeErrorMessage(err) };
        }
      },
    },
    { signal: controller.signal },
  );

  ctx.registerTool(
    {
      name: 'acp_cancelRequest',
      description:
        'Cancel the current in-progress agent request in the active session. Use this to stop a running agent task.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const chatInternalService = tryGetService(container, IChatInternalService);
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
            return { success: false, error: 'NO_ACTIVE_SESSION', details: 'No active session' };
          }
          const chatManagerService = tryGetService(container, IChatManagerService) as unknown as {
            cancelRequest(sessionId: string): void;
          };
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
          return { success: false, error: classifyError(err), details: safeErrorMessage(err) };
        }
      },
    },
    { signal: controller.signal },
  );

  ctx.registerTool(
    {
      name: 'acp_getAvailableCommands',
      description:
        'Get the list of available slash commands for the current ACP session. Each command has a name and description. Use the command name with acp_sendMessage to invoke a specific command.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const chatInternalService = tryGetService(container, IChatInternalService);
        if (!chatInternalService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'IChatInternalService not registered in DI container',
          };
        }
        try {
          const commands = (chatInternalService as AcpChatInternalService).getAvailableCommands();
          return { success: true, result: commands.map((c: any) => ({ name: c.name, description: c.description })) };
        } catch (err) {
          return { success: false, error: classifyError(err), details: safeErrorMessage(err) };
        }
      },
    },
    { signal: controller.signal },
  );

  ctx.registerTool(
    {
      name: 'acp_setSessionMode',
      description:
        'Switch the mode of the active ACP session (e.g. "agent", "chat"). Different modes change how the agent behaves and what tools it has access to.',
      inputSchema: {
        type: 'object',
        properties: { modeId: { type: 'string', description: 'The mode ID to switch to (e.g. "agent", "chat").' } },
        required: ['modeId'],
      },
      execute: async (args: { modeId: string }) => {
        if (!args.modeId) {
          return { success: false, error: 'INVALID_INPUT', details: 'modeId is required' };
        }
        const chatInternalService = tryGetService(container, IChatInternalService);
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
          return { success: false, error: classifyError(err), details: safeErrorMessage(err) };
        }
      },
    },
    { signal: controller.signal },
  );

  ctx.registerTool(
    {
      name: 'acp_showChatView',
      description:
        'Show/open the ACP chat view panel in the IDE. Use this to ensure the chat panel is visible to the user.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const chatService = tryGetService(container, ChatServiceToken) as ChatService;
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
          return { success: false, error: classifyError(err), details: safeErrorMessage(err) };
        }
      },
    },
    { signal: controller.signal },
  );

  ctx.registerTool(
    {
      name: 'acp_getPermissionDialogState',
      description:
        'Get the current state of ACP permission dialogs — including the number of active (pending) permission dialogs and the active session ID. Use this to check if the agent is waiting for user permission.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const permissionBridge = tryGetService(container, AcpPermissionBridgeService) as AcpPermissionBridgeService;
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
          return { success: false, error: classifyError(err), details: safeErrorMessage(err) };
        }
      },
    },
    { signal: controller.signal },
  );

  ctx.registerTool(
    {
      name: 'acp_handlePermissionDialog',
      description:
        'Approve or reject a pending ACP permission dialog. Use this after acp_getPermissionDialogState detects a pending dialog. The optionId must match one of the available options (e.g. "allow_once", "allow_always", "reject"). In test mode, use this to auto-approve permission requests.',
      inputSchema: {
        type: 'object',
        properties: {
          requestId: { type: 'string', description: 'The requestId of the pending permission dialog.' },
          optionId: { type: 'string', description: 'The option to select: "allow_once", "allow_always", or "reject".' },
        },
        required: ['requestId', 'optionId'],
      },
      execute: async (args: { requestId: string; optionId: string }) => {
        if (!args.requestId) {
          return { success: false, error: 'INVALID_INPUT', details: 'requestId is required' };
        }
        if (!args.optionId) {
          return { success: false, error: 'INVALID_INPUT', details: 'optionId is required' };
        }
        const permissionBridge = tryGetService(container, AcpPermissionBridgeService) as AcpPermissionBridgeService;
        if (!permissionBridge) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'AcpPermissionBridgeService not registered in DI container',
          };
        }
        try {
          const kind: string = args.optionId.includes('allow')
            ? args.optionId.includes('always')
              ? 'allow_always'
              : 'allow_once'
            : 'reject';
          permissionBridge.handleUserDecision(args.requestId, args.optionId, kind as any);
          return { success: true, result: { requestId: args.requestId, optionId: args.optionId } };
        } catch (err) {
          return { success: false, error: classifyError(err), details: safeErrorMessage(err) };
        }
      },
    },
    { signal: controller.signal },
  );

  return { dispose: () => controller.abort() };
}

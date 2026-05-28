/**
 * WebMCP group definition for ACP chat observability.
 *
 * This group intentionally avoids tools that send chat messages or approve
 * permissions, because Claude Code is already running inside the ACP chat loop.
 */
import { Injector } from '@opensumi/di';
import { ChatServiceToken } from '@opensumi/ide-core-common';

import { IChatInternalService } from '../../../common';
import { ChatService } from '../../chat/chat.api.service';
import { AcpChatInternalService } from '../../chat/chat.internal.service.acp';
import { AcpPermissionBridgeService } from '../permission-bridge.service';
import { WebMcpGroupRegistration } from '../webmcp-group-registry';
import { classifyError, errorResult, serviceUnavailableResult, successResult, tryGetService } from '../webmcp-utils';

function stripAcpPrefix(sessionId: string | undefined): string | undefined {
  return sessionId?.startsWith('acp:') ? sessionId.slice(4) : sessionId;
}

function getHistoryMessageCount(session: unknown): number {
  const history = (session as { history?: { getMessages?: () => unknown[] } })?.history;
  return history?.getMessages?.().length ?? 0;
}

function getRequestCount(session: unknown): number {
  const requests = (session as { requests?: unknown[] })?.requests;
  return Array.isArray(requests) ? requests.length : 0;
}

function toSessionSummary(session: unknown, permissionBridge?: AcpPermissionBridgeService | null) {
  const model = session as {
    sessionId?: string;
    title?: string;
    modelId?: string;
    threadStatus?: string;
    slicedMessageCount?: number;
  };
  return {
    sessionId: model.sessionId,
    rawSessionId: stripAcpPrefix(model.sessionId),
    title: model.title || '',
    modelId: model.modelId,
    threadStatus: model.threadStatus,
    requestCount: getRequestCount(session),
    historyMessageCount: getHistoryMessageCount(session),
    slicedMessageCount: model.slicedMessageCount ?? 0,
    hasPendingPermission: model.sessionId ? permissionBridge?.hasPendingForSession(model.sessionId) ?? false : false,
  };
}

export function createAcpChatGroup(container: Injector): WebMcpGroupRegistration {
  return {
    name: 'acp_chat',
    description: 'ACP chat session state, permission status, and safe chat UI controls',
    defaultLoaded: true,
    tools: [
      {
        method: '_opensumi/acp_chat/getSessionState',
        description:
          'Get the active ACP chat session state without returning user prompts or assistant response content.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const chatInternalService = tryGetService<AcpChatInternalService>(container, IChatInternalService);
          if (!chatInternalService) {
            return serviceUnavailableResult('IChatInternalService');
          }
          const permissionBridge = tryGetService<AcpPermissionBridgeService>(container, AcpPermissionBridgeService);
          try {
            const sessionModel = chatInternalService.sessionModel;
            if (!sessionModel) {
              return successResult({ active: false, session: null });
            }
            return successResult({
              active: true,
              session: toSessionSummary(sessionModel, permissionBridge),
            });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        method: '_opensumi/acp_chat/getPermissionState',
        description:
          'Get ACP permission dialog counts and active session id. Does not approve, reject, or expose permission content.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const permissionBridge = tryGetService<AcpPermissionBridgeService>(container, AcpPermissionBridgeService);
          if (!permissionBridge) {
            return serviceUnavailableResult('AcpPermissionBridgeService');
          }
          try {
            return successResult({
              activeDialogCount: permissionBridge.getActiveDialogCount(),
              activeSessionId: permissionBridge.getActiveSession(),
              pendingCountExcludingActive: permissionBridge.getPendingCountExcludingActive(),
            });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        method: '_opensumi/acp_chat/showChatView',
        description: 'Show the ACP chat view panel in the IDE.',
        riskLevel: 'ui',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const chatService = tryGetService<ChatService>(container, ChatServiceToken);
          if (!chatService) {
            return serviceUnavailableResult('ChatService');
          }
          try {
            chatService.showChatView();
            return successResult({ shown: true });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        method: '_opensumi/acp_chat/listSessions',
        description:
          'List ACP chat sessions as metadata only. Does not return prompts, responses, or tool-call contents.',
        riskLevel: 'read',
        profiles: ['interactive', 'full'],
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const chatInternalService = tryGetService<AcpChatInternalService>(container, IChatInternalService);
          if (!chatInternalService) {
            return serviceUnavailableResult('IChatInternalService');
          }
          const permissionBridge = tryGetService<AcpPermissionBridgeService>(container, AcpPermissionBridgeService);
          try {
            const sessions = chatInternalService.getSessions();
            return successResult({
              sessions: sessions.map((session) => toSessionSummary(session, permissionBridge)),
              total: sessions.length,
            });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        method: '_opensumi/acp_chat/getAvailableCommands',
        description: 'Get available ACP slash commands for the active chat session.',
        riskLevel: 'read',
        profiles: ['interactive', 'full'],
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const chatInternalService = tryGetService<AcpChatInternalService>(container, IChatInternalService);
          if (!chatInternalService) {
            return serviceUnavailableResult('IChatInternalService');
          }
          try {
            const commands = chatInternalService.getAvailableCommands();
            return successResult({
              commands: commands.map((command) => ({
                name: command.name,
                description: command.description || '',
              })),
              total: commands.length,
            });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        method: '_opensumi/acp_chat/setSessionMode',
        description:
          'Switch the active ACP session mode. This changes agent behavior and is only available in the full WebMCP profile.',
        riskLevel: 'write',
        profiles: ['full'],
        inputSchema: {
          type: 'object',
          properties: {
            modeId: {
              type: 'string',
              description: 'ACP session mode id, for example agent or chat.',
            },
          },
          required: ['modeId'],
          additionalProperties: false,
        },
        execute: async (params: Record<string, unknown>) => {
          const modeId = typeof params.modeId === 'string' ? params.modeId : '';
          if (!modeId) {
            return errorResult('INVALID_INPUT', new Error('modeId is required'));
          }
          const chatInternalService = tryGetService<AcpChatInternalService>(container, IChatInternalService);
          if (!chatInternalService) {
            return serviceUnavailableResult('IChatInternalService');
          }
          try {
            await chatInternalService.setSessionMode(modeId);
            return successResult({ modeId });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
    ],
  };
}

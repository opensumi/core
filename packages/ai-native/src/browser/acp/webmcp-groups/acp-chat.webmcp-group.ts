/**
 * WebMCP group definition for ACP chat observability.
 *
 * This group intentionally avoids tools that send chat messages or approve
 * permissions, because Claude Code is already running inside the ACP chat loop.
 */
import { Injector } from '@opensumi/di';
import { ChatServiceToken, ILogger, uuid } from '@opensumi/ide-core-common';
import { ChatMessageRole, IHistoryChatMessage } from '@opensumi/ide-core-common/lib/types/ai-native';

import { IChatInternalService, IChatMessageStructure } from '../../../common';
import { ChatService } from '../../chat/chat.api.service';
import { AcpChatInternalService } from '../../chat/chat.internal.service.acp';
import { AcpChatRelayStore } from '../acp-chat-relay-store';
import { AcpChatRelaySummaryProvider, AcpChatRelaySummarySession } from '../acp-chat-relay-summary-provider';
import { AcpPermissionBridgeService } from '../permission-bridge.service';
import { WebMcpGroupRegistration } from '../webmcp-group-registry';
import { classifyError, errorResult, serviceUnavailableResult, successResult, tryGetService } from '../webmcp-utils';

const RELAY_PREVIEW_CHARS = 300;
const RELAY_PERMISSION_PREVIEW_CHARS = 500;
const RELAY_DIGEST_CAP = 6000;
const READ_MESSAGES_DEFAULT_MAX_MESSAGES = 10;
const READ_MESSAGES_MAX_MESSAGES_CAP = 30;
const READ_MESSAGES_DEFAULT_MAX_CHARS = 4000;
const READ_MESSAGES_MAX_CHARS_CAP = 12000;

function stripAcpPrefix(sessionId: string | undefined): string | undefined {
  return sessionId?.startsWith('acp:') ? sessionId.slice(4) : sessionId;
}

function sameSessionId(a: string | undefined, b: string | undefined): boolean {
  return stripAcpPrefix(a) === stripAcpPrefix(b);
}

function getHistoryMessageCount(session: unknown): number {
  const history = (session as { history?: { getMessages?: () => unknown[] } })?.history;
  return history?.getMessages?.().length ?? 0;
}

function getMemorySummaryCount(session: unknown): number {
  const history = (session as { history?: { getMemorySummaries?: () => unknown[] } })?.history;
  return history?.getMemorySummaries?.().length ?? 0;
}

function getRequestCount(session: unknown): number {
  const requests = (session as { requests?: unknown[] })?.requests;
  return Array.isArray(requests) ? requests.length : 0;
}

function getSessionCreatedAt(session: unknown): number {
  const model = session as {
    createdAt?: number;
    history?: { getMessages?: () => Array<{ timestamp?: number; replyStartTime?: number }> };
  };
  const firstMessage = model.history?.getMessages?.()[0];
  return model.createdAt || firstMessage?.timestamp || firstMessage?.replyStartTime || 0;
}

function sortSessionsByCreatedAtDesc(sessions: unknown[]): unknown[] {
  return sessions
    .map((session, index) => ({ session, index, createdAt: getSessionCreatedAt(session) }))
    .sort((a, b) => {
      if (a.createdAt && b.createdAt && a.createdAt !== b.createdAt) {
        return b.createdAt - a.createdAt;
      }
      if (a.createdAt && !b.createdAt) {
        return -1;
      }
      if (!a.createdAt && b.createdAt) {
        return 1;
      }
      return b.index - a.index;
    })
    .map(({ session }) => session);
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
    createdAt: getSessionCreatedAt(session),
    requestCount: getRequestCount(session),
    historyMessageCount: getHistoryMessageCount(session),
    slicedMessageCount: model.slicedMessageCount ?? 0,
    hasPendingPermission: model.sessionId ? permissionBridge?.hasPendingForSession(model.sessionId) ?? false : false,
  };
}

function findSessionById(sessions: unknown[], sessionId: string): unknown | undefined {
  return sessions.find((session) => sameSessionId((session as { sessionId?: string }).sessionId, sessionId));
}

function getSessionTitle(session: unknown): string {
  return (session as { title?: string }).title || '(untitled)';
}

function getSessionId(session: unknown): string {
  return (session as { sessionId?: string }).sessionId || '';
}

function toPositiveCappedNumber(value: unknown, fallback: number, cap: number): number {
  return Math.min(Math.max(Number(value) || fallback, 1), cap);
}

function truncate(value: string, maxChars: number): string {
  return value.length > maxChars ? value.slice(0, maxChars) : value;
}

function getReadableMessages(session: unknown): IHistoryChatMessage[] {
  const history = (session as { history?: { getMessages?: () => IHistoryChatMessage[] } }).history;
  return (
    history
      ?.getMessages?.()
      .filter((message) => message.role === ChatMessageRole.User || message.role === ChatMessageRole.Assistant) ?? []
  );
}

function formatRelayMessage(record: {
  sourceSessionId: string;
  sourceTitle: string;
  digest: string;
  digestSource: string;
}): string {
  const source = record.sourceTitle || record.sourceSessionId;
  return `[Forwarded from ACP session: ${source}]

${record.digest}

Source session id: ${record.sourceSessionId}
Digest source: ${record.digestSource}`;
}

async function findLoadedSessionById(
  chatInternalService: AcpChatInternalService,
  sessionId: string,
): Promise<unknown | undefined> {
  let sessions = chatInternalService.getSessions();
  let session = findSessionById(sessions, sessionId);
  if (!session) {
    sessions = await chatInternalService.getSessionsByAcp();
    session = findSessionById(sessions, sessionId);
  }
  if (!session) {
    return undefined;
  }
  if (getHistoryMessageCount(session) > 0) {
    return session;
  }
  return (await chatInternalService.loadSessionModel(getSessionId(session))) || session;
}

export function createAcpChatGroup(container: Injector): WebMcpGroupRegistration {
  return {
    name: 'acp_chat',
    description: 'ACP chat session state, permission status, and safe chat UI controls',
    defaultLoaded: true,
    tools: [
      {
        name: 'acp_chat_get_session_state',
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
        name: 'acp_chat_get_permission_state',
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
        name: 'acp_chat_show_chat_view',
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
        name: 'acp_chat_list_sessions',
        description:
          'List ACP chat sessions newest first as metadata only. Does not return prompts, responses, or tool-call contents.',
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
            const sortedSessions = sortSessionsByCreatedAtDesc(sessions);
            return successResult({
              sessions: sortedSessions.map((session) => toSessionSummary(session, permissionBridge)),
              total: sessions.length,
            });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        name: 'acp_chat_get_available_commands',
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
        name: 'acp_chat_prepare_session_digest',
        description:
          'Prepare a bounded background digest for another ACP chat session. Returns only digest metadata and a short preview; the full digest stays in the browser relay store.',
        riskLevel: 'read',
        profiles: ['interactive', 'full'],
        inputSchema: {
          type: 'object',
          properties: {
            sourceSessionId: {
              type: 'string',
              description: 'ACP session id to summarize. Accepts either acp:<id> or raw <id>.',
            },
            maxSourceChars: {
              type: 'number',
              description: 'Maximum source characters used by the background summarizer. Default 12000, cap 30000.',
            },
            maxDigestChars: {
              type: 'number',
              description: 'Maximum digest characters stored for relay. Default 2000, cap 6000.',
            },
          },
          required: ['sourceSessionId'],
          additionalProperties: false,
        },
        execute: async (params: Record<string, unknown>) => {
          const sourceSessionId = typeof params.sourceSessionId === 'string' ? params.sourceSessionId : '';
          if (!sourceSessionId) {
            return errorResult('INVALID_INPUT', new Error('sourceSessionId is required'));
          }

          const chatInternalService = tryGetService<AcpChatInternalService>(container, IChatInternalService);
          if (!chatInternalService) {
            return serviceUnavailableResult('IChatInternalService');
          }
          const summaryProvider = tryGetService<AcpChatRelaySummaryProvider>(container, AcpChatRelaySummaryProvider);
          if (!summaryProvider) {
            return serviceUnavailableResult('AcpChatRelaySummaryProvider');
          }
          const relayStore = tryGetService<AcpChatRelayStore>(container, AcpChatRelayStore);
          if (!relayStore) {
            return serviceUnavailableResult('AcpChatRelayStore');
          }
          const logger = tryGetService<ILogger>(container, ILogger);

          try {
            const startedAt = Date.now();
            logger?.log?.(
              `[WebMCP][acp_chat] prepareSessionDigest start — requestedSourceSessionId=${stripAcpPrefix(
                sourceSessionId,
              )}, maxSourceChars=${params.maxSourceChars ?? 'default'}, maxDigestChars=${
                params.maxDigestChars ?? 'default'
              }`,
            );

            const sourceSession = await findLoadedSessionById(chatInternalService, sourceSessionId);
            if (!sourceSession) {
              logger?.warn?.(
                `[WebMCP][acp_chat] prepareSessionDigest miss — requestedSourceSessionId=${stripAcpPrefix(
                  sourceSessionId,
                )}, reason=session_not_found, durationMs=${Date.now() - startedAt}`,
              );
              return errorResult('FILE_NOT_FOUND', new Error(`ACP session "${sourceSessionId}" not found`));
            }

            const summary = await summaryProvider.prepareSessionDigest(sourceSession as AcpChatRelaySummarySession, {
              maxSourceChars: params.maxSourceChars as number | undefined,
              maxDigestChars: params.maxDigestChars as number | undefined,
            });
            const sourceId = getSessionId(sourceSession);
            const record = relayStore.put({
              sourceSessionId: sourceId,
              sourceTitle: getSessionTitle(sourceSession),
              digestSource: summary.digestSource,
              digest: summary.digest,
              sourceChars: summary.sourceChars,
              digestChars: summary.digestChars,
              sourceTruncated: summary.sourceTruncated,
            });

            logger?.log?.(
              `[WebMCP][acp_chat] prepareSessionDigest — sourceSessionId=${stripAcpPrefix(sourceId)}, digestId=${
                record.digestId
              }, digestSource=${summary.digestSource}, historyMessages=${getHistoryMessageCount(
                sourceSession,
              )}, memorySummaries=${getMemorySummaryCount(sourceSession)}, sourceChars=${
                summary.sourceChars
              }, digestChars=${summary.digestChars}, sourceTruncated=${summary.sourceTruncated}, expiresInMs=${
                record.expiresAt - record.createdAt
              }, durationMs=${Date.now() - startedAt}`,
            );

            return successResult({
              digestId: record.digestId,
              sourceSessionId: sourceId,
              sourceTitle: record.sourceTitle,
              digestSource: record.digestSource,
              preview: truncate(record.digest, RELAY_PREVIEW_CHARS),
              digestChars: record.digestChars,
              sourceChars: record.sourceChars,
              sourceTruncated: record.sourceTruncated,
              expiresAt: record.expiresAt,
            });
          } catch (err) {
            logger?.warn?.(
              `[WebMCP][acp_chat] prepareSessionDigest error — requestedSourceSessionId=${stripAcpPrefix(
                sourceSessionId,
              )}, errorName=${err instanceof Error ? err.name : typeof err}`,
            );
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        name: 'acp_chat_post_prepared_relay',
        description:
          'Post a previously prepared ACP chat digest to a target ACP session after explicit user permission.',
        riskLevel: 'write',
        profiles: ['full'],
        inputSchema: {
          type: 'object',
          properties: {
            digestId: {
              type: 'string',
              description: 'Digest id returned by acp_chat_prepare_session_digest.',
            },
            targetSessionId: {
              type: 'string',
              description: 'ACP session id to receive the relay message. Accepts either acp:<id> or raw <id>.',
            },
          },
          required: ['digestId', 'targetSessionId'],
          additionalProperties: false,
        },
        execute: async (params: Record<string, unknown>) => {
          const digestId = typeof params.digestId === 'string' ? params.digestId : '';
          const targetSessionId = typeof params.targetSessionId === 'string' ? params.targetSessionId : '';
          if (!digestId || !targetSessionId) {
            return errorResult('INVALID_INPUT', new Error('digestId and targetSessionId are required'));
          }

          const chatInternalService = tryGetService<AcpChatInternalService>(container, IChatInternalService);
          if (!chatInternalService) {
            return serviceUnavailableResult('IChatInternalService');
          }
          const chatService = tryGetService<ChatService>(container, ChatServiceToken);
          if (!chatService) {
            return serviceUnavailableResult('ChatService');
          }
          const permissionBridge = tryGetService<AcpPermissionBridgeService>(container, AcpPermissionBridgeService);
          if (!permissionBridge) {
            return serviceUnavailableResult('AcpPermissionBridgeService');
          }
          const relayStore = tryGetService<AcpChatRelayStore>(container, AcpChatRelayStore);
          if (!relayStore) {
            return serviceUnavailableResult('AcpChatRelayStore');
          }
          const logger = tryGetService<ILogger>(container, ILogger);

          try {
            const startedAt = Date.now();
            logger?.log?.(
              `[WebMCP][acp_chat] postPreparedRelay start — digestId=${digestId}, requestedTargetSessionId=${stripAcpPrefix(
                targetSessionId,
              )}`,
            );

            const record = relayStore.get(digestId);
            if (!record) {
              logger?.warn?.(
                `[WebMCP][acp_chat] postPreparedRelay miss — digestId=${digestId}, requestedTargetSessionId=${stripAcpPrefix(
                  targetSessionId,
                )}, reason=digest_not_found_or_expired, durationMs=${Date.now() - startedAt}`,
              );
              return errorResult('FILE_NOT_FOUND', new Error(`Relay digest "${digestId}" not found or expired`));
            }
            if (!record.digest) {
              logger?.warn?.(
                `[WebMCP][acp_chat] postPreparedRelay miss — digestId=${digestId}, sourceSessionId=${stripAcpPrefix(
                  record.sourceSessionId,
                )}, reason=empty_digest, durationMs=${Date.now() - startedAt}`,
              );
              return errorResult('INVALID_INPUT', new Error(`Relay digest "${digestId}" is empty`));
            }

            let sessions = chatInternalService.getSessions();
            let targetSession = findSessionById(sessions, targetSessionId);
            if (!targetSession) {
              sessions = await chatInternalService.getSessionsByAcp();
              targetSession = findSessionById(sessions, targetSessionId);
            }
            if (!targetSession) {
              logger?.warn?.(
                `[WebMCP][acp_chat] postPreparedRelay miss — digestId=${digestId}, sourceSessionId=${stripAcpPrefix(
                  record.sourceSessionId,
                )}, requestedTargetSessionId=${stripAcpPrefix(
                  targetSessionId,
                )}, reason=target_session_not_found, durationMs=${Date.now() - startedAt}`,
              );
              return errorResult('FILE_NOT_FOUND', new Error(`Target ACP session "${targetSessionId}" not found`));
            }

            const originalSessionId = chatInternalService.sessionModel?.sessionId;
            const targetId = getSessionId(targetSession);
            const willSwitchSession = !sameSessionId(originalSessionId, targetId);
            const relayMessage = formatRelayMessage({
              sourceSessionId: record.sourceSessionId,
              sourceTitle: record.sourceTitle,
              digest: truncate(record.digest, RELAY_DIGEST_CAP),
              digestSource: record.digestSource,
            });
            const permissionRequestId = `${stripAcpPrefix(originalSessionId) || 'acp_chat'}:relay:${uuid(8)}`;
            const permissionStartedAt = Date.now();

            logger?.log?.(
              `[WebMCP][acp_chat] postPreparedRelay permission request — digestId=${digestId}, requestId=${permissionRequestId}, sourceSessionId=${stripAcpPrefix(
                record.sourceSessionId,
              )}, targetSessionId=${stripAcpPrefix(targetId)}, digestChars=${
                record.digestChars
              }, switchedSession=${willSwitchSession}`,
            );
            const decision = await permissionBridge.showPermissionDialog({
              requestId: permissionRequestId,
              sessionId: stripAcpPrefix(originalSessionId) || stripAcpPrefix(targetId) || 'acp_chat',
              title: 'Forward ACP chat digest',
              kind: 'write',
              content: [
                `Source: ${record.sourceTitle || record.sourceSessionId}`,
                `Target: ${getSessionTitle(targetSession)} (${targetId})`,
                `Digest chars: ${record.digestChars}`,
                `Temporary session switch: ${willSwitchSession ? 'yes' : 'no'}`,
                '',
                truncate(record.digest, RELAY_PERMISSION_PREVIEW_CHARS),
              ].join('\n'),
              options: [
                { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' },
                { optionId: 'reject', name: 'Reject', kind: 'reject_once' },
              ],
              timeout: 60000,
            });
            logger?.log?.(
              `[WebMCP][acp_chat] postPreparedRelay permission result — digestId=${digestId}, requestId=${permissionRequestId}, decision=${
                decision.type
              }, optionId=${'optionId' in decision ? decision.optionId : ''}, durationMs=${
                Date.now() - permissionStartedAt
              }`,
            );

            if (decision.type !== 'allow') {
              logger?.warn?.(
                `[WebMCP][acp_chat] postPreparedRelay denied — digestId=${digestId}, requestId=${permissionRequestId}, decision=${
                  decision.type
                }, durationMs=${Date.now() - startedAt}`,
              );
              return {
                success: false,
                error: 'PERMISSION_DENIED',
                details: `Relay rejected or cancelled: ${decision.type}`,
              };
            }

            try {
              if (willSwitchSession) {
                logger?.log?.(
                  `[WebMCP][acp_chat] postPreparedRelay session switch — digestId=${digestId}, fromSessionId=${stripAcpPrefix(
                    originalSessionId,
                  )}, toSessionId=${stripAcpPrefix(targetId)}`,
                );
                await chatInternalService.activateSession(targetId);
              }
              const messageData: IChatMessageStructure = {
                message: relayMessage,
                immediate: true,
              };
              chatService.sendMessage(messageData);
              logger?.log?.(
                `[WebMCP][acp_chat] postPreparedRelay message sent — digestId=${digestId}, targetSessionId=${stripAcpPrefix(
                  targetId,
                )}, messageChars=${relayMessage.length}`,
              );
              relayStore.delete(digestId);
            } finally {
              if (willSwitchSession && originalSessionId) {
                await chatInternalService.activateSession(originalSessionId);
                logger?.log?.(
                  `[WebMCP][acp_chat] postPreparedRelay session restored — digestId=${digestId}, restoredSessionId=${stripAcpPrefix(
                    originalSessionId,
                  )}`,
                );
              }
            }

            logger?.log?.(
              `[WebMCP][acp_chat] postPreparedRelay — digestId=${digestId}, sourceSessionId=${stripAcpPrefix(
                record.sourceSessionId,
              )}, targetSessionId=${stripAcpPrefix(targetId)}, digestSource=${record.digestSource}, digestChars=${
                record.digestChars
              }, switchedSession=${willSwitchSession}, durationMs=${Date.now() - startedAt}`,
            );

            return successResult({
              posted: true,
              digestId,
              sourceSessionId: record.sourceSessionId,
              targetSessionId: targetId,
              digestChars: record.digestChars,
              switchedSession: willSwitchSession,
            });
          } catch (err) {
            logger?.warn?.(
              `[WebMCP][acp_chat] postPreparedRelay error — digestId=${digestId}, requestedTargetSessionId=${stripAcpPrefix(
                targetSessionId,
              )}, errorName=${err instanceof Error ? err.name : typeof err}`,
            );
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        name: 'acp_chat_read_session_messages',
        description:
          'Read bounded recent user/assistant message previews from an ACP session. Full-profile debug fallback only.',
        riskLevel: 'read',
        profiles: ['full'],
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'ACP session id to read. Accepts either acp:<id> or raw <id>.',
            },
            maxMessages: {
              type: 'number',
              description: 'Maximum recent messages to return. Default 10, cap 30.',
            },
            maxChars: {
              type: 'number',
              description: 'Maximum total preview characters. Default 4000, cap 12000.',
            },
            sinceRequestId: {
              type: 'string',
              description: 'Optional request id lower bound. Messages before this request id are skipped.',
            },
          },
          required: ['sessionId'],
          additionalProperties: false,
        },
        execute: async (params: Record<string, unknown>) => {
          const sessionId = typeof params.sessionId === 'string' ? params.sessionId : '';
          if (!sessionId) {
            return errorResult('INVALID_INPUT', new Error('sessionId is required'));
          }
          const chatInternalService = tryGetService<AcpChatInternalService>(container, IChatInternalService);
          if (!chatInternalService) {
            return serviceUnavailableResult('IChatInternalService');
          }

          try {
            const session = await findLoadedSessionById(chatInternalService, sessionId);
            if (!session) {
              return errorResult('FILE_NOT_FOUND', new Error(`ACP session "${sessionId}" not found`));
            }

            const maxMessages = toPositiveCappedNumber(
              params.maxMessages,
              READ_MESSAGES_DEFAULT_MAX_MESSAGES,
              READ_MESSAGES_MAX_MESSAGES_CAP,
            );
            const maxChars = toPositiveCappedNumber(
              params.maxChars,
              READ_MESSAGES_DEFAULT_MAX_CHARS,
              READ_MESSAGES_MAX_CHARS_CAP,
            );
            const sinceRequestId = typeof params.sinceRequestId === 'string' ? params.sinceRequestId : undefined;
            let sourceMessages = getReadableMessages(session);
            if (sinceRequestId) {
              const index = sourceMessages.findIndex((message) => message.requestId === sinceRequestId);
              if (index >= 0) {
                sourceMessages = sourceMessages.slice(index + 1);
              }
            }

            let usedChars = 0;
            let truncated = sourceMessages.length > maxMessages;
            const messages: Array<{
              role: 'user' | 'assistant';
              contentPreview: string;
              chars: number;
              truncated: boolean;
            }> = [];
            const selectedMessages = sourceMessages.slice(-maxMessages);
            for (const message of selectedMessages) {
              const remaining = Math.max(maxChars - usedChars, 0);
              if (remaining <= 0) {
                truncated = true;
                break;
              }
              const contentPreview = truncate(message.content || '', remaining);
              usedChars += contentPreview.length;
              const messageTruncated = contentPreview.length < (message.content || '').length;
              if (messageTruncated) {
                truncated = true;
              }
              messages.push({
                role: message.role === ChatMessageRole.User ? 'user' : 'assistant',
                contentPreview,
                chars: (message.content || '').length,
                truncated: messageTruncated,
              });
            }

            return successResult({
              sessionId: getSessionId(session),
              title: getSessionTitle(session),
              requestCount: getRequestCount(session),
              historyMessageCount: getHistoryMessageCount(session),
              messages,
              truncated,
            });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        name: 'acp_chat_set_session_mode',
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

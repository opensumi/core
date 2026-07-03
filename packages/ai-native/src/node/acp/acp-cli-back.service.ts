import { Autowired, Injectable } from '@opensumi/di';
import {
  AvailableCommand,
  CLIENT_ID_TOKEN,
  CancellationToken,
  IAIBackService,
  IAIBackServiceOption,
  IAIBackServiceResponse,
  IChatContent,
  IChatProgress,
  IChatReasoning,
  IChatSessionState,
  IChatThreadStatus,
  IChatToolCall,
  IChatToolContent,
  ListSessionsResponse,
  McpServer,
  SessionNotification,
  SetSessionModeRequest,
  ThreadStatus,
} from '@opensumi/ide-core-common';
import { AgentProcessConfig } from '@opensumi/ide-core-common/lib/types/ai-native/agent-types';
import { ChatReadableStream, INodeLogger } from '@opensumi/ide-core-node';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

import { BaseLanguageModel } from '../base-language-model';
import { OpenAICompatibleModel } from '../openai-compatible/openai-compatible-language-model';

import { AcpAgentServiceToken, AgentRequest, AgentUpdate, IAcpAgentService, SimpleMessage } from './acp-agent.service';
import { getAcpErrorMessage, normalizeAcpError } from './acp-error';
import { AcpThreadStatusCallerServiceToken } from './acp-thread-status-caller.service';

import type { CoreMessage } from 'ai';

export const AcpCliBackServiceToken = Symbol('AcpCliBackServiceToken');

/**
 * Type guard to check if a value is a valid CoreMessage
 */
function isCoreMessage(msg: unknown): msg is CoreMessage {
  if (!msg || typeof msg !== 'object') {
    return false;
  }
  return 'role' in msg && 'content' in msg;
}

/**
 * Type guard to check if a content part is a text part
 */
function isTextContentPart(part: unknown): part is { type: 'text'; text: string } {
  return (
    typeof part === 'object' &&
    part !== null &&
    'type' in part &&
    (part as { type: string }).type === 'text' &&
    'text' in part
  );
}

function convertToSimpleMessage(msg?: CoreMessage): SimpleMessage {
  if (!msg || !isCoreMessage(msg)) {
    return {
      role: 'user',
      content: '',
    };
  }

  let content: string;
  if (typeof msg.content === 'string') {
    content = msg.content;
  } else if (Array.isArray(msg.content)) {
    content = msg.content
      .filter(isTextContentPart)
      .map((part) => part.text)
      .join('\n');
  } else {
    content = String(msg.content ?? '');
  }

  return {
    role: msg.role ?? 'user',
    content,
  };
}

function convertMessageHistory(history?: CoreMessage[]): SimpleMessage[] | undefined {
  if (!history || history[0] === null) {
    return undefined;
  }
  return history.map(convertToSimpleMessage);
}

@Injectable()
export class AcpCliBackService implements IAIBackService {
  @Autowired(AcpAgentServiceToken)
  private agentService: IAcpAgentService;

  @Autowired(CLIENT_ID_TOKEN)
  private readonly clientId: string | undefined;

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  @Autowired(OpenAICompatibleModel)
  private openAICompatibleModel: OpenAICompatibleModel;

  @Autowired(AcpThreadStatusCallerServiceToken)
  private threadStatusCaller: any;

  private isDisposing = false;

  private threadStatusDisposable: any;

  async getOpenSumiMcpServerConnection() {
    return this.agentService.getOpenSumiMcpServerConnection(this.clientId);
  }

  /**
   * Lazily subscribe to thread status changes from AcpAgentService
   * and forward them to the browser via RPC.
   */
  private ensureThreadStatusSubscription(): void {
    if (this.threadStatusDisposable) {
      return;
    }
    this.logger.log('[ACP Back] ensureThreadStatusSubscription: subscribing to onThreadStatusChange');
    this.threadStatusDisposable = this.agentService.onThreadStatusChange(({ sessionId, status }) => {
      this.logger.log(`[ACP Back] onThreadStatusChange: sessionId=${sessionId}, status=${status}`);
      if (this.threadStatusCaller?.notifyThreadStatusChange) {
        this.threadStatusCaller.notifyThreadStatusChange(sessionId, status);
      } else {
        this.logger.warn('[ACP Back] onThreadStatusChange: threadStatusCaller not available');
      }
    });
  }

  // registerProcessExitHandlers(): void {
  //   process.once('SIGTERM', () => {
  //     this.dispose().then(() => {
  //       process.exit(0);
  //     });
  //   });

  //   process.once('SIGINT', () => {
  //     this.dispose().then(() => {
  //       process.exit(0);
  //     });
  //   });
  // }

  async request(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<IAIBackServiceResponse> {
    this.logger.log(
      `[ACP Back] request: type=${
        options.type ?? '(empty)'
      }, hasAgentSessionConfig=${!!options.agentSessionConfig}, noTool=${options.noTool === true}`,
    );
    if (!options.agentSessionConfig) {
      return this.openAIRequest(input, options, cancelToken);
    }
    return this.agentRequest(input, options, cancelToken);
  }

  private async openAIRequest(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<IAIBackServiceResponse<string>> {
    const stream = new ChatReadableStream();
    const responsePromise = this.collectChatProgressStream(stream);
    try {
      await this.openAICompatibleModel.request(input, stream, options, cancelToken);
      return responsePromise;
    } catch (error) {
      const normalizedError = normalizeAcpError(error);
      return {
        errorCode: -1,
        errorMsg: normalizedError.message,
      };
    }
  }

  private async agentRequest(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<IAIBackServiceResponse<string>> {
    let sessionId: string | undefined;
    try {
      this.ensureThreadStatusSubscription();
      const config: AgentProcessConfig = {
        ...options.agentSessionConfig!,
        mcpServers: options.noTool ? [] : options.agentSessionConfig!.mcpServers,
      };
      const result = await this.agentService.createSession(config);
      sessionId = result.sessionId;
      this.logger.log(
        `[ACP Back] request: created ephemeral session sessionId=${sessionId}, type=${options.type ?? '(empty)'}`,
      );

      const stream = this.agentService.sendMessage(
        {
          sessionId,
          prompt: this.buildNonStreamingAgentPrompt(input, options),
          images: options.images,
          history: convertMessageHistory(options.history),
        },
        config,
      );

      return await this.collectAgentRequestStream(stream, sessionId, cancelToken);
    } catch (error) {
      if (sessionId) {
        await this.disposeEphemeralSession(sessionId);
      }
      const normalizedError = normalizeAcpError(error);
      return {
        errorCode: -1,
        errorMsg: normalizedError.message,
      };
    }
  }

  private collectAgentRequestStream(
    stream: SumiReadableStream<AgentUpdate>,
    sessionId: string,
    cancelToken?: CancellationToken,
  ): Promise<IAIBackServiceResponse<string>> {
    let content = '';
    let settled = false;
    const disposables: Array<{ dispose(): void }> = [];

    return new Promise((resolve) => {
      const finish = async (response: IAIBackServiceResponse<string>) => {
        if (settled) {
          return;
        }
        settled = true;
        disposables.forEach((disposable) => disposable.dispose());
        await this.disposeEphemeralSession(sessionId);
        resolve(response);
      };

      disposables.push(
        stream.onData((update) => {
          if (update.type === 'message') {
            content += update.content;
            return;
          }
          if (update.type === 'done') {
            finish({
              errorCode: 0,
              data: content,
            });
          }
        }),
      );
      disposables.push(
        stream.onEnd(() => {
          finish({
            errorCode: 0,
            data: content,
          });
        }),
      );
      disposables.push(
        stream.onError((error) => {
          const normalizedError = normalizeAcpError(error);
          finish({
            errorCode: -1,
            errorMsg: normalizedError.message,
          });
        }),
      );
      if (cancelToken) {
        disposables.push(
          cancelToken.onCancellationRequested(() => {
            this.agentService.cancelRequest(sessionId).finally(() => {
              finish({
                errorCode: -1,
                errorMsg: 'Request canceled',
                isCancel: true,
              });
            });
          }),
        );
      }
    });
  }

  private collectChatProgressStream(
    stream: SumiReadableStream<IChatProgress>,
  ): Promise<IAIBackServiceResponse<string>> {
    let content = '';
    return new Promise((resolve) => {
      stream.onData((progress) => {
        if (progress.kind === 'content') {
          content += progress.content;
        }
      });
      stream.onEnd(() => {
        resolve({
          errorCode: 0,
          data: content,
        });
      });
      stream.onError((error) => {
        const normalizedError = normalizeAcpError(error);
        resolve({
          errorCode: -1,
          errorMsg: normalizedError.message,
        });
      });
    });
  }

  private buildNonStreamingAgentPrompt(input: string, options: IAIBackServiceOption): string {
    if (!options.noTool) {
      return input;
    }
    return `You are running in a temporary background session for a non-interactive OpenSumi request.
Do not call tools, do not inspect files, and do not ask follow-up questions. Return only the final answer text.

${input}`;
  }

  private async disposeEphemeralSession(sessionId: string): Promise<void> {
    try {
      await this.agentService.closeSession({ sessionId });
    } catch (error) {
      this.logger.warn(`[ACP Back] request: failed to close ephemeral session sessionId=${sessionId}`, error);
    }
    try {
      await this.agentService.disposeSession(sessionId, true);
      this.logger.log(`[ACP Back] request: disposed ephemeral session sessionId=${sessionId}`);
    } catch (error) {
      this.logger.warn(`[ACP Back] request: failed to dispose ephemeral session sessionId=${sessionId}`, error);
    }
  }

  async requestStream(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<SumiReadableStream<IChatProgress>> {
    this.logger.log(
      `[ACP Back] requestStream: hasAgentSessionConfig=${!!options.agentSessionConfig}, apiKey=${
        options.apiKey ? options.apiKey.slice(0, 8) + '***' : '(empty)'
      }, baseURL=${options.baseURL}, sessionId=${options.sessionId}, requestId=${
        options.requestId ?? '(empty)'
      }, inputChars=${input.length}, images=${options.images?.length ?? 0}, historyMessages=${
        options.history?.length ?? 0
      }`,
    );
    // Fallback to OpenAI-compatible API when ACP agent is not configured
    if (!options.agentSessionConfig) {
      this.logger.log('[ACP Back] No agentSessionConfig, falling back to OpenAI-compatible');
      return this.openAIRequestStream(input, options, cancelToken);
    }
    this.logger.log('[ACP Back] Using agent request stream');
    return this.agentRequestStream(input, options, cancelToken);
  }

  private async openAIRequestStream(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<ChatReadableStream> {
    this.logger.log(
      `[ACP Back] openAIRequestStream: apiKey=${
        options.apiKey ? options.apiKey.slice(0, 8) + '***' : '(empty)'
      }, baseURL=${options.baseURL}`,
    );
    const stream = new ChatReadableStream();
    try {
      await this.openAICompatibleModel.request(input, stream, options, cancelToken);
    } catch (error) {
      stream.emitError(error instanceof Error ? error : new Error(String(error)));
    }
    return stream;
  }

  private agentRequestStream(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): SumiReadableStream<IChatProgress> {
    this.logger.log(
      `[ACP Back] agentRequestStream: setting up agent stream, sessionId=${options.sessionId ?? '(empty)'}, requestId=${
        options.requestId ?? '(empty)'
      }, inputChars=${input.length}`,
    );
    this.ensureThreadStatusSubscription();
    const stream = new SumiReadableStream<IChatProgress>();
    this.setupAgentStream(options.agentSessionConfig!, input, options, stream, cancelToken);
    return stream;
  }

  private async setupAgentStream(
    config: AgentProcessConfig,
    input: string,
    options: IAIBackServiceOption,
    stream: SumiReadableStream<IChatProgress>,
    cancelToken?: CancellationToken,
  ): Promise<void> {
    try {
      this.logger.log(
        `[ACP Back] setupAgentStream: config=${JSON.stringify(config)}, sessionId=${options.sessionId}, requestId=${
          options.requestId ?? '(empty)'
        }`,
      );

      let sessionId = options.sessionId;
      if (!sessionId) {
        this.logger.log(
          `[ACP Back] setupAgentStream: no sessionId, creating session for requestId=${options.requestId ?? '(empty)'}`,
        );
        const result = await this.agentService.createSession(config);
        sessionId = result.sessionId;
        this.logger.log(
          `[ACP Back] setupAgentStream: created sessionId=${sessionId}, requestId=${options.requestId ?? '(empty)'}`,
        );
      }

      const request: AgentRequest = {
        sessionId,
        prompt: input,
        images: options.images,
        history: convertMessageHistory(options.history),
      };

      this.logger.log(
        `[ACP Back] setupAgentStream: sending message, sessionId=${sessionId}, requestId=${
          options.requestId ?? '(empty)'
        }, promptChars=${input.length}`,
      );

      const agentStream = this.agentService.sendMessage(request, config);
      const toolCallCache = new Map<string, IChatToolCall>();
      const deliveryMode = this.getAcpDeliveryMode(options);
      const lastThreadStatusRef: { current?: ThreadStatus } = {};
      let agentUpdateCount = 0;
      let hasLoggedFirstContent = false;
      let bufferedFinalContent = '';
      let discardedByCancellation = false;

      cancelToken?.onCancellationRequested(async () => {
        this.logger.warn(
          `[ACP Back] setupAgentStream: cancellation requested, sessionId=${sessionId}, requestId=${
            options.requestId ?? '(empty)'
          }`,
        );
        discardedByCancellation = true;
        await this.agentService.cancelRequest(sessionId);
        stream.end();
      });

      agentStream.onData((update: AgentUpdate) => {
        agentUpdateCount += 1;
        const shouldLogUpdate =
          !hasLoggedFirstContent || (update.type !== 'message' && update.type !== 'thought' && update.type !== 'done');
        if (shouldLogUpdate) {
          this.logger.log(
            `[ACP Back] agentStream onData: sessionId=${request.sessionId}, requestId=${
              options.requestId ?? '(empty)'
            }, type=${update.type}, count=${agentUpdateCount}, threadStatus=${update.threadStatus ?? '(empty)'}`,
          );
          hasLoggedFirstContent = true;
        }

        if (deliveryMode === 'minimal') {
          if (update.type === 'message') {
            bufferedFinalContent += update.content;
          }
          if (update.type === 'session_state') {
            const progress = this.convertAgentUpdateToChatProgress(update, toolCallCache);
            if (progress) {
              stream.emitData(progress);
            }
          }

          this.emitDistinctThreadStatus(stream, request.sessionId, update.threadStatus, lastThreadStatusRef);

          if (update.type === 'done') {
            this.logger.log(
              `[ACP Back] agentStream done: sessionId=${request.sessionId}, requestId=${
                options.requestId ?? '(empty)'
              }, updates=${agentUpdateCount}, deliveryMode=minimal, finalChars=${bufferedFinalContent.length}`,
            );
            if (!discardedByCancellation && bufferedFinalContent) {
              stream.emitData({ kind: 'content', content: bufferedFinalContent } as IChatContent);
            }
            stream.end();
          }
          return;
        }

        const progress = this.convertAgentUpdateToChatProgress(update, toolCallCache);
        if (progress) {
          stream.emitData(progress);
        }
        if (update.threadStatus) {
          // this.logger.log(
          //   `[ACP Back] agentStream threadStatus via stream: sessionId=${request.sessionId}, status=${update.threadStatus}`,
          // );
          stream.emitData({
            kind: 'threadStatus',
            threadStatus: update.threadStatus,
            sessionId: request.sessionId,
          } as IChatThreadStatus);
        }
        if (update.type === 'done') {
          this.logger.log(
            `[ACP Back] agentStream done: sessionId=${request.sessionId}, requestId=${
              options.requestId ?? '(empty)'
            }, updates=${agentUpdateCount}`,
          );
          stream.end();
        }
      });

      agentStream.onError((error) => {
        this.logger.error(
          `[ACP Back] agentStream onError: sessionId=${request.sessionId}, requestId=${
            options.requestId ?? '(empty)'
          }, updates=${agentUpdateCount}`,
          error,
        );
        stream.emitError(normalizeAcpError(error));
      });
    } catch (error) {
      this.logger.error(
        `[ACP Back] setupAgentStream catch: sessionId=${options.sessionId ?? '(empty)'}, requestId=${
          options.requestId ?? '(empty)'
        }`,
        error,
      );
      stream.emitError(normalizeAcpError(error));
    }
  }

  private getAcpDeliveryMode(options: IAIBackServiceOption): 'minimal' | 'stream' {
    return options.acpDeliveryMode === 'stream' ? 'stream' : 'minimal';
  }

  private emitDistinctThreadStatus(
    stream: SumiReadableStream<IChatProgress>,
    sessionId: string,
    status: ThreadStatus | undefined,
    lastStatusRef: { current?: ThreadStatus },
  ): void {
    if (!status || status === lastStatusRef.current) {
      return;
    }
    lastStatusRef.current = status;
    stream.emitData({
      kind: 'threadStatus',
      threadStatus: status,
      sessionId,
    } as IChatThreadStatus);
  }

  private convertAgentUpdateToChatProgress(
    update: AgentUpdate,
    toolCallCache: Map<string, IChatToolCall>,
  ): IChatProgress | null {
    switch (update.type) {
      case 'thought':
        return {
          kind: 'reasoning',
          content: update.content,
        } as IChatReasoning;
      case 'message':
        return {
          kind: 'content',
          content: update.content,
        } as IChatContent;
      case 'session_state':
        return {
          kind: 'sessionState',
          sessionId: update.sessionId || '',
          ...(update.currentModeId !== undefined ? { currentModeId: update.currentModeId } : {}),
          ...(update.currentModelId !== undefined ? { currentModelId: update.currentModelId } : {}),
          ...(update.configOptions !== undefined ? { configOptions: update.configOptions } : {}),
          ...(update.availableCommands !== undefined ? { availableCommands: update.availableCommands } : {}),
        } as IChatSessionState;
      case 'tool_call': {
        const toolCall: IChatToolCall = {
          id: update.toolCall?.toolCallId || '',
          type: 'function',
          function: {
            name: update.toolCall?.name || update.content,
            arguments: update.toolCall?.input !== undefined ? JSON.stringify(update.toolCall.input) ?? '' : '',
          },
          state: 'complete',
        };
        if (toolCall.id) {
          toolCallCache.set(toolCall.id, toolCall);
        }
        return {
          kind: 'toolCall',
          content: toolCall,
        } as IChatToolContent;
      }
      case 'tool_call_status': {
        const label = update.toolCall?.name || 'tool';
        const statusLabel = update.toolCall?.status === 'in_progress' ? `${label} is running...` : update.content;
        return {
          kind: 'content',
          content: statusLabel,
        } as IChatContent;
      }
      case 'tool_call_args': {
        const toolCallId = update.toolCall?.toolCallId;
        const cached = toolCallId ? toolCallCache.get(toolCallId) : undefined;
        if (!toolCallId || !cached) {
          return null;
        }
        const updated: IChatToolCall = {
          ...cached,
          function: {
            ...cached.function,
            arguments: JSON.stringify(update.toolCall?.input) ?? '',
          },
        };
        toolCallCache.set(toolCallId, updated);
        return {
          kind: 'toolCall',
          content: updated,
        } as IChatToolContent;
      }
      case 'tool_result': {
        const toolCallId = update.toolCall?.toolCallId;
        if (toolCallId) {
          const cached = toolCallCache.get(toolCallId);
          const updated: IChatToolCall = cached
            ? {
                ...cached,
                result: update.content,
                state: 'result',
              }
            : {
                id: toolCallId,
                type: 'function',
                function: {
                  name: update.toolCall?.name || '',
                  arguments: '',
                },
                result: update.content,
                state: 'result',
              };
          toolCallCache.set(toolCallId, updated);
          return {
            kind: 'toolCall',
            content: updated,
          } as IChatToolContent;
        }
        return {
          kind: 'content',
          content: update.content,
        } as IChatContent;
      }
      case 'plan':
        return {
          kind: 'content',
          content: update.content,
        } as IChatContent;
      case 'done':
        return null;
      case 'thread_status':
        // Handled separately via update.threadStatus below
        return null;
      default:
        return null;
    }
  }

  async loadAgentSession(config: AgentProcessConfig, sessionId: string) {
    try {
      const result = await this.agentService.loadSession(sessionId, config);
      const messages = this.convertSessionUpdatesToMessages(result.historyUpdates);
      return {
        sessionId: result.sessionId,
        messages,
        modes: result.modes,
        currentModeId: result.currentModeId,
        models: result.models,
        currentModelId: result.currentModelId,
        configOptions: result.configOptions,
      };
    } catch (error) {
      const errorMessage = getAcpErrorMessage(error);
      this.logger.error(`Failed to load session ${sessionId}:`, errorMessage);

      // 抛出错误，让调用方感知实际错误
      throw new Error(`Failed to load session ${sessionId}: ${errorMessage}`);
    }
  }

  private convertSessionUpdatesToMessages(
    updates: SessionNotification[],
  ): Array<{ role: 'user' | 'assistant'; content: string; timestamp?: number }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: number }> = [];

    for (const notification of updates) {
      const update = notification.update as any;
      if (!update) {
        continue;
      }

      switch (update.sessionUpdate) {
        case 'user_message_chunk': {
          const content = update.content;
          if (content?.type === 'text') {
            messages.push({
              role: 'user',
              content: content.text,
            });
          }
          break;
        }
        case 'agent_message_chunk': {
          const content = update.content;
          if (content?.type === 'text') {
            messages.push({
              role: 'assistant',
              content: content.text,
            });
          }
          break;
        }
        default:
          break;
      }
    }

    return messages;
  }

  async disposeSession(sessionId: string): Promise<void> {
    await this.cancelSession(sessionId);
    try {
      await this.agentService.disposeSession(sessionId);
    } catch (error) {
      this.logger.error(`Failed to release terminals for session ${sessionId}:`, error);
    }
  }

  async cancelSession(sessionId: string): Promise<void> {
    await this.agentService.cancelRequest(sessionId);
  }

  async setSessionMode(sessionId: string, modeId: string): Promise<void> {
    const modeRequest: SetSessionModeRequest = {
      sessionId,
      modeId,
    };
    try {
      await this.agentService.setSessionMode(modeRequest);
    } catch (error) {
      this.logger.error(`Failed to switch mode to ${modeId}:`, error);
      throw error;
    }
  }

  async createSession(config: AgentProcessConfig) {
    this.logger.log('[ACP Back] createSession called');
    return this.agentService.createSession(config);
  }

  async listSessions(config: AgentProcessConfig): Promise<ListSessionsResponse> {
    this.logger.log(`[ACP Back] listSessions called, cwd=${config?.cwd}`);
    return this.agentService.listSessions(config?.cwd ? { cwd: config.cwd } : undefined, config);
  }

  async dispose(): Promise<void> {
    if (this.isDisposing) {
      return;
    }
    this.isDisposing = true;
    await this.agentService.dispose();
  }

  /**
   * 检查默认 rpc 是否就绪，直接返回true
   */
  async ready(): Promise<boolean> {
    return true;
  }

  async loadSessionOrNew(config: AgentProcessConfig, sessionId: string) {
    const result = await this.agentService.loadSessionOrNew(sessionId, config);
    const messages = this.convertSessionUpdatesToMessages(result.historyUpdates);
    return {
      sessionId: result.sessionId,
      messages,
      modes: result.modes,
      currentModeId: result.currentModeId,
      models: result.models,
      currentModelId: result.currentModelId,
      configOptions: result.configOptions,
    };
  }

  async setSessionConfigOption(sessionId: string, configId: string, value: boolean | string): Promise<void> {
    await this.agentService.setSessionConfigOption({ sessionId, configId, value });
  }

  async forkSession(
    sessionId: string,
    options?: { cwd?: string; mcpServers?: McpServer[] },
  ): Promise<{ sessionId: string }> {
    return this.agentService.forkSession({ sessionId, ...options });
  }

  async resumeSession(sessionId: string, cwd?: string): Promise<void> {
    await this.agentService.resumeSession({ sessionId, cwd });
  }

  async closeSession(sessionId: string): Promise<void> {
    await this.agentService.closeSession({ sessionId });
  }

  async setSessionModel(sessionId: string, model: string): Promise<void> {
    await this.agentService.setSessionModel({ sessionId, model });
  }

  async getAcpDebugLog() {
    return this.agentService.getAcpDebugLog();
  }

  async clearAcpDebugLog(): Promise<void> {
    await this.agentService.clearAcpDebugLog();
  }
}

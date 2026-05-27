import { Autowired, Injectable } from '@opensumi/di';
import {
  AvailableCommand,
  CancellationToken,
  IAIBackService,
  IAIBackServiceOption,
  IAIBackServiceResponse,
  IChatContent,
  IChatProgress,
  IChatReasoning,
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
import { normalizeAcpError } from './acp-error';
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

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  @Autowired(OpenAICompatibleModel)
  private openAICompatibleModel: OpenAICompatibleModel;

  @Autowired(AcpThreadStatusCallerServiceToken)
  private threadStatusCaller: any;

  private isDisposing = false;

  private threadStatusDisposable: any;

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
    return {
      errorCode: -1,
      errorMsg: 'request() is not supported. ',
    } as IAIBackServiceResponse;
  }

  async requestStream(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<SumiReadableStream<IChatProgress>> {
    this.logger.log(
      `[ACP Back] requestStream: hasAgentSessionConfig=${!!options.agentSessionConfig}, apiKey=${
        options.apiKey ? options.apiKey.slice(0, 8) + '***' : '(empty)'
      }, baseURL=${options.baseURL}, sessionId=${options.sessionId}`,
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
    this.logger.log('[ACP Back] agentRequestStream: setting up agent stream');
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
      this.logger.log(`[ACP Back] setupAgentStream: config=${JSON.stringify(config)}, sessionId=${options.sessionId}`);

      let sessionId = options.sessionId;
      if (!sessionId) {
        const result = await this.agentService.createSession(config);
        sessionId = result.sessionId;
      }

      const request: AgentRequest = {
        sessionId,
        prompt: input,
        images: options.images,
        history: convertMessageHistory(options.history),
      };

      this.logger.log(`[ACP Back] setupAgentStream: sending message, prompt=${input.slice(0, 100)}...`);

      const agentStream = this.agentService.sendMessage(request, config);

      cancelToken?.onCancellationRequested(async () => {
        await this.agentService.cancelRequest(sessionId);
        stream.end();
      });

      agentStream.onData((update: AgentUpdate) => {
        // this.logger.log(`[ACP Back] agentStream onData: type=${update.type}`);
        const progress = this.convertAgentUpdateToChatProgress(update);
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
          stream.end();
        }
      });

      agentStream.onError((error) => {
        this.logger.error('[ACP Back] agentStream onError:', error);
        stream.emitError(normalizeAcpError(error));
      });
    } catch (error) {
      this.logger.error('[ACP Back] setupAgentStream catch:', error);
      stream.emitError(normalizeAcpError(error));
    }
  }

  private convertAgentUpdateToChatProgress(update: AgentUpdate): IChatProgress | null {
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
      case 'tool_call': {
        const toolCall: IChatToolCall = {
          id: update.toolCall?.toolCallId || '',
          type: 'function',
          function: {
            name: update.toolCall?.name || update.content,
            arguments: update.toolCall?.input ? JSON.stringify(update.toolCall.input) : '',
          },
        };
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
      case 'tool_result': {
        // If toolCall info is available, use it; otherwise just show content
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

  async loadAgentSession(
    config: AgentProcessConfig,
    sessionId: string,
  ): Promise<{
    sessionId: string;
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp?: number;
    }>;
  }> {
    try {
      const result = await this.agentService.loadSession(sessionId, config);
      const messages = this.convertSessionUpdatesToMessages(result.historyUpdates);
      return {
        sessionId,
        messages,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
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

  async createSession(config: AgentProcessConfig): Promise<{
    sessionId: string;
    availableCommands: AvailableCommand[];
  }> {
    this.logger.log('[ACP Back] createSession called');
    return this.agentService.createSession(config);
  }

  async listSessions(config: AgentProcessConfig): Promise<ListSessionsResponse> {
    this.logger.log(`[ACP Back] listSessions called, cwd=${config?.cwd}`);
    return this.agentService.listSessions(config?.cwd ? { cwd: config.cwd } : undefined);
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

  async loadSessionOrNew(
    config: AgentProcessConfig,
    sessionId: string,
  ): Promise<{
    sessionId: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: number }>;
  }> {
    const result = await this.agentService.loadSessionOrNew(sessionId, config);
    const messages = this.convertSessionUpdatesToMessages(result.historyUpdates);
    return { sessionId, messages };
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
}

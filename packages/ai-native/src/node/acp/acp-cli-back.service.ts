import { Autowired, Injectable } from '@opensumi/di';
import {
  CancellationToken,
  IAIBackService,
  IAIBackServiceOption,
  IAIBackServiceResponse,
  IChatContent,
  IChatProgress,
  IChatReasoning,
  ListSessionsRequest,
  ListSessionsResponse,
  SessionNotification,
  SetSessionModeRequest,
} from '@opensumi/ide-core-common';
import { AgentProcessConfig } from '@opensumi/ide-core-common/lib/types/ai-native/agent-types';
import { INodeLogger } from '@opensumi/ide-core-node';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

import {
  AcpAgentServiceToken,
  AgentRequest,
  AgentSessionInfo,
  AgentUpdate,
  IAcpAgentService,
  SimpleMessage,
} from './acp-agent.service';

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

  private isDisposing = false;

  // private registerProcessExitHandlers(): void {
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

  async createSession(config: AgentProcessConfig): Promise<{ sessionId: string }> {
    await this.ensureAgentInitialized(config);
    return this.agentService.createSession(config);
  }

  private async ensureAgentInitialized(config: AgentProcessConfig): Promise<AgentSessionInfo> {
    const existingSession = this.agentService.getSessionInfo();
    if (existingSession) {
      return existingSession;
    }
    return this.agentService.initializeAgent(config);
  }

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
    return this.agentRequestStream(input, options, cancelToken);
  }

  private agentRequestStream(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): SumiReadableStream<IChatProgress> {
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
      if (!options.agentSessionConfig) {
        throw Error('agentSessionConfig is required');
      }

      const sessionInfo = await this.ensureAgentInitialized(options.agentSessionConfig);
      const sessionId = options.sessionId || sessionInfo.sessionId;

      const request: AgentRequest = {
        sessionId,
        prompt: input,
        images: options.images,
        history: convertMessageHistory(options.history),
      };

      const agentStream = this.agentService.sendMessage(request, config);

      cancelToken?.onCancellationRequested(async () => {
        await this.agentService.cancelRequest(sessionId);
        stream.end();
      });

      agentStream.onData((update: AgentUpdate) => {
        const progress = this.convertAgentUpdateToChatProgress(update);
        if (progress) {
          stream.emitData(progress);
        }
        if (update.type === 'done') {
          stream.end();
        }
      });

      agentStream.onError((error) => {
        stream.emitError(error instanceof Error ? error : new Error(String(error)));
      });
    } catch (error) {
      stream.emitError(error instanceof Error ? error : new Error(String(error)));
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
      case 'tool_call':
        return null;
      case 'tool_result':
        return {
          kind: 'content',
          content: update.content,
        } as IChatContent;
      case 'done':
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

  async listSessions(config: AgentProcessConfig): Promise<ListSessionsResponse> {
    const listParams: ListSessionsRequest = {
      cwd: config.workspaceDir,
    };
    await this.ensureAgentInitialized(config);

    try {
      const response = await this.agentService.listSessions(listParams);
      return {
        sessions: response.sessions,
        nextCursor: response.nextCursor,
      };
    } catch (error) {
      this.logger.error('Failed to list sessions:', error);
      throw error;
    }
  }

  async dispose(): Promise<void> {
    this.logger?.log('[AcpCliBackService] Already disposin');
    if (this.isDisposing) {
      this.logger?.log('[AcpCliBackService] Already disposing, skipping...');
      return;
    }
    this.isDisposing = true;
    await this.agentService.dispose();
    this.logger?.log('[AcpCliBackService] Disposed successfully');
  }

  /**
   * 检查默认 rpc 是否就绪，直接返回true
   */
  async ready(): Promise<boolean> {
    return true;
  }
}

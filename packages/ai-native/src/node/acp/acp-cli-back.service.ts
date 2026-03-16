import { Autowired, Injectable } from '@opensumi/di';
import {
  CancellationToken,
  IAIBackService,
  IAIBackServiceOption,
  IAIBackServiceResponse,
  IChatContent,
  IChatProgress,
  IChatReasoning,
} from '@opensumi/ide-core-common';
import { INodeLogger } from '@opensumi/ide-core-node';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

import { AgentProcessConfig } from '../../common';

import {
  AcpAgentServiceToken,
  AgentRequest,
  AgentSessionInfo,
  AgentUpdate,
  IAcpAgentService,
  SimpleMessage,
} from './acp-agent.service';
import { AcpTerminalHandler } from './handlers/terminal.handler';

import type { ListSessionsRequest, SessionNotification, SetSessionModeRequest } from '../../common/acp-types';
import type { CoreMessage } from 'ai';

export const AcpCliBackServiceToken = Symbol('AcpCliBackServiceToken');

/**
 * 将 CoreMessage 转换为 SimpleMessage
 */
function convertToSimpleMessage(msg?: CoreMessage): SimpleMessage {
  if (!msg) {
    return {
      role: 'user',
      content: '',
    };
  }
  let content: string;
  if (typeof msg?.content === 'string') {
    content = msg?.content;
  } else if (Array.isArray(msg?.content)) {
    content = msg?.content
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('\n');
  } else {
    content = String(msg?.content);
  }
  return {
    role: msg?.role,
    content,
  };
}

/**
 * 批量转换消息历史
 */
function convertMessageHistory(history?: CoreMessage[]): SimpleMessage[] | undefined {
  if (!history) {
    return undefined;
  }
  if (history[0] === null) {
    return undefined;
  }
  return history.map(convertToSimpleMessage);
}

@Injectable()
export class AcpCliBackService implements IAIBackService {
  @Autowired(AcpAgentServiceToken)
  private agentService: IAcpAgentService;

  @Autowired(AcpTerminalHandler)
  private terminalHandler: AcpTerminalHandler;

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  private isDisposing = false;

  private registerProcessExitHandlers(): void {
    // 监听 SIGTERM 信号（服务进程终止前）
    process.once('SIGTERM', () => {
      this.logger?.log('[AcpCliBackService] Received SIGTERM, cleaning up agent processes...');
      this.dispose().then(() => {
        process.exit(0);
      });
    });

    // 监听 SIGINT 信号（Ctrl+C）
    process.once('SIGINT', () => {
      this.logger?.log('[AcpCliBackService] Received SIGINT, cleaning up agent processes...');
      this.dispose().then(() => {
        process.exit(0);
      });
    });

    // 注意：不监听 beforeExit、uncaughtException 和 unhandledRejection
    // 因为这些事件可能在服务正常运行时触发，导致 ACP 服务被意外 dispose
  }

  createSession(config: AgentProcessConfig): Promise<{ sessionId: string }> {
    // 确保 Agent 已初始化后再创建会话
    return this.createSessionWithEnsure(config);
  }

  /**
   * 创建新会话（确保 Agent 已初始化）
   */
  private async createSessionWithEnsure(config: AgentProcessConfig): Promise<{ sessionId: string }> {
    // 先确保 Agent 已初始化
    await this.ensureAgentInitialized(config);
    // 调用 agentService 创建会话

    const result = await this.agentService.createSession(config);

    return result;
  }

  /**
   * 确保 Agent 进程已初始化
   * @param sessionId - 可选的已有 Session ID，如果指定则加载该 Session 而不是创建新 Session
   */
  private async ensureAgentInitialized(config: AgentProcessConfig): Promise<AgentSessionInfo> {
    // 检查是否已初始化
    const existingSession = this.agentService.getSessionInfo();
    if (existingSession) {
      return existingSession;
    }

    const sessionInfo = await this.agentService.initializeAgent({
      ...config,
    });

    // 初始化完成后再次检查状态

    return sessionInfo;
  }

  // /**
  //  * 提前初始化 ACP Agent（chat 面板打开时调用）
  //  * 返回 Agent 支持的 modes 列表等初始信息
  //  */
  // async initializeAgent(): Promise<{
  //   sessionId: string;
  //   modes: Array<{ id: string; name: string; description?: string }>;
  // }> {
  //   const sessionInfo = await this.ensureAgentInitialized();

  //   // sessionInfo.modes 可能为空（缓存中遗留的旧数据）
  //   // fallback 到 agentService.getAvailableModes() 获取 initialize 响应中存储的 modes
  //   let modes = sessionInfo.modes;
  //   if (!modes || modes.length === 0) {
  //     const sessionModes = this.agentService.getAvailableModes();
  //     if (sessionModes?.availableModes?.length) {
  //       modes = sessionModes.availableModes;
  //       // 同步更新缓存，避免后续调用再次走 fallback
  //       sessionInfo.modes = modes;
  //     }
  //   }

  //   return {
  //     sessionId: sessionInfo.sessionId,
  //     modes: modes.map((m) => ({
  //       id: m.id,
  //       name: m.name,
  //       description: m.description ?? undefined,
  //     })),
  //   };
  // }

  /**
   * Send a single request and get response (non-streaming)
   */
  async request(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<IAIBackServiceResponse> {
    // TODO requst在在行内补全之类的使用。暂时先不实现
    return '' as unknown as IAIBackServiceResponse;
  }

  /**
   * Send a request and stream the response
   */
  async requestStream(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): Promise<SumiReadableStream<IChatProgress>> {
    return this.agentRequestStream(input, options, cancelToken);
  }

  /**
   * Agent 模式流式请求
   */
  private agentRequestStream(
    input: string,
    options: IAIBackServiceOption,
    cancelToken?: CancellationToken,
  ): SumiReadableStream<IChatProgress> {
    const stream = new SumiReadableStream<IChatProgress>();

    // 异步初始化 Agent 并设置流，不阻塞 stream 返回
    this.setupAgentStream(options.agentSessionConfig!, input, options, stream, cancelToken);
    // 立即返回 stream
    return stream;
  }

  /**
   * 异步设置 Agent 流（内部使用）
   */
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
      // 确保 Agent 进程已初始化
      const sessionInfo = await this.ensureAgentInitialized(options.agentSessionConfig);

      const sessionId = options.sessionId || sessionInfo.sessionId;

      const request: AgentRequest = {
        sessionId,
        prompt: input,
        images: options.images,
        history: convertMessageHistory(options.history),
      };

      // 发送请求获取流
      const agentStream = this.agentService.sendMessage(request, config);
      // 设置取消监听
      cancelToken?.onCancellationRequested(async () => {
        await this.agentService.cancelRequest(sessionId);
        stream.end();
      });

      // 将 Agent 更新转换为 IChatProgress 并转发
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

  /**
   * 将 AgentUpdate 转换为 IChatProgress
   */
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

  /**
   * 从 ACP Agent 加载已有 Session
   * 供前端 ChatManagerService 调用
   * @param config AgentProcessConfig 配置
   * @param sessionId Agent 的 Session ID（如 'sess_789xyz'）
   * @returns 标准化的会话消息列表
   */
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
      // 调用 AgentService 加载 Session
      // loadSession 内部会自动初始化 Agent（如果未初始化）
      const result = await this.agentService.loadSession(sessionId, config);

      // 转换 SessionNotification 为标准消息格式
      const messages = this.convertSessionUpdatesToMessages(result.historyUpdates);

      return {
        sessionId,
        messages,
      };
    } catch (error) {
      // 如果是新创建的空 Session，loadSession 可能会失败（ACP Agent 不支持加载空 Session）
      // 这种情况下，返回空消息列表而不是抛出异常，让前端看到一个新的空白 Session
      if (error?.message?.includes('Resource')) {
        return {
          sessionId,
          messages: [],
        };
      }
      return {
        sessionId,
        messages: [],
      };
    }
  }

  /**
   * 将 SessionNotification 数组转换为标准消息格式
   */
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

        // 其他类型的 update 可根据需要处理
        // case 'tool_call':
        // case 'tool_call_update':
        // case 'agent_thought_chunk':
        //   ...

        default:
          // 忽略其他类型
          break;
      }
    }

    return messages;
  }

  /**
   * Clean up a session
   */
  async disposeSession(sessionId: string): Promise<void> {
    // Cancel any active operations
    await this.cancelSession(sessionId);

    // Release all terminals associated with this session
    try {
      await this.terminalHandler.releaseSessionTerminals(sessionId);
    } catch (error) {
      this.logger.error(`Failed to release terminals for session ${sessionId}:`, error);
    }
  }

  /**
   * Cancel session operations
   */
  async cancelSession(sessionId: string): Promise<void> {
    await this.agentService.cancelRequest(sessionId);
  }

  /**
   * Switch the mode of a session (ask/code/architect)
   */
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

  /**
   * 列出所有 ACP Agent 会话
   * @param params 可选的过滤和分页参数
   */
  async listSessions(config: AgentProcessConfig): Promise<{
    sessions: Array<{
      sessionId: string;
      cwd: string;
      title?: string;
      updatedAt?: string;
      _meta?: {
        messageCount?: number;
        hasErrors?: boolean;
      };
    }>;
    nextCursor?: string;
  }> {
    const listParams: ListSessionsRequest = {
      cwd: config.workspaceDir,
    };
    // 只需要确保 Agent 已初始化，不需要指定 sessionId
    await this.ensureAgentInitialized(config);

    try {
      const response = await this.agentService.listSessions(listParams);

      return {
        sessions: response.sessions as any,
        nextCursor: response.nextCursor as any,
      };
    } catch (error) {
      this.logger.error('Failed to list sessions:', error);
      throw error;
    }
  }

  /**
   * Dispose all sessions and clean up
   */
  async dispose(): Promise<void> {
    if (this.isDisposing) {
      this.logger?.log('[AcpCliBackService] Already disposing, skipping...');
      return;
    }
    this.isDisposing = true;

    // agentService.dispose() 内部已包含 clientService.close() + processManager.killAllAgents()
    await this.agentService.dispose();

    this.logger?.log('[AcpCliBackService] Disposed successfully');
  }
}

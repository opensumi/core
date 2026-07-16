import { Autowired, Injectable } from '@opensumi/di';
import {
  AIBackSerivcePath,
  AgentProcessConfig,
  ChatMessageRole,
  Domain,
  IACPConfigProvider,
  IAIBackService,
  IChatProgress,
  IChatSessionSnapshot,
  IChatToolCall,
  SessionNotification,
  ThreadStatus,
} from '@opensumi/ide-core-common';
import { IMessageService } from '@opensumi/ide-overlay';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';
import { MarkdownString } from '@opensumi/monaco-editor-core/esm/vs/base/common/htmlContent';

import { AgenticTaskRegistryService } from '../acp/agentic-task-registry.service';

import { IChatProgressResponseContent } from './chat-model';
import {
  ISessionModel,
  ISessionModelExtension,
  ISessionProvider,
  SessionCreationOptions,
  SessionProviderDomain,
  isAcpResponsePending,
} from './session-provider';

const DEFAULT_ACP_CHAT_AGENT_ID = 'Default_Chat_Agent';

/**
 * ACP Session Provider
 * 通过 RPC 调用 Node 层加载 ACP Agent 的 Session
 */
@Domain(SessionProviderDomain)
@Injectable()
export class ACPSessionProvider implements ISessionProvider {
  readonly id = 'ACPSessionProvider';

  @Autowired(AIBackSerivcePath)
  private aiBackService: IAIBackService;

  @Autowired(IACPConfigProvider)
  private configProvider: IACPConfigProvider;

  @Autowired(IMessageService)
  protected messageService: IMessageService;

  @Autowired(AgenticTaskRegistryService)
  private agenticTaskRegistry: AgenticTaskRegistryService;

  private loadedSessionMap: Map<string, ISessionModel> = new Map();

  private loadedSessionsResult: ISessionModel[] | null = null;

  private loadingSessionsPromise: Promise<ISessionModel[]> | null = null;

  private didRetryEmptySessionsResult = false;

  canHandle(mode: string): boolean {
    return mode.startsWith('acp');
  }

  async createSession(options?: SessionCreationOptions): Promise<ISessionModel> {
    if (!this.aiBackService?.createSession) {
      throw new Error('aiBackService.createSession is not available');
    }

    try {
      const config =
        options?.acpTarget && this.configProvider.resolveConfigForTarget
          ? await this.configProvider.resolveConfigForTarget(options.acpTarget)
          : await this.configProvider.resolveConfig();
      const result = (await this.aiBackService.createSession(config)) as any;

      if (!result?.sessionId) {
        throw new Error('createSession did not return a valid sessionId');
      }

      // 构造本地 Session ID（添加 acp: 前缀）
      const sessionId = `acp:${result.sessionId}`;
      const createdAt = Date.now();

      // 构造空壳会话模型
      const sessionModel: ISessionModel & { extension?: ISessionModelExtension } = {
        sessionId,
        createdAt,
        modelId: result.currentModelId,
        agentModes: result.modes,
        currentModeId: result.currentModeId,
        agentModels: result.models,
        configOptions: result.configOptions,
        history: {
          additional: {},
          messages: [],
        },
        requests: [],
        title: '',
        ...(result.availableCommands?.length ? { extension: { availableCommands: result.availableCommands } } : {}),
      };

      // 新创建的 Session 不需要 load，直接加入缓存
      this.loadedSessionMap.set(sessionId, sessionModel);

      return sessionModel;
    } catch (e) {
      this.messageService.error(e.message);
      throw e;
    }
  }

  async loadSessions(): Promise<ISessionModel[]> {
    if (Array.isArray(this.loadedSessionsResult)) {
      return this.loadedSessionsResult;
    }

    if (this.loadingSessionsPromise) {
      return this.loadingSessionsPromise;
    }

    this.loadingSessionsPromise = this.doLoadSessions();
    try {
      return await this.loadingSessionsPromise;
    } finally {
      this.loadingSessionsPromise = null;
    }
  }

  private async doLoadSessions(): Promise<ISessionModel[]> {
    if (!this.aiBackService?.listSessions) {
      this.loadedSessionsResult = [];
      return this.loadedSessionsResult;
    }

    try {
      const config = await this.configProvider.resolveConfig();
      const result = await this.aiBackService!.listSessions(config);

      if (!result?.sessions?.length) {
        // The Agentic shell may ask for history before the ACP process has a thread.
        // Leave the first empty result retryable, then cache a confirmed empty history.
        if (!this.didRetryEmptySessionsResult) {
          this.didRetryEmptySessionsResult = true;
          return [];
        }
        this.loadedSessionsResult = [];
        return this.loadedSessionsResult;
      }

      // 只返回会话列表的元数据，不加载完整数据
      // 完整数据在 getSession 时通过 loadSession 按需加载
      const sessionModels = result.sessions
        .slice(0, 20)
        .reverse()
        .map((sessionMeta) => ({
          ...sessionMeta,
          sessionId: `acp:${sessionMeta.sessionId}`,
          history: {
            additional: {},
            messages: [],
          },
          requests: [],
          title: sessionMeta.title,
        }));

      this.loadedSessionsResult = sessionModels as unknown as ISessionModel[];
      this.didRetryEmptySessionsResult = false;

      return this.loadedSessionsResult;
    } catch (e) {
      this.messageService.error(e.message);
      return [];
    }
  }

  async loadSession(sessionId: string): Promise<ISessionModel | undefined> {
    if (!sessionId) {
      return undefined;
    }

    if (!this.aiBackService?.loadAgentSession) {
      return undefined;
    }

    // 解析 sessionId，提取 agentSessionId（去掉 'acp:' 前缀）
    const agentSessionId = sessionId.startsWith('acp:') ? sessionId.slice(4) : sessionId;

    try {
      const config = await this.resolveSessionConfig(sessionId);
      const agentSession = (await this.aiBackService.loadAgentSession(config, agentSessionId)) as any;

      if (!agentSession) {
        return undefined;
      }

      // 将 Agent Session 转换为 ISessionModel 格式
      const sessionModel = this.convertAgentSessionToModel(sessionId, agentSession);

      // 缓存加载的 Session
      this.loadedSessionMap.set(sessionId, sessionModel);

      return sessionModel;
    } catch (error) {
      // 不在 provider 层弹错误提示，将异常抛给调用方统一处理（如 activateSession 会自动创建新会话）
      throw error;
    }
  }

  async attachSession(sessionId: string): Promise<SumiReadableStream<IChatProgress> | undefined> {
    if (!sessionId || !this.aiBackService?.attachSession) {
      return undefined;
    }
    const agentSessionId = sessionId.startsWith('acp:') ? sessionId.slice(4) : sessionId;
    return this.aiBackService.attachSession(agentSessionId);
  }

  restoreSessionSnapshot(sessionId: string, snapshot: IChatSessionSnapshot): ISessionModel | undefined {
    if (snapshot.historyUpdates.length === 0) {
      return undefined;
    }
    return this.convertAgentSessionToModel(sessionId, {
      sessionId: snapshot.sessionId,
      modes: snapshot.modes,
      currentModeId: snapshot.currentModeId,
      models: snapshot.models,
      currentModelId: snapshot.currentModelId,
      configOptions: snapshot.configOptions,
      threadStatus: snapshot.threadStatus,
      historyUpdates: snapshot.historyUpdates,
      messages: [],
    });
  }

  private async resolveSessionConfig(sessionId: string): Promise<AgentProcessConfig> {
    const task = await this.agenticTaskRegistry?.getTask(sessionId);
    if (!task) {
      return this.configProvider.resolveConfig();
    }

    const project = await this.agenticTaskRegistry.getProject(task.projectId);
    if (!project || !this.configProvider.resolveConfigForTarget) {
      throw new Error('Agent Task cannot resolve its stored ACP target');
    }

    return this.configProvider.resolveConfigForTarget({ agentId: task.agentId, cwd: project.workspacePath });
  }

  private convertAgentSessionToModel(
    sessionId: string,
    agentSession: {
      sessionId: string;
      modes?: ISessionModel['agentModes'];
      currentModeId?: string;
      models?: ISessionModel['agentModels'];
      currentModelId?: string;
      configOptions?: ISessionModel['configOptions'];
      threadStatus?: ThreadStatus;
      historyUpdates?: SessionNotification[];
      messages: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp?: number;
      }>;
    },
  ): ISessionModel {
    const historyUpdates = agentSession.historyUpdates;
    if (historyUpdates?.length) {
      return this.convertHistoryUpdatesToModel(sessionId, { ...agentSession, historyUpdates });
    }

    // 过滤掉包含 <command-name> 或 <local-command-stdout> 的系统消息
    const filteredMessages = agentSession.messages.filter((msg, index) => {
      // 如果内容包含系统命令的 XML 标签，则过滤掉
      if (msg.content.includes('<command-name>') || msg.content.includes('<local-command-stdout>')) {
        return false;
      }
      return true;
    });

    // 转换消息格式
    const messages = filteredMessages.map((msg, index) => ({
      id: `${sessionId}-msg-${index}`,
      role: msg.role === 'user' ? 1 : 2, // ChatMessageRole.User = 1, Assistant = 2
      content: msg.content,
      order: index,
      timestamp: msg.timestamp,
    }));

    const result = {
      sessionId,
      createdAt: messages[0]?.timestamp,
      modelId: agentSession.currentModelId,
      agentModes: agentSession.modes,
      currentModeId: agentSession.currentModeId,
      agentModels: agentSession.models,
      configOptions: agentSession.configOptions,
      history: {
        additional: {},
        messages,
      },
      requests: [],
    };

    return result;
  }

  private convertHistoryUpdatesToModel(
    sessionId: string,
    agentSession: {
      modes?: ISessionModel['agentModes'];
      currentModeId?: string;
      models?: ISessionModel['agentModels'];
      currentModelId?: string;
      configOptions?: ISessionModel['configOptions'];
      threadStatus?: ThreadStatus;
      historyUpdates: SessionNotification[];
    },
  ): ISessionModel {
    interface RestoredTurn {
      userContent: string;
      assistantContent: string;
      responseParts: IChatProgressResponseContent[];
      toolCalls: Map<string, IChatToolCall>;
    }

    const turns: RestoredTurn[] = [];
    let current: RestoredTurn | undefined;
    const ensureTurn = () => {
      if (!current) {
        current = {
          userContent: '',
          assistantContent: '',
          responseParts: [],
          toolCalls: new Map(),
        };
      }
      return current;
    };
    const flushTurn = () => {
      if (current && (current.userContent || current.responseParts.length > 0)) {
        turns.push(current);
      }
      current = undefined;
    };
    const appendMarkdown = (turn: RestoredTurn, text: string) => {
      const last = turn.responseParts[turn.responseParts.length - 1];
      if (last?.kind === 'markdownContent') {
        turn.responseParts[turn.responseParts.length - 1] = {
          kind: 'markdownContent',
          content: new MarkdownString(last.content.value + text, last.content),
        };
      } else {
        turn.responseParts.push({ kind: 'markdownContent', content: new MarkdownString(text) });
      }
      turn.assistantContent += text;
    };
    const appendReasoning = (turn: RestoredTurn, text: string) => {
      const last = turn.responseParts[turn.responseParts.length - 1];
      if (last?.kind === 'reasoning') {
        last.content += text;
      } else {
        turn.responseParts.push({ kind: 'reasoning', content: text.replace(/^<think>/, '') });
      }
    };

    for (const notification of agentSession.historyUpdates) {
      const update = notification.update as any;
      if (!update) {
        continue;
      }
      switch (update.sessionUpdate) {
        case 'user_message_chunk': {
          const text = update.content?.type === 'text' ? update.content.text : '';
          if (!text) {
            break;
          }
          if (current && (current.assistantContent || current.responseParts.length > 0)) {
            flushTurn();
          }
          ensureTurn().userContent += text;
          break;
        }
        case 'agent_message_chunk': {
          const text = update.content?.type === 'text' ? update.content.text : '';
          if (text) {
            appendMarkdown(ensureTurn(), text);
          }
          break;
        }
        case 'agent_thought_chunk': {
          const text = update.content?.type === 'text' ? update.content.text : '';
          if (text) {
            appendReasoning(ensureTurn(), text);
          }
          break;
        }
        case 'tool_call': {
          const turn = ensureTurn();
          const toolCall: IChatToolCall = {
            id: update.toolCallId || '',
            type: 'function',
            function: {
              name: update.title || update.toolCallId || '',
              arguments: JSON.stringify(update.rawInput ?? {}),
            },
            state: 'streaming-start',
          };
          turn.toolCalls.set(toolCall.id, toolCall);
          turn.responseParts.push({ kind: 'toolCall', content: toolCall });
          break;
        }
        case 'tool_call_update': {
          const turn = ensureTurn();
          const toolCall = turn.toolCalls.get(update.toolCallId);
          if (!toolCall) {
            break;
          }
          if (update.rawInput !== undefined) {
            toolCall.function.arguments = JSON.stringify(update.rawInput);
          }
          if (update.status === 'in_progress') {
            toolCall.state = 'streaming';
            break;
          }
          if (update.status !== 'completed' && update.status !== 'failed') {
            break;
          }
          if (update.rawOutput !== undefined) {
            toolCall.result =
              typeof update.rawOutput === 'string' ? update.rawOutput : JSON.stringify(update.rawOutput);
            toolCall.state = 'result';
          } else if (Array.isArray(update.content)) {
            const diff = update.content.find((item: any) => item?.type === 'diff');
            if (diff?.path) {
              toolCall.result = `Modified ${diff.path}`;
              toolCall.state = 'result';
            }
          } else if (update.status === 'failed') {
            toolCall.result = 'Tool failed';
            toolCall.state = 'result';
          } else {
            toolCall.state = 'complete';
          }
          break;
        }
        case 'plan': {
          const entries = update.plan?.entries ?? update.entries;
          if (Array.isArray(entries) && entries.length > 0) {
            appendMarkdown(
              ensureTurn(),
              `${entries
                .map((entry: any) =>
                  entry.completed || entry.status === 'completed' ? `- [x] ${entry.content}` : `- [ ] ${entry.content}`,
                )
                .join('\n')}\n\n`,
            );
          }
          break;
        }
        default:
          break;
      }
    }
    flushTurn();

    const messages: ISessionModel['history']['messages'] = [];
    const requests: ISessionModel['requests'] = [];
    turns.forEach((turn, index) => {
      const relationId = `${sessionId}-restored-relation-${index}`;
      const requestId = `${sessionId}-restored-request-${index}`;
      messages.push({
        id: `${sessionId}-restored-user-${index}`,
        role: ChatMessageRole.User,
        content: turn.userContent,
        order: messages.length,
        relationId,
        agentId: DEFAULT_ACP_CHAT_AGENT_ID,
        agentCommand: '',
        images: [],
      });
      messages.push({
        id: `${sessionId}-restored-assistant-${index}`,
        role: ChatMessageRole.Assistant,
        content: turn.assistantContent,
        order: messages.length,
        relationId,
        requestId,
        agentId: DEFAULT_ACP_CHAT_AGENT_ID,
        agentCommand: '',
        images: [],
      });
      requests.push({
        requestId,
        message: {
          prompt: turn.userContent,
          agentId: DEFAULT_ACP_CHAT_AGENT_ID,
          command: '',
          images: [],
        },
        response: {
          isComplete: index < turns.length - 1 || !isAcpResponsePending(agentSession.threadStatus),
          isCanceled: false,
          responseText: turn.assistantContent,
          responseContents: turn.responseParts,
          responseParts: turn.responseParts,
          errorDetails: undefined,
          followups: undefined,
        },
      });
    });

    return {
      sessionId,
      createdAt: undefined,
      modelId: agentSession.currentModelId,
      agentModes: agentSession.modes,
      currentModeId: agentSession.currentModeId,
      agentModels: agentSession.models,
      configOptions: agentSession.configOptions,
      history: { additional: {}, messages },
      requests,
    };
  }

  async saveSessions(sessions: ISessionModel[]): Promise<void> {}
}

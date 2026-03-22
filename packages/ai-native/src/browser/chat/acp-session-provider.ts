import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { AIBackSerivcePath, AgentProcessConfig, Domain, IAIBackService, URI } from '@opensumi/ide-core-common';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { getDefaultAgentType } from './get-default-agent-type';
import { ISessionModel, ISessionProvider, SessionProviderDomain } from './session-provider';

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

  @Autowired(IWorkspaceService)
  private workspaceService: IWorkspaceService;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  private loadedSessionMap: Map<string, ISessionModel> = new Map();

  private loadedSessionsResult: ISessionModel[] | null = null;

  canHandle(mode: string): boolean {
    return mode.startsWith('acp');
  }

  async createSession(title?: string): Promise<ISessionModel> {
    if (!this.aiBackService?.createSession) {
      throw new Error('aiBackService.createSession is not available');
    }

    await this.workspaceService.whenReady;
    const agentType = getDefaultAgentType(this.preferenceService);
    const result = await this.aiBackService.createSession({
      workspaceDir: new URI(this.workspaceService.workspace?.uri).codeUri.fsPath,
      agentType,
    });

    if (!result?.sessionId) {
      throw new Error('createSession did not return a valid sessionId');
    }

    // 构造本地 Session ID（添加 acp: 前缀）
    const sessionId = `acp:${result.sessionId}`;

    // 构造空壳会话模型
    const sessionModel: ISessionModel = {
      sessionId,
      history: {
        additional: {},
        messages: [],
      },
      requests: [],
      title: title || '',
    };

    // 新创建的 Session 不需要 load，直接加入缓存
    this.loadedSessionMap.set(sessionId, sessionModel);

    return sessionModel;
  }

  async loadSessions(): Promise<ISessionModel[]> {
    if (this.loadedSessionsResult) {
      return this.loadedSessionsResult;
    }

    if (!this.aiBackService?.listSessions) {
      return [];
    }

    await this.workspaceService.whenReady;
    const agentType = getDefaultAgentType(this.preferenceService);
    const result = await this.aiBackService.listSessions({
      workspaceDir: new URI(this.workspaceService.workspace?.uri).codeUri.fsPath,
      agentType,
    });

    if (!result?.sessions?.length) {
      return [];
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

    return this.loadedSessionsResult;
  }

  async loadSession(sessionId: string): Promise<ISessionModel | undefined> {
    if (!sessionId) {
      return undefined;
    }

    // 检查缓存，避免重复加载
    const cachedSession = this.loadedSessionMap.get(sessionId);
    if (cachedSession) {
      return cachedSession;
    }

    if (!this.aiBackService?.loadAgentSession) {
      return undefined;
    }

    // 解析 sessionId，提取 agentSessionId（去掉 'acp:' 前缀）
    const agentSessionId = sessionId.startsWith('acp:') ? sessionId.slice(4) : sessionId;

    try {
      // 构造 AgentProcessConfig
      const agentType = getDefaultAgentType(this.preferenceService);
      const config: AgentProcessConfig = {
        agentType,
        workspaceDir: new URI(this.workspaceService.workspace?.uri).codeUri.fsPath,
      };

      const agentSession = await this.aiBackService.loadAgentSession(config, agentSessionId);

      if (!agentSession) {
        return undefined;
      }

      // 将 Agent Session 转换为 ISessionModel 格式
      const sessionModel = this.convertAgentSessionToModel(sessionId, agentSession);

      // 缓存加载的 Session
      this.loadedSessionMap.set(sessionId, sessionModel);

      return sessionModel;
    } catch (error) {
      return undefined;
    }
  }

  private convertAgentSessionToModel(
    sessionId: string,
    agentSession: {
      sessionId: string;
      messages: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp?: number;
      }>;
    },
  ): ISessionModel {
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
      history: {
        additional: {},
        messages,
      },
      requests: [],
    };

    return result;
  }

  async saveSessions(sessions: ISessionModel[]): Promise<void> {}
}

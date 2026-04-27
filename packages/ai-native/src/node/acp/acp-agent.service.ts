import { Autowired, Injectable } from '@opensumi/di';
import {
  AcpCliClientServiceToken,
  type CancelNotification,
  type ContentBlock,
  IAcpCliClientService,
  type ListSessionsRequest,
  type ListSessionsResponse,
  type LoadSessionRequest,
  type NewSessionRequest,
  type SessionMode,
  type SessionModeState,
  type SessionNotification,
  type SetSessionModeRequest,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';
import { AgentProcessConfig } from '@opensumi/ide-core-common/lib/types/ai-native/agent-types';
import { AppConfig, INodeLogger } from '@opensumi/ide-core-node';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

import { CliAgentProcessManagerToken, ICliAgentProcessManager } from './cli-agent-process-manager';
import { AcpTerminalHandler, AcpTerminalHandlerToken } from './handlers/terminal.handler';

export interface SessionLoadResult {
  sessionId: string;
  processId: string;
  modes: SessionMode[];
  status: AgentSessionStatus;
  /**
   * 从 Agent 接收到的所有 session/update 消息
   */
  historyUpdates: SessionNotification[];
}

// ============================================================================
// DI Token
// ============================================================================

export const AcpAgentServiceToken = Symbol('AcpAgentServiceToken');

// ============================================================================
// Agent Session Types
// ============================================================================

export type AgentSessionStatus = 'initializing' | 'ready' | 'running' | 'stopping' | 'stopped' | 'error';

export interface SimpleMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

export interface AgentSessionInfo {
  sessionId: string;
  processId: string;
  modes: SessionMode[];
  status: AgentSessionStatus;
}

export type AgentUpdateType = 'thought' | 'message' | 'tool_call' | 'tool_result' | 'done';

export interface AgentUpdate {
  type: AgentUpdateType;
  content: string;
  toolCall?: SimpleToolCall;
}

export interface SimpleToolCall {
  name: string;
  input: Record<string, unknown>;
}

/**
 * Agent 请求参数
 */
export interface AgentRequest {
  prompt: string;
  /** ACP session/prompt 使用的 sessionId（来自 ACP Agent 的 session ID） */
  sessionId: string;
  images?: string[];
  history?: SimpleMessage[];
}

/**
 * 无状态的 ACP Agent 服务接口
 */
export interface IAcpAgentService {
  /**
   * 初始化 Agent 进程
   * @param config - Agent 配置
   */
  initializeAgent(config: AgentProcessConfig): Promise<AgentSessionInfo>;

  /**
   * 加载已有 Agent Session
   */
  loadSession(sessionId: string, config: AgentProcessConfig): Promise<SessionLoadResult>;

  /**
   * 发送消息到 Agent（无状态）
   */
  sendMessage(request: AgentRequest, config: AgentProcessConfig): SumiReadableStream<AgentUpdate>;

  /**
   * 取消请求
   */
  cancelRequest(sessionId: string): Promise<void>;

  /**
   * 停止 Agent 进程
   */
  stopAgent(): Promise<void>;

  /**
   * 清理所有资源
   */
  dispose(): Promise<void>;

  /**
   * 获取当前 Agent Session 信息
   */
  getSessionInfo(): AgentSessionInfo | null;

  createSession(config: AgentProcessConfig): Promise<{ sessionId: string }>;

  /**
   * 列出所有 ACP Agent 会话
   */
  listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse>;

  /**
   * 切换 Session 模式
   */
  setSessionMode(params: SetSessionModeRequest): Promise<void>;

  /**
   * 释放指定 Session 的资源（包括终端等）
   */
  disposeSession(sessionId: string): Promise<void>;

  /**
   * 获取 initialize 协商时存储的 Session 模式
   */
  getAvailableModes(): Promise<SessionModeState | null>;
}

/**
 * 无状态的 ACP Agent 服务
 *
 * 设计原则：
 * 1. 只维护单一 Agent 进程实例
 * 2. 负责启动/停止 Agent 进程、转发请求、流式返回响应
 */
@Injectable()
export class AcpAgentService implements IAcpAgentService {
  @Autowired(AcpCliClientServiceToken)
  private clientService: IAcpCliClientService;

  @Autowired(CliAgentProcessManagerToken)
  private processManager: ICliAgentProcessManager;

  @Autowired(AcpTerminalHandlerToken)
  private terminalHandler: AcpTerminalHandler;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  // 当前 Agent Session 信息
  private sessionInfo: AgentSessionInfo | null = null;

  // 全局 Agent 进程 ID（单一实例）
  private currentProcessId: string | null = null;

  // 当前活跃的通知处理器和 stream
  private currentNotificationHandler: {
    unsubscribe: () => void;
    stream: SumiReadableStream<AgentUpdate>;
    sessionId: string;
  } | null = null;

  // 确保初始化只执行一次
  private initializingPromise: Promise<AgentSessionInfo> | null = null;

  // 断开事件订阅的取消函数
  private disconnectUnsubscribe: (() => void) | null = null;

  async createSession(config: AgentProcessConfig): Promise<{ sessionId: string }> {
    await this.ensureConnected(config);
    const res = await this.clientService.newSession({ cwd: config.workspaceDir, mcpServers: [] });
    return { sessionId: res.sessionId };
  }
  /**
   * 确保 Agent 进程已连接并初始化，复用现有连接或启动新进程
   */
  private async ensureConnected(config: AgentProcessConfig): Promise<string> {
    if (this.currentProcessId) {
      return this.currentProcessId;
    }

    const { processId, stdout, stdin } = await this.processManager.startAgent(
      config.command,
      config.args,
      config.env ?? {},
      config.workspaceDir,
    );

    this.clientService.setTransport(stdout, stdin);
    await this.clientService.initialize();
    this.currentProcessId = processId;

    // 订阅断开事件，自动清理上层状态
    if (this.disconnectUnsubscribe) {
      this.disconnectUnsubscribe();
    }
    this.disconnectUnsubscribe = this.clientService.onDisconnect(() => {
      this.logger?.warn('[AcpAgentService] Connection lost, clearing state');
      this.currentProcessId = null;
      this.sessionInfo = null;
      this.initializingPromise = null;
    });

    return processId;
  }

  /**
   * 获取当前 Agent Session 信息
   */
  getSessionInfo(): AgentSessionInfo | null {
    return this.sessionInfo;
  }

  async initializeAgent(config: AgentProcessConfig): Promise<AgentSessionInfo> {
    if (this.sessionInfo && this.currentProcessId) {
      return this.sessionInfo;
    }

    if (this.initializingPromise) {
      return this.initializingPromise;
    }

    this.initializingPromise = (async () => {
      const processId = await this.ensureConnected(config);

      const newSessionRequest: NewSessionRequest = {
        cwd: config.workspaceDir,
        mcpServers: [],
      };

      const newSessionResponse = await this.clientService.newSession(newSessionRequest);

      this.sessionInfo = {
        sessionId: newSessionResponse.sessionId,
        processId,
        modes: (newSessionResponse.modes?.availableModes ?? []) as SessionMode[],
        status: 'ready',
      };

      this.currentProcessId = processId;

      return this.sessionInfo;
    })();

    try {
      const result = await this.initializingPromise;
      return result;
    } finally {
      this.initializingPromise = null;
    }
  }

  /**
   * 加载已有 Agent Session
   */
  async loadSession(sessionId: string, config: AgentProcessConfig): Promise<SessionLoadResult> {
    const processId = await this.ensureConnected(config);

    const historyUpdates: SessionNotification[] = [];

    // 设置临时通知处理器来收集 session/update
    const tempHandler = (notification: SessionNotification) => {
      if (notification.sessionId === sessionId && notification.update) {
        historyUpdates.push(notification);
      }
    };

    // 订阅临时通知处理器
    const unsubscribe = this.clientService.onNotification(tempHandler);

    const loadRequest: LoadSessionRequest = {
      sessionId,
      cwd: config.workspaceDir,
      mcpServers: [],
    };

    try {
      await Promise.race([
        this.clientService.loadSession(loadRequest),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Session load timeout for ${sessionId}`)), 60000),
        ),
      ]);

      // 等待延迟的 session/update 通知
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      unsubscribe();
    }

    const modes: SessionMode[] = [];
    for (const notification of historyUpdates) {
      const update = notification.update as any;
      if (update?.currentModeId) {
        const existingMode = modes.find((m) => m.id === update.currentModeId);
        if (!existingMode) {
          modes.push({ id: update.currentModeId, name: update.currentModeId });
        }
      }
    }

    this.sessionInfo = {
      sessionId,
      processId,
      modes,
      status: 'ready',
    };

    this.currentProcessId = processId;

    const result: SessionLoadResult = {
      sessionId,
      processId,
      modes,
      status: 'ready',
      historyUpdates,
    };

    return result;
  }

  /**
   * 发送消息到 Agent（无状态）
   */
  sendMessage(request: AgentRequest): SumiReadableStream<AgentUpdate> {
    const stream = new SumiReadableStream<AgentUpdate>();

    if (!this.currentProcessId) {
      stream.emitError(new Error('Agent process not initialized'));
      return stream;
    }

    const promptBlocks = this.buildPromptBlocks(request.prompt, request.images);

    const promptRequest = {
      sessionId: request.sessionId,
      prompt: promptBlocks,
    };

    const unsubscribe = this.clientService.onNotification((notification: SessionNotification) => {
      if (notification.sessionId !== request.sessionId) {
        return;
      }

      this.handleNotification(notification, stream);
    });

    // 流结束时清理
    stream.onEnd(() => {
      unsubscribe();
      this.currentNotificationHandler = null;
    });
    stream.onError((error) => {
      unsubscribe();
      this.currentNotificationHandler = null;
    });

    // 保存当前处理器信息
    this.currentNotificationHandler = {
      unsubscribe,
      stream,
      sessionId: request.sessionId,
    };

    this.sendPrompt(promptRequest, stream);

    return stream;
  }

  /**
   * 异步发送 prompt（内部使用）
   */
  private async sendPrompt(
    promptRequest: { sessionId: string; prompt: ContentBlock[] },
    stream: SumiReadableStream<AgentUpdate>,
  ): Promise<void> {
    try {
      await this.clientService.prompt(promptRequest);
      stream.emitData({ type: 'done', content: '' });
      stream.end();
    } catch (error) {
      stream.emitError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 处理通知
   *
   * tool_call 通知仅用于 UI 展示，不触发权限弹窗。
   * 权限确认完全依赖 agent 发送的 session/request_permission JSON-RPC 请求（阻塞式），
   * 由 AcpCliClientService.handleIncomingRequest → agentRequestHandler.handlePermissionRequest 处理。
   */
  private handleNotification(notification: SessionNotification, stream: SumiReadableStream<AgentUpdate>): void {
    const update = notification.update;

    switch (update.sessionUpdate) {
      case 'agent_thought_chunk': {
        const content = update.content;
        if (content.type === 'text') {
          stream.emitData({
            type: 'thought',
            content: content.text,
          });
        }
        break;
      }

      case 'agent_message_chunk': {
        const content = update.content;
        if (content.type === 'text') {
          stream.emitData({
            type: 'message',
            content: content.text,
          });
        }
        break;
      }

      case 'tool_call': {
        // tool_call 通知仅用于 UI 展示，不触发权限弹窗
        // 权限由 agent 通过 session/request_permission 请求阻塞式处理
        stream.emitData({
          type: 'tool_call',
          content: update.title || '',
          toolCall: {
            name: update.title || '',
            input: (update.rawInput as Record<string, unknown>) || {},
          },
        });
        break;
      }

      case 'tool_call_update': {
        if (update.content) {
          for (const content of update.content) {
            if (content.type === 'diff') {
              stream.emitData({
                type: 'tool_result',
                content: `Modified ${content.path}`,
              });
            }
          }
        }
        break;
      }

      default:
        this.logger?.log(`Unhandled session update type: ${update.sessionUpdate}`);
        break;
    }
  }

  /**
   * 取消请求
   */
  async cancelRequest(sessionId: string): Promise<void> {
    if (!this.currentProcessId) {
      this.logger?.warn('cancelRequest: Agent process not initialized');
      return;
    }

    const cancelNotification: CancelNotification = {
      sessionId,
    };

    try {
      await this.clientService.cancel(cancelNotification);
    } catch (error) {}
  }

  async listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse> {
    return this.clientService.listSessions(params);
  }

  async setSessionMode(params: SetSessionModeRequest): Promise<void> {
    await this.clientService.setSessionMode(params);
  }

  async disposeSession(sessionId: string): Promise<void> {
    await this.terminalHandler.releaseSessionTerminals(sessionId);
  }

  async getAvailableModes() {
    return this.clientService.getSessionModes();
  }

  /**
   * 停止 Agent 进程
   */
  async stopAgent(): Promise<void> {
    if (!this.currentProcessId) {
      return;
    }

    await this.processManager.stopAgent();

    await this.clientService.close();

    this.sessionInfo = null;
    this.currentProcessId = null;
    this.initializingPromise = null;
  }

  /**
   * 清理所有资源
   */
  async dispose(): Promise<void> {
    this.logger?.warn('[AcpAgentService] dispose called');

    // 先取消断开事件订阅，防止后续清理操作触发 handler
    if (this.disconnectUnsubscribe) {
      this.disconnectUnsubscribe();
      this.disconnectUnsubscribe = null;
    }

    if (this.currentNotificationHandler) {
      this.currentNotificationHandler.stream.end();
      this.currentNotificationHandler.unsubscribe();
      this.currentNotificationHandler = null;
    }

    await this.stopAgent();

    await this.processManager.killAllAgents();

    this.initializingPromise = null;
    this.sessionInfo = null;
    this.currentProcessId = null;
  }

  private buildPromptBlocks(input: string, images?: string[]): ContentBlock[] {
    const blocks: ContentBlock[] = [];

    blocks.push({
      type: 'text',
      text: input,
    });

    if (images && images.length > 0) {
      for (const imageData of images) {
        const { mimeType, base64Data } = this.parseDataUrl(imageData);
        blocks.push({
          type: 'image',
          data: base64Data,
          mimeType,
        });
      }
    }

    return blocks;
  }

  private parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } {
    if (dataUrl.startsWith('data:')) {
      const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        return { mimeType: matches[1], base64Data: matches[2] };
      }
    }
    // 默认返回
    return { mimeType: 'image/jpeg', base64Data: dataUrl };
  }
}

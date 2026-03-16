/**
 * ACP Agent 服务（Node 端核心）
 *
 * 负责管理 CLI Agent 进程的完整生命周期：
 * - 启动 / 停止 Agent 子进程
 * - 初始化 ACP 连接并创建 / 加载 Session
 * - 向 Agent 发送 prompt，以流式方式返回 AgentUpdate（思考、消息、工具调用等）
 * - 在 tool_call 时请求用户权限确认，并根据结果决定是否继续或取消请求
 *
 * 设计原则：
 * - 单一 Agent 进程实例（全局唯一）
 * - 无状态请求：每次 sendMessage 传入完整 prompt + history
 * - 通过 AcpCliClientService 与 Agent 进行 JSON-RPC 通信
 */
import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, INodeLogger } from '@opensumi/ide-core-node';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

import { AgentProcessConfig, DEFAULT_AGENT_TYPE, getAgentConfig } from '../../common';

import { AcpCliClientServiceToken, IAcpCliClientService } from './acp-cli-client.service';
import { CliAgentProcessManagerToken, ICliAgentProcessManager } from './cli-agent-process-manager';
import { AcpAgentRequestHandler } from './handlers/agent-request.handler';

import type {
  CancelNotification,
  ContentBlock,
  ListSessionsRequest,
  ListSessionsResponse,
  LoadSessionRequest,
  NewSessionRequest,
  RequestPermissionRequest,
  SessionMode,
  SessionModeState,
  SessionNotification,
  SetSessionModeRequest,
  ToolCallUpdate,
} from '../../common/acp-types';

/**
 * Session 加载结果
 */
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

export interface PermissionResult {
  approved: boolean;
  input?: Record<string, unknown>;
}

/**
 * Agent 请求参数（无状态，每次请求都传入完整参数）
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
   * 请求权限确认
   */
  requestPermission(toolCallUpdate: ToolCallUpdate): Promise<PermissionResult>;

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
   * 获取 initialize 协商时存储的 Session 模式
   */
  getAvailableModes(): SessionModeState | null;
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

  @Autowired(AcpAgentRequestHandler)
  private agentRequestHandler: AcpAgentRequestHandler;

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
    pendingToolCalls: Map<string, { resolve: (result: boolean) => void; reject: (error: Error) => void }>;
  } | null = null;

  // 确保初始化只执行一次
  private initializingPromise: Promise<AgentSessionInfo> | null = null;

  // 跨所有监听器追踪正在进行权限请求的 toolCallId，防止重复弹窗
  private inFlightPermissions = new Set<string>();

  async createSession(config: AgentProcessConfig): Promise<{ sessionId: string }> {
    await this.ensureConnected(config);
    const res = await this.clientService.newSession({ cwd: config.workspaceDir, mcpServers: [] });
    return { sessionId: res.sessionId };
  }
  /**
   * 确保 Agent 进程已连接并初始化，复用现有连接或启动新进程
   */
  private async ensureConnected(config: AgentProcessConfig): Promise<string> {
    if (this.currentProcessId && this.processManager.isRunning()) {
      return this.currentProcessId;
    }

    // 进程未运行时，先清理旧状态
    if (this.currentProcessId && !this.processManager.isRunning()) {
      this.logger?.warn('[ensureConnected] Process not running, clearing old state');
      this.currentProcessId = null;
    }

    const agentConfig = getAgentConfig(config.agentType || DEFAULT_AGENT_TYPE);
    const { processId, stdout, stdin } = await this.processManager.startAgent(
      agentConfig.command,
      agentConfig.args,
      config.env ?? {},
      config.workspaceDir,
    );

    // 关键：在 setTransport 之前记录日志
    this.logger?.log(`[ensureConnected] Setting up transport for process ${processId}`);
    this.clientService.setTransport(stdout, stdin);
    await this.clientService.initialize();
    this.currentProcessId = processId;
    return processId;
  }

  /**
   * 获取当前 Agent Session 信息
   */
  getSessionInfo(): AgentSessionInfo | null {
    return this.sessionInfo;
  }

  async initializeAgent(config: AgentProcessConfig): Promise<AgentSessionInfo> {
    if (this.sessionInfo && this.currentProcessId && this.processManager.isRunning()) {
      return this.sessionInfo;
    }

    if (this.sessionInfo && !this.currentProcessId) {
      this.sessionInfo = null;
      this.initializingPromise = null;
    }

    if (this.initializingPromise) {
      return this.initializingPromise;
    }

    this.initializingPromise = (async () => {
      const processId = await this.ensureConnected(config);

      // Create ACP session
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
    } catch (error) {
      // 初始化失败，清理 promise 以便下次重试
      this.initializingPromise = null;
      throw error;
    }
  }

  /**
   * 加载已有 Agent Session
   */
  async loadSession(sessionId: string, config: AgentProcessConfig): Promise<SessionLoadResult> {
    const processId = await this.ensureConnected(config);

    // 准备收集 updates
    const historyUpdates: SessionNotification[] = [];

    // 设置临时通知处理器来收集 session/update
    const tempHandler = (notification: SessionNotification) => {
      if (notification.sessionId === sessionId && notification.update) {
        historyUpdates.push(notification);
      }
    };

    // 订阅临时通知处理器
    const unsubscribe = this.clientService.onNotification(tempHandler);

    // 使用 Promise 包装加载过程
    const loadPromise = new Promise<void>(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Session load timeout for ${sessionId}`));
      }, 60000);

      try {
        const loadRequest: LoadSessionRequest = {
          sessionId,
          cwd: config.workspaceDir,
          mcpServers: [],
        };

        await this.clientService.loadSession(loadRequest);

        // 等待延迟的 session/update 通知
        await new Promise((delayResolve) => setTimeout(delayResolve, 500));

        clearTimeout(timeout);
        unsubscribe();
        resolve();
      } catch (error) {
        clearTimeout(timeout);
        unsubscribe();
        reject(error);
        resolve();
      }
    });

    await loadPromise;

    // 从 updates 中提取 modes 信息
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

    const pendingToolCalls = new Map<string, { resolve: (result: boolean) => void; reject: (error: Error) => void }>();

    const unsubscribe = this.clientService.onNotification((notification: SessionNotification) => {
      if (notification.sessionId !== request.sessionId) {
        return;
      }

      this.handleNotification(notification, stream, pendingToolCalls);
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
      pendingToolCalls,
    };

    // 异步发送 prompt，不阻塞 stream 返回
    this.sendPrompt(promptRequest, stream, pendingToolCalls);

    return stream;
  }

  /**
   * 异步发送 prompt（内部使用）
   */
  private async sendPrompt(
    promptRequest: { sessionId: string; prompt: ContentBlock[] },
    stream: SumiReadableStream<AgentUpdate>,
    pendingToolCalls: Map<string, { resolve: (result: boolean) => void; reject: (error: Error) => void }>,
  ): Promise<void> {
    try {
      await this.clientService.prompt(promptRequest);
      // 等待所有 pending tool calls 完成后再发送 done 信号
      await this.waitForPendingToolCalls(stream, pendingToolCalls);
    } catch (error) {
      stream.emitError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 等待所有 pending tool calls 完成
   */
  private async waitForPendingToolCalls(
    stream: SumiReadableStream<AgentUpdate>,
    pendingToolCalls: Map<string, { resolve: (result: boolean) => void; reject: (error: Error) => void }>,
  ): Promise<void> {
    const timeout = 5000;
    const startTime = Date.now();

    while (pendingToolCalls.size > 0) {
      if (Date.now() - startTime > timeout) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // 发送 'done' 信号并结束 stream，触发 onEnd 回调清理监听器
    stream.emitData({ type: 'done', content: '' });
    stream.end();
  }

  /**
   * 处理通知
   */
  private handleNotification(
    notification: SessionNotification,
    stream: SumiReadableStream<AgentUpdate>,
    pendingToolCalls: Map<string, { resolve: (result: boolean) => void; reject: (error: Error) => void }>,
  ): void {
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
        this.handleToolCallWithPermission(update, stream, pendingToolCalls);
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
   * 请求权限确认
   */
  async requestPermission(toolCallUpdate: ToolCallUpdate): Promise<PermissionResult> {
    const request: RequestPermissionRequest = {
      sessionId: this.sessionInfo?.sessionId || '',
      toolCall: {
        toolCallId: toolCallUpdate.toolCallId,
        title: toolCallUpdate.title,
        kind: toolCallUpdate.kind,
        status: 'pending',
        rawInput: toolCallUpdate.rawInput,
        locations: toolCallUpdate.locations,
      },
      options: [
        { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' },
        { optionId: 'allow_always', name: 'Allow Always', kind: 'allow_always' },
        { optionId: 'reject_once', name: 'Reject Once', kind: 'reject_once' },
      ],
    };

    try {
      const response = await this.agentRequestHandler.handlePermissionRequest(request);

      if (response.outcome.outcome === 'selected') {
        const optionId = response.outcome.optionId;
        const approved = optionId.includes('allow');
        return { approved, input: { optionId } };
      } else {
        return { approved: false };
      }
    } catch (error) {
      this.logger?.error('Permission request failed:', error);
      return { approved: false };
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

  getAvailableModes(): SessionModeState | null {
    return this.clientService.getSessionModes();
  }

  /**
   * 停止 Agent 进程
   */
  async stopAgent(): Promise<void> {
    if (!this.currentProcessId) {
      return;
    }

    // Stop the agent process
    await this.processManager.stopAgent();

    // Close client connection
    await this.clientService.close();

    // 清理状态
    this.sessionInfo = null;
    this.currentProcessId = null;
  }

  /**
   * 清理所有资源
   */
  async dispose(): Promise<void> {
    // 记录调用堆栈，便于追踪是谁触发了 dispose
    const stackTrace = new Error('dispose called').stack;
    this.logger?.error('[AcpAgentService] dispose called', stackTrace);

    // Cancel current notification handler
    if (this.currentNotificationHandler) {
      for (const [, pending] of this.currentNotificationHandler.pendingToolCalls) {
        pending.reject(new Error('Service disposed'));
      }
      this.currentNotificationHandler.stream.end();
      this.currentNotificationHandler.unsubscribe();
      this.currentNotificationHandler = null;
    }

    // Stop agent process
    await this.stopAgent();

    // Close client connection
    await this.clientService.close();

    // Kill any remaining processes
    await this.processManager.killAllAgents();

    // 清理初始化状态（重要！防止 dispose 后返回旧的 promise）
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
        blocks.push({
          type: 'image',
          data: imageData,
          mimeType: 'image/jpeg',
        });
      }
    }

    return blocks;
  }

  /**
   * 处理 tool_call 并请求权限确认
   */
  private async handleToolCallWithPermission(
    toolCallUpdate: ToolCallUpdate,
    stream: SumiReadableStream<AgentUpdate>,
    pendingToolCalls: Map<string, { resolve: (result: boolean) => void; reject: (error: Error) => void }>,
  ): Promise<void> {
    const toolCallId = toolCallUpdate.toolCallId;

    // 跨所有监听器去重：若同一 toolCallId 已在处理中，直接跳过
    if (this.inFlightPermissions.has(toolCallId)) {
      return;
    }
    this.inFlightPermissions.add(toolCallId);

    // 注册 pending tool call
    pendingToolCalls.set(toolCallId, { resolve: () => {}, reject: () => {} });

    // 发送 tool_call 通知给前端
    stream.emitData({
      type: 'tool_call',
      content: toolCallUpdate.title || '',
      toolCall: {
        name: toolCallUpdate.title || '',
        input: (toolCallUpdate.rawInput as Record<string, unknown>) || {},
      },
    });

    try {
      const result = await this.requestPermission(toolCallUpdate);

      if (result.approved) {
        this.logger?.log(`Tool call "${toolCallUpdate.title}" approved`);
      } else {
        this.logger?.log(`Tool call "${toolCallUpdate.title}" denied`);
        if (this.sessionInfo) {
          await this.cancelRequest(this.sessionInfo.sessionId);
        }
      }

      // 完成 pending
      const pending = pendingToolCalls.get(toolCallId);
      if (pending) {
        pending.resolve(result.approved);
        pendingToolCalls.delete(toolCallId);
      }
    } catch (error) {
      this.logger?.error(`Failed to get permission for tool call: ${toolCallUpdate.title}`, error);
      const pending = pendingToolCalls.get(toolCallId);
      if (pending) {
        pending.reject(error as Error);
        pendingToolCalls.delete(toolCallId);
      }
    } finally {
      this.inFlightPermissions.delete(toolCallId);
    }
  }
}

/**
 * ChatManagerService - 聊天会话管理器服务
 *
 * 负责管理 AI 聊天的会话生命周期，包括：
 * - 创建、获取、清除聊天会话
 * - 管理聊天请求的发送和取消
 * - 持久化会话历史到存储
 *
 * 被以下类调用:
 * - ChatInternalService: 依赖注入使用，用于会话管理操作
 */
import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { AINativeConfigService, PreferenceService } from '@opensumi/ide-core-browser';
import {
  AINativeSettingSectionsId,
  CancellationToken,
  CancellationTokenSource,
  Disposable,
  DisposableMap,
  Emitter,
  IChatProgress,
  IDisposable,
  LRUCache,
  debounce,
} from '@opensumi/ide-core-common';
import { ChatFeatureRegistryToken } from '@opensumi/ide-core-common/lib/types/ai-native';

import { IChatAgentService } from '../../common';
import { MsgHistoryManager } from '../model/msg-history-manager';

import { ChatModel, ChatRequestModel, ChatResponseModel } from './chat-model';
import { ChatFeatureRegistry } from './chat.feature.registry';
import { ISessionModel, ISessionProvider } from './session-provider';
import { ISessionProviderRegistry } from './session-provider-registry';

const MAX_SESSION_COUNT = 20;

class DisposableLRUCache<K, V extends IDisposable = IDisposable> extends LRUCache<K, V> implements IDisposable {
  disposeKey(key: K): void {
    const disposable = this.get(key);
    if (disposable) {
      disposable.dispose();
    }
    this.delete(key);
  }

  dispose(): void {
    this.forEach((disposable) => {
      disposable.dispose();
    });
    this.clear();
  }
}

@Injectable()
export class ChatManagerService extends Disposable {
  #sessionModels = this.registerDispose(new DisposableLRUCache<string, ChatModel>(MAX_SESSION_COUNT));
  #pendingRequests = this.registerDispose(new DisposableMap<string, CancellationTokenSource>());
  private storageInitEmitter = new Emitter<void>();
  public onStorageInit = this.storageInitEmitter.event;

  @Autowired(AINativeConfigService)
  protected readonly aiNativeConfig: AINativeConfigService;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(IChatAgentService)
  chatAgentService: IChatAgentService;

  @Autowired(ISessionProviderRegistry)
  private sessionProviderRegistry: ISessionProviderRegistry;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  @Autowired(ChatFeatureRegistryToken)
  private chatFeatureRegistry: ChatFeatureRegistry;

  private mainProvider: ISessionProvider | null = null;

  protected fromJSON(data: ISessionModel[]) {
    return data
      .filter((item) => item.history.messages.length > 0 || item.sessionId.startsWith('acp:'))
      .map((item) => {
        const model = new ChatModel(this.chatFeatureRegistry, {
          sessionId: item.sessionId,
          history: new MsgHistoryManager(this.chatFeatureRegistry, item.history),
          modelId: item.modelId,
          title: item?.title,
        });
        const requests = item.requests.map(
          (request) =>
            new ChatRequestModel(
              request.requestId,
              model,
              request.message,
              new ChatResponseModel(request.requestId, model, request.message.agentId, {
                responseContents: request.response.responseContents,
                isComplete: true,
                responseText: request.response.responseText,
                responseParts: request.response.responseParts,
                errorDetails: request.response.errorDetails,
                followups: request.response.followups,
                isCanceled: request.response.isCanceled,
              }),
            ),
        );
        model.restoreRequests(requests);
        return model;
      });
  }

  /**
   * 将 ChatModel 转换为 ISessionModel 数据
   */
  private toSessionData(model: ChatModel): ISessionModel {
    return {
      sessionId: model.sessionId,
      modelId: model.modelId,
      history: model.history.toJSON(),
      requests: model.getRequests().map((request) => ({
        requestId: request.requestId,
        message: request.message,
        response: {
          isCanceled: request.response.isCanceled,
          responseText: request.response.responseText,
          responseContents: request.response.responseContents,
          responseParts: request.response.responseParts,
          errorDetails: request.response.errorDetails,
          followups: request.response.followups,
        },
      })),
    };
  }

  constructor() {
    super();
    const mode = this.aiNativeConfig.capabilities.supportsAgentMode ? 'acp' : 'local'; // TODO 写死， 按需切换

    const allProviders = this.sessionProviderRegistry.getAllProviders();

    const p = allProviders.filter((provider) => provider.canHandle(mode))[0];

    this.mainProvider = p;
  }

  async init() {
    try {
      if (!this.mainProvider) {
        await this.storageInitEmitter.fireAndAwait();
        return;
      }
      // acp模式只会先拉取列表，具体的Session需要单独的load
      const sessionsModelData = await this.mainProvider.loadSessions();

      // 只保留最新的 20 个会话
      const recentSessionsData = sessionsModelData.slice(-MAX_SESSION_COUNT);

      const savedSessions = this.fromJSON(recentSessionsData);

      savedSessions.forEach((session) => {
        this.#sessionModels.set(session.sessionId, session);
      });

      await this.storageInitEmitter.fireAndAwait();
    } catch (error) {
      await this.storageInitEmitter.fireAndAwait();
    }
  }

  getSessions() {
    const sessions = Array.from(this.#sessionModels.values());

    return sessions;
  }

  /**
   * 启动新会话
   * - ACP 模式：调用 Provider.createSession 创建远程会话
   * - Local 模式：创建本地会话
   */
  async startSession(): Promise<ChatModel> {
    if (this.aiNativeConfig.capabilities.supportsAgentMode && this.mainProvider?.createSession) {
      const sessionData = await this.mainProvider.createSession();
      const models = this.fromJSON([sessionData]);
      if (models.length > 0) {
        const model = models[0];
        this.#sessionModels.set(model.sessionId, model);
        this.listenSession(model);

        return model;
      }
    }

    // Local 模式：创建本地会话
    const model = new ChatModel(this.chatFeatureRegistry);
    this.#sessionModels.set(model.sessionId, model);
    this.listenSession(model);

    return model;
  }

  getSession(sessionId: string): ChatModel | undefined {
    return this.#sessionModels.get(sessionId);
  }

  /**
   * 加载指定会话
   * @param sessionId 本地 Session ID
   * @returns Session 数据，不存在时返回 undefined
   */
  async loadSession(sessionId: string) {
    if (this.aiNativeConfig.capabilities.supportsAgentMode) {
      // 如果是acp模式，会从provider的loadSession(sessionId)加载指定的会话
      const existingSession = this.#sessionModels.get(sessionId);
      if (existingSession?.history?.getMessages()?.length) {
        return;
      }

      // 从provider加载指定会话
      if (this.mainProvider?.loadSession && sessionId) {
        return this.mainProvider.loadSession(sessionId).then((sessionData) => {
          if (sessionData) {
            const sessions = this.fromJSON([sessionData]);
            if (sessions.length > 0) {
              const session = sessions[0];
              this.#sessionModels.set(sessionId, session);
              this.listenSession(session);
            }
          }
        });
      }
    }
  }

  clearSession(sessionId: string) {
    const model = this.#sessionModels.get(sessionId) as ChatModel;
    if (!model) {
      throw new Error(`Unknown session: ${sessionId}`);
    }
    this.#sessionModels.disposeKey(sessionId);
    this.#pendingRequests.get(sessionId)?.cancel();
    this.#pendingRequests.disposeKey(sessionId);
    this.saveSessions();
  }

  createRequest(sessionId: string, message: string, agentId: string, command?: string, images?: string[]) {
    const model = this.getSession(sessionId);
    if (!model) {
      throw new Error(`Unknown session: ${sessionId}`);
    }

    if (this.#pendingRequests.has(sessionId)) {
      return;
    }

    return model.addRequest({ prompt: message, agentId, command, images });
  }

  async sendRequest(sessionId: string, request: ChatRequestModel, regenerate: boolean) {
    const model = this.getSession(sessionId);
    if (!model) {
      throw new Error(`Unknown session: ${sessionId}`);
    }

    const savedModelId = model.modelId;
    const modelId = this.preferenceService.get<string>(AINativeSettingSectionsId.ModelID);
    if (!savedModelId) {
      // 首次对话时记录 modelId
      model.modelId = modelId;
    } else if (savedModelId !== modelId) {
      // 模型切换时，清空对话历史
      throw new Error('Model changed unexpectedly');
    }

    const source = new CancellationTokenSource();
    const token = source.token;
    this.#pendingRequests.set(model.sessionId, source);
    const listener = token.onCancellationRequested(() => {
      request.response.cancel();
    });

    const contextWindow = this.preferenceService.get<number>(AINativeSettingSectionsId.ContextWindow);
    const history = typeof contextWindow === 'number' ? model.getMessageHistory(contextWindow) : [];

    try {
      const progressCallback = (progress: IChatProgress) => {
        if (token.isCancellationRequested) {
          return;
        }
        model.acceptResponseProgress(request, progress);
      };
      const requestProps = {
        sessionId,
        requestId: request.requestId,
        message: request.message.prompt,
        command: request.message.command,
        images: request.message.images,
        regenerate,
      };
      const result = await this.chatAgentService.invokeAgent(
        request.message.agentId,
        requestProps,
        progressCallback,
        history,
        token,
      );

      if (!token.isCancellationRequested) {
        if (result.errorDetails) {
          request.response.setErrorDetails(result.errorDetails);
        }
        const followups = this.chatAgentService.getFollowups(
          request.message.agentId,
          sessionId,
          CancellationToken.None,
        );
        followups.then((followups) => {
          request.response.setFollowups(followups);
          request.response.complete();
        });
      }
    } finally {
      listener.dispose();
      this.#pendingRequests.disposeKey(model.sessionId);
      this.saveSessions();
    }
  }

  protected listenSession(session: ChatModel) {
    this.addDispose(
      session.history.onMessageAdditionalChange(() => {
        this.saveSessions();
      }),
    );
  }

  @debounce(1000)
  protected async saveSessions() {
    if (!this.mainProvider?.saveSessions) {
      return;
    }
    const sessionsData = this.getSessions().map((model) => this.toSessionData(model));
    await this.mainProvider.saveSessions(sessionsData);
  }

  cancelRequest(sessionId: string) {
    this.#pendingRequests.get(sessionId)?.cancel();
    this.#pendingRequests.disposeKey(sessionId);
    this.saveSessions();
  }
}

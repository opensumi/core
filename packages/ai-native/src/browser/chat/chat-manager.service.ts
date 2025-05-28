import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import {
  AINativeSettingSectionsId,
  CancellationToken,
  CancellationTokenSource,
  Disposable,
  DisposableMap,
  Emitter,
  IChatProgress,
  IDisposable,
  IStorage,
  LRUCache,
  STORAGE_NAMESPACE,
  StorageProvider,
  debounce,
} from '@opensumi/ide-core-common';
import { ChatFeatureRegistryToken, IHistoryChatMessage } from '@opensumi/ide-core-common/lib/types/ai-native';

import { IChatAgentService, IChatFollowup, IChatRequestMessage, IChatResponseErrorDetails } from '../../common';
import { MsgHistoryManager } from '../model/msg-history-manager';

import { ChatModel, ChatRequestModel, ChatResponseModel, IChatProgressResponseContent } from './chat-model';
import { ChatFeatureRegistry } from './chat.feature.registry';

interface ISessionModel {
  sessionId: string;
  modelId: string;
  history: { additional: Record<string, any>; messages: IHistoryChatMessage[] };
  requests: {
    requestId: string;
    message: IChatRequestMessage;
    response: {
      isCanceled: boolean;
      responseText: string;
      responseContents: IChatProgressResponseContent[];
      responseParts: IChatProgressResponseContent[];
      errorDetails: IChatResponseErrorDetails | undefined;
      followups: IChatFollowup[];
    };
  }[];
}

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

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(IChatAgentService)
  chatAgentService: IChatAgentService;

  @Autowired(StorageProvider)
  private storageProvider: StorageProvider;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  @Autowired(ChatFeatureRegistryToken)
  private chatFeatureRegistry: ChatFeatureRegistry;

  private _chatStorage: IStorage;

  protected fromJSON(data: ISessionModel[]) {
    return data
      .filter((item) => item.history.messages.length > 0)
      .map((item) => {
        const model = new ChatModel(
          this.chatFeatureRegistry,
          {
            sessionId: item.sessionId,
            history: new MsgHistoryManager(this.chatFeatureRegistry, item.history),
            modelId: item.modelId,
          },
        );
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

  constructor() {
    super();
  }

  async init() {
    this._chatStorage = await this.storageProvider(STORAGE_NAMESPACE.CHAT);
    const sessionsModelData = this._chatStorage.get<ISessionModel[]>('sessionModels', []);
    const savedSessions = this.fromJSON(sessionsModelData);
    savedSessions.forEach((session) => {
      this.#sessionModels.set(session.sessionId, session);
      this.listenSession(session);
    });
    await this.storageInitEmitter.fireAndAwait();
  }

  getSessions() {
    return Array.from(this.#sessionModels.values());
  }

  startSession() {
    const model = new ChatModel(
      this.chatFeatureRegistry,
    );
    this.#sessionModels.set(model.sessionId, model);
    this.listenSession(model);
    return model;
  }

  getSession(sessionId: string): ChatModel | undefined {
    return this.#sessionModels.get(sessionId);
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
    const history = model.getMessageHistory(contextWindow);

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
  protected saveSessions() {
    this._chatStorage.set('sessionModels', this.getSessions());
  }

  cancelRequest(sessionId: string) {
    this.#pendingRequests.get(sessionId)?.cancel();
    this.#pendingRequests.disposeKey(sessionId);
    this.saveSessions();
  }
}

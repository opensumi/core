import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  CancellationToken,
  CancellationTokenSource,
  Disposable,
  DisposableMap,
  Emitter,
  IChatProgress,
  IChatToolContent,
  IStorage,
  STORAGE_NAMESPACE,
  StorageProvider,
  debounce,
  formatLocalize,
} from '@opensumi/ide-core-common';
import { ChatMessageRole, IChatMessage, IHistoryChatMessage } from '@opensumi/ide-core-common/lib/types/ai-native';

import { IChatAgentService, IChatFollowup, IChatRequestMessage, IChatResponseErrorDetails } from '../../common';
import { MsgHistoryManager } from '../model/msg-history-manager';

import { ChatModel, ChatRequestModel, ChatResponseModel, IChatProgressResponseContent } from './chat-model';

interface ISessionModel {
  sessionId: string;
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

@Injectable()
export class ChatManagerService extends Disposable {
  #sessionModels = this.registerDispose(new DisposableMap<string, ChatModel>());
  #pendingRequests = this.registerDispose(new DisposableMap<string, CancellationTokenSource>());
  private storageInitEmitter = new Emitter<void>();
  public onStorageInit = this.storageInitEmitter.event;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(IChatAgentService)
  chatAgentService: IChatAgentService;

  @Autowired(StorageProvider)
  private storageProvider: StorageProvider;

  private _chatStorage: IStorage;

  protected fromJSON(data: ISessionModel[]) {
    // TODO: 支持ApplyService恢复
    return data.map((item) => {
      const model = new ChatModel({
        sessionId: item.sessionId,
        history: new MsgHistoryManager(item.history),
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
    if (this.#sessionModels.size >= MAX_SESSION_COUNT) {
      throw new Error(formatLocalize('aiNative.chat.session.max', MAX_SESSION_COUNT.toString()));
    }
    const model = new ChatModel();
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

  createRequest(sessionId: string, message: string, agentId: string, command?: string) {
    const model = this.getSession(sessionId);
    if (!model) {
      throw new Error(`Unknown session: ${sessionId}`);
    }

    if (this.#pendingRequests.has(sessionId)) {
      return;
    }

    return model.addRequest({ prompt: message, agentId, command });
  }

  async sendRequest(sessionId: string, request: ChatRequestModel, regenerate: boolean) {
    const model = this.getSession(sessionId);
    if (!model) {
      throw new Error(`Unknown session: ${sessionId}`);
    }

    const source = new CancellationTokenSource();
    const token = source.token;
    this.#pendingRequests.set(model.sessionId, source);
    const listener = token.onCancellationRequested(() => {
      request.response.cancel();
    });

    const history = model.messageHistory;

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

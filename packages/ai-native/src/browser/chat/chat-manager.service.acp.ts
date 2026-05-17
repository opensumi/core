import { Autowired, Injectable } from '@opensumi/di';
import { AINativeConfigService } from '@opensumi/ide-core-browser';
import { AvailableCommand, debounce } from '@opensumi/ide-core-common';

import { MsgHistoryManager } from '../model/msg-history-manager';

import { ChatManagerService } from './chat-manager.service';
import { ChatModel, ChatRequestModel, ChatResponseModel } from './chat-model';
import { ChatFeatureRegistry } from './chat.feature.registry';
import { ISessionModel, ISessionProvider } from './session-provider';
import { ISessionProviderRegistry } from './session-provider-registry';

const MAX_SESSION_COUNT = 20;

@Injectable()
export class AcpChatManagerService extends ChatManagerService {
  @Autowired(AINativeConfigService)
  protected readonly aiNativeConfig: AINativeConfigService;

  @Autowired(ISessionProviderRegistry)
  private sessionProviderRegistry: ISessionProviderRegistry;

  private mainProvider: ISessionProvider | null = null;

  private availableCommands: AvailableCommand[] = [];

  constructor() {
    super();
    const mode = this.aiNativeConfig.capabilities.supportsAgentMode ? 'acp' : 'local';
    const allProviders = this.sessionProviderRegistry.getAllProviders();
    const p = allProviders.filter((provider) => provider.canHandle(mode))[0];
    this.mainProvider = p;
  }

  override async init() {
    await this.loadSessionList();
  }

  async loadSessionList() {
    if (!this.mainProvider) {
      await this.storageInitEmitter.fireAndAwait();
      return;
    }

    try {
      const sessionsModelData = await this.mainProvider.loadSessions();
      const recentSessionsData = sessionsModelData.slice(-MAX_SESSION_COUNT);

      const activeKeys = new Set(this.sessionModels.keys());
      const filteredData = recentSessionsData.filter((item) => !activeKeys.has(item.sessionId));
      const maxIncoming = MAX_SESSION_COUNT - activeKeys.size;

      if (maxIncoming > 0) {
        const savedSessions = this.fromAcpJSON(filteredData.slice(-maxIncoming));
        savedSessions.forEach((session) => {
          this.sessionModels.set(session.sessionId, session);
        });
      }
    } catch (error) {
      this.sessionModels.clear();
    }

    await this.storageInitEmitter.fireAndAwait();
  }

  override getSessions() {
    return Array.from(this.sessionModels.values());
  }

  getAvailableCommands(): AvailableCommand[] {
    return this.availableCommands;
  }

  override async startSession(): Promise<ChatModel> {
    if (this.aiNativeConfig.capabilities.supportsAgentMode && this.mainProvider?.createSession) {
      const sessionData = await this.mainProvider.createSession();
      if (sessionData.extension?.availableCommands) {
        this.availableCommands = sessionData.extension.availableCommands;
      }
      const models = this.fromAcpJSON([sessionData]);
      if (models.length > 0) {
        const model = models[0];
        this.sessionModels.set(model.sessionId, model);
        this.listenSession(model);
        return model;
      }
    }

    const model = new ChatModel(this.chatFeatureRegistry);
    this.sessionModels.set(model.sessionId, model);
    this.listenSession(model);
    return model;
  }

  async loadSession(sessionId: string) {
    if (this.aiNativeConfig.capabilities.supportsAgentMode) {
      const existingSession = this.sessionModels.get(sessionId);
      if (existingSession?.history?.getMessages()?.length) {
        return;
      }

      if (this.mainProvider?.loadSession && sessionId) {
        return this.mainProvider.loadSession(sessionId).then((sessionData) => {
          if (sessionData) {
            const sessions = this.fromAcpJSON([sessionData]);
            if (sessions.length > 0) {
              const session = sessions[0];
              this.sessionModels.set(sessionId, session);
              this.listenSession(session);
            }
          }
        });
      }
    }
  }

  fallbackToLocal(): void {
    const localProvider = this.sessionProviderRegistry.getProvider('local');
    if (!localProvider) {
      return;
    }
    this.mainProvider = localProvider;
    this.sessionModels.clear();
    this.loadSessionList();
  }

  private toSessionData(model: ChatModel): ISessionModel {
    return {
      sessionId: model.sessionId,
      modelId: model.modelId,
      history: model.history.toJSON(),
      title: model.title,
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

  protected fromAcpJSON(data: ISessionModel[]) {
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

  @debounce(1000)
  protected override async saveSessions() {
    if (!this.mainProvider?.saveSessions) {
      return;
    }
    const sessionsData = this.getSessions().map((model) => this.toSessionData(model));
    await this.mainProvider.saveSessions(sessionsData);
  }
}

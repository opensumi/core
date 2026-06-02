import { Autowired, Injectable } from '@opensumi/di';
import { AINativeConfigService, ILogger } from '@opensumi/ide-core-browser';
import {
  AvailableCommand,
  ChatMessageRole,
  IStorage,
  STORAGE_NAMESPACE,
  StorageProvider,
  debounce,
} from '@opensumi/ide-core-common';

import { cleanAttachedTextWrapper } from '../../common/utils';
import { MsgHistoryManager } from '../model/msg-history-manager';

import { ChatManagerService } from './chat-manager.service';
import { ChatModel, ChatRequestModel, ChatResponseModel } from './chat-model';
import { ISessionModel, ISessionProvider } from './session-provider';
import { ISessionProviderRegistry } from './session-provider-registry';

const MAX_SESSION_COUNT = 20;
const MAX_TITLE_LENGTH = 100;
const DEFAULT_ACP_SESSION_TITLE = 'New Session';
const ACP_SESSION_DISPLAY_TITLE_OVERRIDES_KEY = 'acpSessionDisplayTitleOverrides';
const ACP_PROMPT_TITLE_PREFIXES = [
  'OpenSumi exposes IDE capabilities',
  "The user's OS version",
  'The rules section has',
  'For requests to create an OpenSumi IDE',
];

@Injectable()
export class AcpChatManagerService extends ChatManagerService {
  @Autowired(AINativeConfigService)
  protected readonly aiNativeConfig: AINativeConfigService;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired(ISessionProviderRegistry)
  private sessionProviderRegistry: ISessionProviderRegistry;

  @Autowired(StorageProvider)
  private readonly acpStorageProvider: StorageProvider;

  private mainProvider: ISessionProvider | null = null;

  private availableCommands: AvailableCommand[] = [];

  private acpTitleStorage: IStorage | undefined;

  private acpSessionDisplayTitleOverrides: Record<string, string> = {};

  constructor() {
    super();
    const mode = this.aiNativeConfig.capabilities.supportsAgentMode ? 'acp' : 'local';
    const allProviders = this.sessionProviderRegistry.getAllProviders();
    const p = allProviders.filter((provider) => provider.canHandle(mode))[0];
    this.mainProvider = p;
  }

  override async init() {
    await this.initDisplayTitleOverrides();
    await this.loadSessionList();
  }

  private async initDisplayTitleOverrides(): Promise<void> {
    try {
      this.acpTitleStorage = await this.acpStorageProvider(STORAGE_NAMESPACE.CHAT);
      this.acpSessionDisplayTitleOverrides =
        this.acpTitleStorage.get<Record<string, string>>(ACP_SESSION_DISPLAY_TITLE_OVERRIDES_KEY, {}) || {};
    } catch {
      this.acpTitleStorage = undefined;
      this.acpSessionDisplayTitleOverrides = {};
    }
  }

  private persistDisplayTitleOverrides(): void {
    this.acpTitleStorage?.set(ACP_SESSION_DISPLAY_TITLE_OVERRIDES_KEY, this.acpSessionDisplayTitleOverrides);
  }

  private getDisplayTitleOverride(sessionId: string): string | undefined {
    return this.acpSessionDisplayTitleOverrides[sessionId];
  }

  private peekSession(sessionId: string): ChatModel | undefined {
    const sessionModels = this.sessionModels as typeof this.sessionModels & {
      peek?: (key: string) => ChatModel | undefined;
    };

    return sessionModels.peek ? sessionModels.peek(sessionId) : sessionModels.get(sessionId);
  }

  override getSession(sessionId: string): ChatModel | undefined {
    if (this.aiNativeConfig.capabilities.supportsAgentMode) {
      return this.peekSession(sessionId);
    }

    return super.getSession(sessionId);
  }

  private setSessionPreservingOrder(sessionId: string, session: ChatModel): void {
    const sessionModels = this.sessionModels as typeof this.sessionModels & {
      keys?: () => Iterable<string>;
    };
    const sessionIds =
      sessionModels.has(sessionId) && sessionModels.keys ? Array.from(sessionModels.keys()) : undefined;

    this.sessionModels.set(sessionId, session);

    if (!sessionIds) {
      return;
    }

    const orderedSessions = sessionIds
      .map((id) => [id, id === sessionId ? session : this.peekSession(id)] as const)
      .filter((item): item is readonly [string, ChatModel] => Boolean(item[1]));

    this.sessionModels.clear();
    orderedSessions.forEach(([id, model]) => {
      this.sessionModels.set(id, model);
    });
  }

  private setDisplayTitleOverride(sessionId: string, title: string): void {
    const displayTitle = this.createDisplayTitle(title);
    if (!displayTitle) {
      return;
    }

    this.acpSessionDisplayTitleOverrides = {
      ...this.acpSessionDisplayTitleOverrides,
      [sessionId]: displayTitle,
    };
    this.peekSession(sessionId)?.setTitle(displayTitle);
    this.persistDisplayTitleOverrides();
  }

  private removeDisplayTitleOverride(sessionId: string): void {
    if (!this.acpSessionDisplayTitleOverrides[sessionId]) {
      return;
    }

    const nextOverrides = { ...this.acpSessionDisplayTitleOverrides };
    delete nextOverrides[sessionId];
    this.acpSessionDisplayTitleOverrides = nextOverrides;
    this.persistDisplayTitleOverrides();
  }

  private extractUserMessageFromAcpPrompt(text: string): string | undefined {
    const match = text.match(/(?:^|\n)\s*---\s*(?:\n+|\s+)([\s\S]*)$/);
    const userMessage = match?.[1]?.trim();
    return userMessage || undefined;
  }

  private createDisplayTitle(text: string | undefined): string {
    if (!text) {
      return '';
    }

    const userMessage = this.extractUserMessageFromAcpPrompt(text) || text;
    return cleanAttachedTextWrapper(userMessage).trim().slice(0, MAX_TITLE_LENGTH);
  }

  private isLikelyAcpContextTitle(title: string | undefined): boolean {
    if (!title) {
      return false;
    }

    return ACP_PROMPT_TITLE_PREFIXES.some((prefix) => title.trim().startsWith(prefix));
  }

  private createFallbackSessionTitle(sessionId: string): string {
    const rawSessionId = sessionId.startsWith('acp:') ? sessionId.slice(4) : sessionId;
    return `Session ${rawSessionId.slice(0, 8)}`;
  }

  private resolveTitleFromMessages(item: ISessionModel): string {
    const firstUserMessage =
      item.history.messages.find((message) => message.role === ChatMessageRole.User) || item.history.messages[0];

    return this.createDisplayTitle(firstUserMessage?.content);
  }

  private resolveAcpSessionTitle(item: ISessionModel): string {
    const overrideTitle = this.getDisplayTitleOverride(item.sessionId);
    if (overrideTitle) {
      return overrideTitle;
    }

    const extractedTitle = this.extractUserMessageFromAcpPrompt(item.title || '');
    if (extractedTitle) {
      return this.createDisplayTitle(extractedTitle);
    }

    const title = this.createDisplayTitle(item.title);
    if (title && !this.isLikelyAcpContextTitle(item.title)) {
      return title;
    }

    const messageTitle = this.resolveTitleFromMessages(item);
    if (messageTitle) {
      return messageTitle;
    }

    if (item.title && this.isLikelyAcpContextTitle(item.title)) {
      return this.createFallbackSessionTitle(item.sessionId);
    }

    return DEFAULT_ACP_SESSION_TITLE;
  }

  private getExistingTitleForLoadedSession(
    sessionId: string,
    existingSession: ChatModel | undefined,
  ): string | undefined {
    const overrideTitle = this.getDisplayTitleOverride(sessionId);
    if (overrideTitle) {
      return overrideTitle;
    }

    const existingTitle = existingSession?.title;
    if (existingTitle && !this.isLikelyAcpContextTitle(existingTitle)) {
      return existingTitle;
    }

    return undefined;
  }

  private isEmptyDefaultSession(model: ChatModel): boolean {
    return (
      model.title === DEFAULT_ACP_SESSION_TITLE &&
      model.history.getMessages().length === 0 &&
      model.requests.length === 0
    );
  }

  private moveEmptyDefaultSessionsToEnd(sessionIds: Set<string>): void {
    sessionIds.forEach((sessionId) => {
      const session = this.peekSession(sessionId);
      if (!session || !this.isEmptyDefaultSession(session)) {
        return;
      }

      this.sessionModels.delete(sessionId);
      this.sessionModels.set(sessionId, session);
    });
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
      this.moveEmptyDefaultSessionsToEnd(activeKeys);
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
      const existingSession = this.peekSession(sessionId);
      if (existingSession?.history?.getMessages()?.length) {
        return;
      }

      if (this.mainProvider?.loadSession && sessionId) {
        return this.mainProvider.loadSession(sessionId).then((sessionData) => {
          if (sessionData) {
            const existingTitle = this.getExistingTitleForLoadedSession(sessionId, existingSession);
            const sessionDataWithTitle =
              existingTitle && (!sessionData.title || this.isLikelyAcpContextTitle(sessionData.title))
                ? {
                    ...sessionData,
                    title: existingTitle,
                  }
                : sessionData;
            const sessions = this.fromAcpJSON([sessionDataWithTitle]);
            if (sessions.length > 0) {
              const session = sessions[0];
              this.setSessionPreservingOrder(sessionId, session);
              this.listenSession(session);
              if (
                !existingSession &&
                session.title &&
                session.title !== DEFAULT_ACP_SESSION_TITLE &&
                !this.isLikelyAcpContextTitle(session.title)
              ) {
                this.setDisplayTitleOverride(sessionId, session.title);
              }
            }
          }
        });
      }
    }
  }

  override createRequest(sessionId: string, message: string, agentId: string, command?: string, images?: string[]) {
    const model = this.getSession(sessionId);
    const shouldSetDisplayTitle =
      this.aiNativeConfig.capabilities.supportsAgentMode &&
      !this.getDisplayTitleOverride(sessionId) &&
      model &&
      ((model.history.getMessages().length === 0 && model.requests.length === 0) ||
        this.isLikelyAcpContextTitle(model.title));

    this.logger.log(
      `[ACP Chat][Manager] createRequest start — sessionId=${sessionId}, agentId=${agentId || '(empty)'}, command=${
        command || '(empty)'
      }, messageChars=${message.length}, images=${images?.length ?? 0}, existingRequests=${
        model?.requests.length ?? 0
      }, historyMessages=${model?.history.getMessages().length ?? 0}`,
    );

    const request = super.createRequest(sessionId, message, agentId, command, images);
    this.logger.log(
      `[ACP Chat][Manager] createRequest ${request ? 'done' : 'skipped'} — sessionId=${sessionId}, requestId=${
        request?.requestId ?? '(empty)'
      }`,
    );
    if (request && shouldSetDisplayTitle) {
      this.setDisplayTitleOverride(sessionId, message);
    }

    return request;
  }

  override async sendRequest(sessionId: string, request: ChatRequestModel, regenerate: boolean): Promise<void> {
    this.logger.log(
      `[ACP Chat][Manager] sendRequest start — sessionId=${sessionId}, requestId=${
        request.requestId
      }, regenerate=${regenerate}, agentId=${request.message.agentId}, command=${
        request.message.command || '(empty)'
      }, messageChars=${request.message.prompt.length}, images=${request.message.images?.length ?? 0}`,
    );
    try {
      await super.sendRequest(sessionId, request, regenerate);
      this.logger.log(`[ACP Chat][Manager] sendRequest done — sessionId=${sessionId}, requestId=${request.requestId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[ACP Chat][Manager] sendRequest error — sessionId=${sessionId}, requestId=${request.requestId}, error=${message}`,
      );
      throw error;
    }
  }

  protected override shouldValidateModelChange(sessionId: string): boolean {
    return !sessionId.startsWith('acp:');
  }

  override clearSession(sessionId: string): void {
    super.clearSession(sessionId);
    this.removeDisplayTitleOverride(sessionId);
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
          title: this.resolveAcpSessionTitle(item),
          agentModes: item.agentModes,
          currentModeId: item.currentModeId,
          agentModels: item.agentModels,
          configOptions: item.configOptions,
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

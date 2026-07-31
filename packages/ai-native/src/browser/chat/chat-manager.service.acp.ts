import { Autowired, Injectable } from '@opensumi/di';
import { AINativeConfigService, ILogger } from '@opensumi/ide-core-browser';
import {
  AvailableCommand,
  ChatMessageRole,
  Emitter,
  IChatProgress,
  IChatSessionSnapshot,
  IChatSessionState,
  IStorage,
  STORAGE_NAMESPACE,
  StorageProvider,
  debounce,
} from '@opensumi/ide-core-common';
import { IDisposable } from '@opensumi/ide-utils';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

import { cleanAttachedTextWrapper } from '../../common/utils';
import { createAcpAttachmentFailureFixture } from '../acp/acp-bdd-runtime-fixtures';
import { MsgHistoryManager } from '../model/msg-history-manager';

import { ChatManagerService } from './chat-manager.service';
import { ChatModel, ChatRequestModel, ChatResponseModel } from './chat-model';
import {
  ISessionModel,
  ISessionModelExtension,
  ISessionProvider,
  SessionCreationOptions,
  isAcpResponsePending,
} from './session-provider';
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

export interface AcpSessionStateChangeEvent {
  sessionId: string;
  model: ChatModel;
  previousModeId?: string;
  currentModeId?: string;
  availableCommands?: AvailableCommand[];
}

export type AcpSessionLiveReadyStatus = 'ready' | 'failed';

export interface AcpSessionLoadResult {
  liveReady: Promise<AcpSessionLiveReadyStatus>;
}

type AcpSessionModelData = ISessionModel & { extension?: ISessionModelExtension };

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

  private localFallbackActive = false;

  private availableCommands: AvailableCommand[] = [];

  private acpTitleStorage: IStorage | undefined;

  private acpSessionDisplayTitleOverrides: Record<string, string> = {};

  private sessionAttachments:
    | Map<string, { stream: SumiReadableStream<IChatProgress>; disposables: IDisposable[] }>
    | undefined;
  private readonly ownedBackendSessions = new Set<string>();
  private readonly sessionDisposeRequests = new Map<string, { generation: number; promise: Promise<void> }>();
  private readonly sessionLoadGenerations = new Map<string, number>();
  private readonly sessionLifecycleOperations = new Map<string, Promise<void>>();
  private readonly shouldFailBddAttachment = createAcpAttachmentFailureFixture();

  private readonly onDidApplySessionStateEmitter = this.registerDispose(new Emitter<AcpSessionStateChangeEvent>());
  public readonly onDidApplySessionState = this.onDidApplySessionStateEmitter.event;

  constructor() {
    super();
    const mode = this.aiNativeConfig.capabilities.supportsAgentMode ? 'acp' : 'local';
    const allProviders = this.sessionProviderRegistry.getAllProviders();
    const p = allProviders.filter((provider) => provider.canHandle(mode))[0];
    this.mainProvider = p;
  }

  private useAcpProviderWhenAvailable(): void {
    const canHandle = this.mainProvider?.canHandle;
    if (
      this.localFallbackActive ||
      !this.aiNativeConfig.capabilities.supportsAgentMode ||
      typeof canHandle !== 'function' ||
      canHandle.call(this.mainProvider, 'acp')
    ) {
      return;
    }

    this.mainProvider =
      this.sessionProviderRegistry.getAllProviders().find((provider) => provider.canHandle('acp')) || null;
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
    this.useAcpProviderWhenAvailable();
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

  override async startSession(options?: SessionCreationOptions): Promise<ChatModel> {
    this.useAcpProviderWhenAvailable();
    if (this.aiNativeConfig.capabilities.supportsAgentMode && this.mainProvider?.createSession) {
      const sessionData = await this.mainProvider.createSession(options);
      if (sessionData.extension?.availableCommands) {
        this.availableCommands = sessionData.extension.availableCommands;
      }
      const models = this.fromAcpJSON([sessionData]);
      if (models.length > 0) {
        const model = models[0];
        this.ownedBackendSessions.add(model.sessionId);
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

  async loadSession(sessionId: string): Promise<AcpSessionLoadResult> {
    const loadGeneration = (this.sessionLoadGenerations.get(sessionId) || 0) + 1;
    this.sessionLoadGenerations.set(sessionId, loadGeneration);
    let liveReady: Promise<AcpSessionLiveReadyStatus> = Promise.resolve('ready');
    await this.enqueueSessionLifecycle(sessionId, async () => {
      this.useAcpProviderWhenAvailable();
      if (this.aiNativeConfig.capabilities.supportsAgentMode) {
        const existingSession = this.peekSession(sessionId);
        const hasLoadedHistory = Boolean(existingSession?.history?.getMessages()?.length);

        if (this.mainProvider && sessionId) {
          let loaded = false;
          if (!hasLoadedHistory && this.mainProvider.loadSession) {
            const sessionData = await this.mainProvider.loadSession(sessionId);
            if (sessionData) {
              loaded = true;
              this.ownedBackendSessions.add(sessionId);
              this.restoreLoadedSession(sessionId, sessionData, existingSession);
            }
          }
          liveReady = (async () => {
            if (this.shouldFailBddAttachment()) {
              throw new Error('BDD attachment transport unavailable');
            }
            const attachment = await this.mainProvider?.attachSession?.(sessionId);
            if (this.sessionLoadGenerations.get(sessionId) !== loadGeneration || !this.peekSession(sessionId)) {
              attachment?.end();
              return 'failed' as const;
            }
            if (attachment) {
              this.observeSessionAttachment(sessionId, attachment);
            }
            if (loaded) {
              this.ownedBackendSessions.add(sessionId);
            }
            return 'ready' as const;
          })().catch((error) => {
            this.logger.error(
              `[ACP Chat][Manager] attach session failed after restoring history — errorType=${
                error instanceof Error ? error.name : typeof error
              }`,
            );
            return 'failed' as const;
          });
        }
      }
    });
    return { liveReady };
  }

  private enqueueSessionLifecycle<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
    const previousOperation = this.sessionLifecycleOperations.get(sessionId) || Promise.resolve();
    const currentOperation = previousOperation.catch(() => undefined).then(operation);
    const settledOperation = currentOperation.then(
      () => undefined,
      () => undefined,
    );
    this.sessionLifecycleOperations.set(sessionId, settledOperation);
    void settledOperation.then(() => {
      if (this.sessionLifecycleOperations.get(sessionId) === settledOperation) {
        this.sessionLifecycleOperations.delete(sessionId);
      }
    });
    return currentOperation;
  }

  private restoreLoadedSession(sessionId: string, sessionData: ISessionModel, existingSession?: ChatModel): void {
    const existingTitle = this.getExistingTitleForLoadedSession(sessionId, existingSession);
    const sessionDataWithTitle =
      existingTitle && (!sessionData.title || this.isLikelyAcpContextTitle(sessionData.title))
        ? { ...sessionData, title: existingTitle }
        : sessionData;
    const [session] = this.fromAcpJSON([sessionDataWithTitle]);
    if (!session) {
      return;
    }
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

  private getSessionAttachments(): Map<
    string,
    { stream: SumiReadableStream<IChatProgress>; disposables: IDisposable[] }
  > {
    if (!this.sessionAttachments) {
      this.sessionAttachments = new Map();
    }
    return this.sessionAttachments;
  }

  private observeSessionAttachment(sessionId: string, stream: SumiReadableStream<IChatProgress>): void {
    const attachments = this.getSessionAttachments();
    const previous = attachments.get(sessionId);
    if (previous) {
      previous.disposables.forEach((disposable) => disposable.dispose());
      previous.stream.end();
    }

    const applyThreadStatus = (status: IChatSessionSnapshot['threadStatus']) => {
      const model = this.getSession(sessionId);
      if (!model) {
        return;
      }
      model.setThreadStatus(status);
      if (!isAcpResponsePending(status)) {
        const request = model.requests[model.requests.length - 1];
        if (request && !request.response.isComplete) {
          request.response.complete();
        }
      }
    };

    const disposables: IDisposable[] = [];
    const cleanup = () => {
      if (attachments.get(sessionId)?.stream === stream) {
        attachments.delete(sessionId);
      }
      disposables.splice(0).forEach((disposable) => disposable.dispose());
    };

    const register = (factory: () => IDisposable) => {
      const disposable = factory();
      if (attachments.get(sessionId)?.stream !== stream) {
        disposable.dispose();
      } else {
        disposables.push(disposable);
      }
    };

    attachments.set(sessionId, { stream, disposables });
    register(() =>
      stream.onData((progress) => {
        if (progress.kind === 'sessionSnapshot') {
          const restoredSession = this.mainProvider?.restoreSessionSnapshot?.(sessionId, progress);
          if (restoredSession) {
            this.restoreLoadedSession(sessionId, restoredSession, this.peekSession(sessionId));
          }
          applyThreadStatus(progress.threadStatus);
          this.applySessionStateUpdate(sessionId, {
            currentModeId: progress.currentModeId,
            currentModelId: progress.currentModelId,
            configOptions: progress.configOptions,
          });
          return;
        }
        if (progress.kind === 'threadStatus') {
          applyThreadStatus(progress.threadStatus);
          return;
        }
        if (progress.kind === 'sessionState') {
          this.applySessionStateUpdate(sessionId, progress);
          return;
        }

        const model = this.getSession(sessionId);
        const request = model?.requests[model.requests.length - 1];
        if (model && request && !request.response.isComplete) {
          model.acceptResponseProgress(request, progress);
        }
      }),
    );
    register(() => stream.onEnd(cleanup));
    register(() => stream.onError(cleanup));
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

  override async sendRequest(
    sessionId: string,
    request: ChatRequestModel,
    regenerate: boolean,
    onRequestAccepted?: () => void,
  ): Promise<void> {
    this.logger.log(
      `[ACP Chat][Manager] sendRequest start — sessionId=${sessionId}, requestId=${
        request.requestId
      }, regenerate=${regenerate}, agentId=${request.message.agentId}, command=${
        request.message.command || '(empty)'
      }, messageChars=${request.message.prompt.length}, images=${request.message.images?.length ?? 0}`,
    );
    try {
      await super.sendRequest(sessionId, request, regenerate, onRequestAccepted);
      this.logger.log(`[ACP Chat][Manager] sendRequest done — sessionId=${sessionId}, requestId=${request.requestId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[ACP Chat][Manager] sendRequest error — sessionId=${sessionId}, requestId=${request.requestId}, error=${message}`,
      );
      throw error;
    }
  }

  override cancelRequest(sessionId: string): boolean {
    const canceledPendingRequest = super.cancelRequest(sessionId);
    if (canceledPendingRequest) {
      return true;
    }

    const model = this.getSession(sessionId);
    if (!model || !isAcpResponsePending(model.threadStatus) || !this.mainProvider?.cancelSession) {
      return false;
    }

    void this.mainProvider.cancelSession(sessionId).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[ACP Chat][Manager] cancel attached session failed — sessionId=${sessionId}, error=${message}`,
      );
    });
    return true;
  }

  protected override shouldValidateModelChange(sessionId: string): boolean {
    return !sessionId.startsWith('acp:');
  }

  override clearSession(sessionId: string): void {
    super.clearSession(sessionId);
    this.removeDisplayTitleOverride(sessionId);
  }

  async disposeSession(sessionId: string, force = false): Promise<void> {
    const generation = this.sessionLoadGenerations.get(sessionId) || 0;
    const existingRequest = this.sessionDisposeRequests.get(sessionId);
    if (existingRequest?.generation === generation) {
      return existingRequest.promise;
    }

    const disposal = this.enqueueSessionLifecycle(sessionId, async () => {
      const attachment = this.sessionAttachments?.get(sessionId);
      if (attachment) {
        this.sessionAttachments?.delete(sessionId);
        attachment.disposables.forEach((disposable) => disposable.dispose());
        attachment.stream.end();
      }
      if (!force && !this.ownedBackendSessions.has(sessionId)) {
        if (this.getSession(sessionId)) {
          this.clearSession(sessionId);
        }
        return;
      }

      try {
        if (force) {
          await this.mainProvider?.disposeSession?.(sessionId, true);
        } else {
          await this.mainProvider?.disposeSession?.(sessionId);
        }
        this.ownedBackendSessions.delete(sessionId);
      } finally {
        if (this.getSession(sessionId)) {
          this.clearSession(sessionId);
        }
      }
    });
    const trackedDisposal = disposal.finally(() => {
      if (this.sessionDisposeRequests.get(sessionId)?.promise === trackedDisposal) {
        this.sessionDisposeRequests.delete(sessionId);
      }
    });
    this.sessionDisposeRequests.set(sessionId, { generation, promise: trackedDisposal });
    return trackedDisposal;
  }

  applySessionStateUpdate(sessionId: string, state: Partial<Omit<IChatSessionState, 'kind' | 'sessionId'>>): void {
    const lookupKey = sessionId.startsWith('acp:') ? sessionId : `acp:${sessionId}`;
    const model = this.getSession(lookupKey);
    if (!model) {
      return;
    }

    const previousModeId = model.currentModeId;
    let changed = false;

    if (state.currentModeId !== undefined && model.currentModeId !== state.currentModeId) {
      model.currentModeId = state.currentModeId;
      changed = true;
    }
    if (state.currentModelId !== undefined && model.modelId !== state.currentModelId) {
      model.modelId = state.currentModelId;
      changed = true;
    }
    if (state.configOptions !== undefined) {
      model.configOptions = state.configOptions;
      changed = true;
    }
    if (state.availableCommands !== undefined) {
      this.availableCommands = state.availableCommands;
      changed = true;
    }

    if (!changed) {
      return;
    }

    this.onDidApplySessionStateEmitter.fire({
      sessionId: lookupKey,
      model,
      previousModeId,
      currentModeId: model.currentModeId,
      availableCommands: state.availableCommands,
    });
  }

  fallbackToLocal(): void {
    const localProvider = this.sessionProviderRegistry.getProvider('local');
    if (!localProvider) {
      return;
    }
    this.localFallbackActive = true;
    this.mainProvider = localProvider;
    this.sessionModels.clear();
    this.loadSessionList();
  }

  private toSessionData(model: ChatModel): ISessionModel {
    return {
      sessionId: model.sessionId,
      createdAt: model.createdAt,
      modelId: model.modelId,
      history: model.history.toJSON(),
      title: model.title,
      requests: model.getRequests().map((request) => ({
        requestId: request.requestId,
        message: request.message,
        response: {
          isCanceled: request.response.isCanceled,
          isComplete: request.response.isComplete,
          responseText: request.response.responseText,
          responseContents: request.response.responseContents,
          responseParts: request.response.responseParts,
          errorDetails: request.response.errorDetails,
          followups: request.response.followups,
        },
      })),
    };
  }

  protected fromAcpJSON(data: AcpSessionModelData[]) {
    return data
      .filter((item) => item.history.messages.length > 0 || item.sessionId.startsWith('acp:'))
      .map((item) => {
        const model = new ChatModel(this.chatFeatureRegistry, {
          sessionId: item.sessionId,
          createdAt: item.createdAt,
          history: new MsgHistoryManager(this.chatFeatureRegistry, item.history),
          modelId: item.modelId,
          title: this.resolveAcpSessionTitle(item),
          agentModes: item.agentModes,
          currentModeId: item.currentModeId,
          agentModels: item.agentModels,
          configOptions: item.configOptions,
          acpTarget: item.extension?.acpTarget,
        });
        const requests = item.requests.map(
          (request) =>
            new ChatRequestModel(
              request.requestId,
              model,
              request.message,
              new ChatResponseModel(request.requestId, model, request.message.agentId, {
                responseContents: request.response.responseContents,
                isComplete: request.response.isComplete ?? true,
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

  override dispose(): void {
    this.sessionAttachments?.forEach(({ stream, disposables }) => {
      disposables.forEach((disposable) => disposable.dispose());
      stream.end();
    });
    this.sessionAttachments?.clear();
    super.dispose();
  }
}

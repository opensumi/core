import { Autowired, Injectable } from '@opensumi/di';
import { AINativeConfigService, ILogger } from '@opensumi/ide-core-browser';
import {
  ACP_SESSION_NOT_FOUND_ERROR_NAME,
  AcpTargetConfigRequest,
  AvailableCommand,
  ChatMessageRole,
  Emitter,
  Event,
  IACPConfigProvider,
  IDisposable,
  ThreadStatus,
  URI,
} from '@opensumi/ide-core-common';
import { IMessageService } from '@opensumi/ide-overlay';

import { AgenticTaskRegistryService, AgenticTaskStatus } from '../acp/agentic-task-registry.service';
import { AcpPermissionBridgeService } from '../acp/permission-bridge.service';
import { AIPanelLayoutService } from '../layout/panel-layout.service';

import { AcpChatManagerService } from './chat-manager.service.acp';
import { ChatModel, ChatRequestModel } from './chat-model';
import { ChatInternalService } from './chat.internal.service';
import {
  AcpAgentSessionDescriptor,
  AcpSessionConfigOption,
  AcpSessionModeOption,
  AcpSessionModelOption,
} from './session-provider';

import type { AcpTurnDraft } from './acp-chat-queued-turns';

const ACP_LOAD_SESSION_FALLBACK_MESSAGE =
  'Unable to open this chat history. A new chat draft is ready, and a session will be created when you send a message.';
const ACP_LOAD_SESSION_NOT_FOUND_MESSAGE =
  'This chat history is no longer available. A new chat draft is ready, and a session will be created when you send a message.';
const ACP_LOAD_TASK_FALLBACK_MESSAGE = 'Unable to open this task history. The previous Task remains active.';
const ACP_LOAD_TASK_NOT_FOUND_MESSAGE = 'This task history is no longer available. The previous Task remains active.';
const ACP_SESSION_CREATION_CANCELLED_ERROR_NAME = 'ACP_SESSION_CREATION_CANCELLED';

function createSessionCreationCancelledError(): Error {
  const error = new Error('ACP session creation was cancelled.');
  error.name = ACP_SESSION_CREATION_CANCELLED_ERROR_NAME;
  return error;
}

export function formatAcpLoadSessionFallbackMessage(error: unknown): string {
  if (isAcpSessionNotFoundError(error)) {
    return ACP_LOAD_SESSION_NOT_FOUND_MESSAGE;
  }

  return ACP_LOAD_SESSION_FALLBACK_MESSAGE;
}
function formatAcpLoadTaskFallbackMessage(error: unknown): string {
  if (isAcpSessionNotFoundError(error)) {
    return ACP_LOAD_TASK_NOT_FOUND_MESSAGE;
  }

  return ACP_LOAD_TASK_FALLBACK_MESSAGE;
}

function isAcpSessionNotFoundError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && (error as { name?: unknown }).name === ACP_SESSION_NOT_FOUND_ERROR_NAME,
  );
}

export type AgenticTaskSessionActivationStatus = 'activated' | 'superseded' | 'conversation-unavailable' | 'failed';

export interface AgenticTaskSessionActivationResult {
  status: AgenticTaskSessionActivationStatus;
}

export type AgenticTaskSessionValidationResult =
  | { status: 'validated'; taskStatus: AgenticTaskStatus }
  | { status: 'superseded' | 'conversation-unavailable' | 'failed' };

function updateConfigOptionValue(option: Record<string, any>, value: boolean | string): Record<string, any> {
  const next = { ...option };
  if (next.kind && typeof next.kind === 'object') {
    next.kind = { ...next.kind };
    if ('currentValue' in next.kind) {
      next.kind.currentValue = value;
    }
  }
  if ('currentValue' in next) {
    next.currentValue = value;
  }
  if ('value' in next) {
    next.value = value;
  }
  if ('current_value' in next) {
    next.current_value = value;
  }
  return next;
}

function readConfigOptionId(option: AcpSessionConfigOption): string | undefined {
  const rawId = option.id || option.configId;
  if (typeof rawId === 'string') {
    return rawId;
  }
  if (rawId && typeof rawId === 'object' && typeof (rawId as { id?: unknown }).id === 'string') {
    return (rawId as { id: string }).id;
  }
  return undefined;
}

function readConfigOptionValue(option: AcpSessionConfigOption): boolean | string | undefined {
  const kind = option.kind && typeof option.kind === 'object' ? option.kind : undefined;
  const value = kind?.currentValue ?? option.currentValue ?? option.current_value ?? option.value;
  return typeof value === 'boolean' || typeof value === 'string' ? value : undefined;
}

function cloneConfigOptions(configOptions?: AcpSessionConfigOption[]): AcpSessionConfigOption[] | undefined {
  return configOptions?.map((option) => ({ ...option }));
}

interface AcpDraftSessionState {
  agentModes?: AcpSessionModeOption[];
  currentModeId?: string;
  agentModels?: AcpSessionModelOption[];
  modelId?: string;
  configOptions?: AcpSessionConfigOption[];
}

/**
 * Page-local ownership of the ordinary ACP Session acquired for an unsent
 * Agentic draft. This is deliberately not durable state: the Agent remains
 * authoritative for the Session itself and its catalog.
 */
interface AcpDraftBoundSessionOwnership {
  sessionId: string;
  deleteOnDiscard: boolean;
  generation: number;
}

export type AcpSkillCatalogState = 'unavailable' | 'pending' | 'empty' | 'ready';

@Injectable()
export class AcpChatInternalService extends ChatInternalService {
  @Autowired(AINativeConfigService)
  protected aiNativeConfigService: AINativeConfigService;

  @Autowired(IACPConfigProvider)
  private configProvider: IACPConfigProvider;

  @Autowired(IMessageService)
  private messageService: IMessageService;

  @Autowired(AcpPermissionBridgeService)
  private permissionBridgeService: AcpPermissionBridgeService;

  @Autowired(AgenticTaskRegistryService)
  private agenticTaskRegistry: AgenticTaskRegistryService;

  @Autowired(AIPanelLayoutService)
  private panelLayoutService: AIPanelLayoutService;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  private readonly _onModeChange = new Emitter<string>();
  public readonly onModeChange: Event<string> = this._onModeChange.event;

  private readonly _onSessionLoadingChange = new Emitter<boolean>();
  public readonly onSessionLoadingChange: Event<boolean> = this._onSessionLoadingChange.event;
  private sessionLoadingCount = 0;
  private readonly agenticSessionLiveReadyStatuses = new Map<string, 'pending' | 'ready' | 'failed'>();
  private pendingAgenticSessionId: string | undefined;

  public get isSessionLoading(): boolean {
    return this.sessionLoadingCount > 0;
  }

  public getAgenticSessionLiveReadyStatus(sessionId: string | undefined): 'pending' | 'ready' | 'failed' {
    return sessionId ? this.agenticSessionLiveReadyStatuses.get(sessionId) || 'ready' : 'ready';
  }

  public getPendingAgenticSessionId(): string | undefined {
    return this.pendingAgenticSessionId;
  }

  /** Reconnect the active task without replaying its prompt or transcript. */
  async retryAgenticSessionConnection(sessionId: string): Promise<void> {
    if (this._sessionModel?.sessionId !== sessionId || this.getAgenticSessionLiveReadyStatus(sessionId) !== 'failed') {
      return;
    }

    this.agenticSessionLiveReadyStatuses.set(sessionId, 'pending');
    this.beginSessionLoading();
    try {
      const acpManager = this.chatManagerService as AcpChatManagerService;
      const loadResult = await acpManager.loadSession(sessionId);
      const status = await loadResult.liveReady;
      if (this._sessionModel?.sessionId === sessionId) {
        this.agenticSessionLiveReadyStatuses.set(sessionId, status);
      }
    } catch {
      if (this._sessionModel?.sessionId === sessionId) {
        this.agenticSessionLiveReadyStatuses.set(sessionId, 'failed');
      }
    } finally {
      this.endSessionLoading();
    }
  }

  private readonly _onSessionModelChange = new Emitter<ChatModel | undefined>();
  public readonly onSessionModelChange: Event<ChatModel | undefined> = this._onSessionModelChange.event;

  private readonly _onAvailableCommandsChange = new Emitter<AvailableCommand[]>();
  public readonly onAvailableCommandsChange: Event<AvailableCommand[]> = this._onAvailableCommandsChange.event;

  private readonly _onSkillCatalogStateChange = new Emitter<AcpSkillCatalogState>();
  public readonly onSkillCatalogStateChange: Event<AcpSkillCatalogState> = this._onSkillCatalogStateChange.event;

  private availableCommands: AvailableCommand[] = [];
  private skillCatalogState: AcpSkillCatalogState = 'unavailable';

  private draftSessionState: AcpDraftSessionState = {};
  private inputDraft: AcpTurnDraft | undefined;

  private sessionStateDisposable: IDisposable | undefined;

  private storageInitDisposable: IDisposable | undefined;

  private sessionCreationPromise: Promise<ChatModel> | undefined;
  private sessionCreationOperationId: string | undefined;
  private sessionCreationGeneration = 0;
  private nextSessionCreationId = 1;

  private draftBoundSession: AcpDraftBoundSessionOwnership | undefined;
  private draftBoundSessionPreparation: Promise<ChatModel | undefined> | undefined;
  private draftBoundSessionGeneration = 0;

  private lifecycleGeneration = 0;

  /**
   * Guards all asynchronous session activations. A later user selection must
   * always win, regardless of whether it came from the regular history or
   * the Agentic Task list.
   */
  private sessionSelectionVersion = 0;

  private pendingAgenticTarget: AcpTargetConfigRequest | undefined;
  private standbyTargetTimer: ReturnType<typeof setTimeout> | undefined;
  private standbyTargetGeneration = 0;

  private readonly agentSessionCatalogRefreshBarriers = new Map<string, Promise<void>>();
  private readonly requestCancellationGenerations = new Map<string, number>();
  private readonly acceptedRequestSessions = new Set<string>();
  private beginSessionLoading(): void {
    this.sessionLoadingCount += 1;
    if (this.sessionLoadingCount === 1) {
      this._onSessionLoadingChange.fire(true);
    }
  }

  private endSessionLoading(): void {
    if (this.sessionLoadingCount === 0) {
      return;
    }
    this.sessionLoadingCount -= 1;
    if (this.sessionLoadingCount === 0) {
      this._onSessionLoadingChange.fire(false);
    }
  }

  private clearPendingAgenticSession(sessionId: string): void {
    if (this.pendingAgenticSessionId === sessionId) {
      this.pendingAgenticSessionId = undefined;
    }
  }

  private stripAcpPrefix(sessionId: string): string {
    return sessionId.startsWith('acp:') ? sessionId.slice(4) : sessionId;
  }

  getAvailableCommands(): AvailableCommand[] {
    return this.availableCommands;
  }

  getSkillCatalogState(): AcpSkillCatalogState {
    return this.skillCatalogState;
  }

  private setSkillCatalogState(state: AcpSkillCatalogState): void {
    if (this.skillCatalogState !== state) {
      this.skillCatalogState = state;
      this._onSkillCatalogStateChange.fire(state);
    }
  }

  setAvailableCommands(commands: AvailableCommand[]) {
    this.availableCommands = commands;
    this._onAvailableCommandsChange.fire(commands);
    if (this._sessionModel) {
      this.setSkillCatalogState(commands.length > 0 ? 'ready' : 'empty');
    }
  }

  getDraftSessionState(): AcpDraftSessionState {
    return this.draftSessionState;
  }

  getInputDraft(): AcpTurnDraft | undefined {
    return this.inputDraft ? this.cloneInputDraft(this.inputDraft) : undefined;
  }

  updateInputDraft(draft: AcpTurnDraft | undefined): void {
    this.inputDraft = draft ? this.cloneInputDraft(draft) : undefined;
  }

  getVisibleSessions(): ChatModel[] {
    return this.chatManagerService.getSessions();
  }

  public get onStorageInit() {
    return this.chatManagerService.onStorageInit;
  }

  override createRequest(
    input: string,
    agentId: string,
    images?: string[],
    command?: string,
  ): ChatRequestModel | undefined {
    const sessionId = this._sessionModel?.sessionId;
    this.logger.log(
      `[ACP Chat][Frontend] createRequest start — sessionId=${sessionId ?? '(empty)'}, agentId=${
        agentId || '(empty)'
      }, command=${command || '(empty)'}, messageChars=${input.length}, images=${images?.length ?? 0}`,
    );

    const request = super.createRequest(input, agentId, images, command);
    this.logger.log(
      `[ACP Chat][Frontend] createRequest ${request ? 'done' : 'skipped'} — sessionId=${
        sessionId ?? '(empty)'
      }, requestId=${request?.requestId ?? '(empty)'}`,
    );
    return request;
  }

  override async sendRequest(
    request: ChatRequestModel,
    regenerate = false,
    onRequestAccepted?: () => void,
  ): Promise<void> {
    const lifecycleGeneration = this.lifecycleGeneration;
    const sessionId = this._sessionModel?.sessionId;
    const cancellationGeneration = sessionId ? this.requestCancellationGenerations.get(sessionId) || 0 : 0;
    const shouldRegisterAgenticTask = Boolean(sessionId && this.isAgenticLayout());
    let requestAccepted = false;
    this.logger.log(
      `[ACP Chat][Frontend] sendRequest start — sessionId=${sessionId ?? '(empty)'}, requestId=${
        request.requestId
      }, regenerate=${regenerate}, agentId=${request.message.agentId}, command=${
        request.message.command || '(empty)'
      }, messageChars=${request.message.prompt.length}, images=${request.message.images?.length ?? 0}`,
    );

    const handleError = (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!request.response.isComplete) {
        request.response.setErrorDetails({ message });
        request.response.complete();
      }
      this.logger.error(
        `[ACP Chat][Frontend] sendRequest error — sessionId=${sessionId ?? '(empty)'}, requestId=${
          request.requestId
        }, error=${message}`,
      );
    };

    if (!sessionId) {
      handleError(new Error('Cannot send an ACP chat request without an active session.'));
      return;
    }

    if (lifecycleGeneration !== this.lifecycleGeneration) {
      handleError(new Error('ACP chat service was disposed before request kickoff.'));
      return;
    }
    if ((this.requestCancellationGenerations.get(sessionId) || 0) !== cancellationGeneration) {
      if (!request.response.isComplete) {
        request.response.complete();
      }
      return;
    }

    try {
      let registrationBarrier = this.agentSessionCatalogRefreshBarriers.get(sessionId);
      const result = this.chatManagerService.sendRequest(sessionId, request, regenerate, () => {
        requestAccepted = true;
        this.acceptedRequestSessions.add(sessionId);
        if (this.draftBoundSession?.sessionId === sessionId) {
          this.draftBoundSession = undefined;
        }
        onRequestAccepted?.();
        if (shouldRegisterAgenticTask && !registrationBarrier) {
          registrationBarrier = this.getAgentSessionCatalogRefreshBarrier(request, sessionId);
        }
      });
      if (regenerate) {
        this._onRegenerateRequest.fire();
      }
      await result;
      if (shouldRegisterAgenticTask && !requestAccepted && !this.acceptedRequestSessions.has(sessionId)) {
        throw new Error(request.response.errorDetails?.message || 'ACP request ended before it was accepted.');
      }
      await registrationBarrier;
      this.logger.log(`[ACP Chat][Frontend] sendRequest done — sessionId=${sessionId}, requestId=${request.requestId}`);
    } catch (error) {
      handleError(error);
      if (
        shouldRegisterAgenticTask &&
        !requestAccepted &&
        !this.acceptedRequestSessions.has(sessionId) &&
        this.draftBoundSession?.sessionId !== sessionId
      ) {
        await this.releaseUnacceptedTaskLaunchSession(sessionId);
      }
    }
  }

  private async releaseUnacceptedTaskLaunchSession(sessionId: string): Promise<void> {
    const draftBoundSession = this.draftBoundSession;
    if (draftBoundSession?.sessionId === sessionId) {
      await this.releaseDraftBoundSession(draftBoundSession, true);
      return;
    }
    const sessionModel = this.chatManagerService.getSession(sessionId);
    await (this.chatManagerService as AcpChatManagerService).disposeSession(sessionId);
    if (sessionModel && this._sessionModel === sessionModel) {
      this.enterDraftSession({ force: true });
    }
  }

  override cancelRequest(): void {
    const sessionId = this._sessionModel?.sessionId;
    if (sessionId) {
      this.requestCancellationGenerations.set(sessionId, (this.requestCancellationGenerations.get(sessionId) || 0) + 1);
    }
    super.cancelRequest();
  }

  override init() {
    if (this.storageInitDisposable) {
      return;
    }

    this.ensureSessionStateListener();

    this.storageInitDisposable = this.chatManagerService.onStorageInit(async () => {
      if (this.aiNativeConfigService.capabilities.supportsAgentMode) {
        if (this.isAgenticLayout()) {
          await (this.chatManagerService as AcpChatManagerService).refreshAgentSessionCatalog();
        }
        return;
      }
      const sessions = this.chatManagerService.getSessions();
      if (sessions.length > 0) {
        await this.activateSession(sessions[sessions.length - 1].sessionId);
      } else {
        await this.createSessionModel();
      }
    });
    this.addDispose(this.storageInitDisposable);
  }

  private ensureSessionStateListener(): void {
    if (this.sessionStateDisposable) {
      return;
    }

    const acpManager = this.chatManagerService as AcpChatManagerService;
    if (!acpManager.onDidApplySessionState) {
      return;
    }

    this.sessionStateDisposable = acpManager.onDidApplySessionState((event) => {
      if (!this._sessionModel || event.sessionId !== this._sessionModel.sessionId) {
        return;
      }

      if (event.modelReplaced && event.model !== this._sessionModel) {
        this._sessionModel = event.model;
      }
      this._onSessionModelChange.fire(this._sessionModel);
      if (event.availableCommands !== undefined) {
        this.setAvailableCommands(event.availableCommands);
      }
      if (event.currentModeId !== undefined && event.currentModeId !== event.previousModeId) {
        this._onModeChange.fire(event.currentModeId);
      }
    });
    this.addDispose(this.sessionStateDisposable);
  }

  private async doStartSessionModel(
    operationId: string,
    generation: number,
    draftBoundSession?: Pick<AcpDraftBoundSessionOwnership, 'deleteOnDiscard' | 'generation'>,
  ): Promise<ChatModel> {
    const draftSessionState = this.draftSessionState;
    const target = this.pendingAgenticTarget;
    if (target) {
      this.pendingAgenticTarget = target;
      await this.flushStandbyTarget(target);
    }
    const acpManager = this.chatManagerService as AcpChatManagerService;
    const sessionModel = await acpManager.startSession({ acpTarget: target, operationId });
    const acquiredDraftBoundSession = draftBoundSession && {
      sessionId: sessionModel.sessionId,
      ...draftBoundSession,
    };
    if (
      generation !== this.sessionCreationGeneration ||
      (acquiredDraftBoundSession && acquiredDraftBoundSession.generation !== this.draftBoundSessionGeneration)
    ) {
      if (acquiredDraftBoundSession) {
        await this.releaseDraftBoundSession(acquiredDraftBoundSession, false);
      } else {
        await acpManager.disposeSession(sessionModel.sessionId);
      }
      throw createSessionCreationCancelledError();
    }
    this.pendingAgenticTarget = undefined;
    await this.applyDraftSessionState(sessionModel, draftSessionState);
    if (
      generation !== this.sessionCreationGeneration ||
      (acquiredDraftBoundSession && acquiredDraftBoundSession.generation !== this.draftBoundSessionGeneration)
    ) {
      if (acquiredDraftBoundSession) {
        await this.releaseDraftBoundSession(acquiredDraftBoundSession, false);
      } else {
        await acpManager.disposeSession(sessionModel.sessionId);
      }
      throw createSessionCreationCancelledError();
    }
    this._sessionModel = sessionModel;
    if (acquiredDraftBoundSession) {
      this.draftBoundSession = acquiredDraftBoundSession;
    }
    this.setAvailableCommands(acpManager.getAvailableCommands(this._sessionModel.sessionId));
    this.draftSessionState = this.createDraftStateFromModel(this._sessionModel) || {};
    this._onSessionModelChange.fire(this._sessionModel);
    // Notify permission bridge of session change
    const rawSessionId = this.stripAcpPrefix(this._sessionModel.sessionId);
    this.permissionBridgeService.setActiveSession(rawSessionId);
    this._onChangeSession.fire(this._sessionModel.sessionId);
    return this._sessionModel;
  }

  private async startSessionModel(
    draftBoundSession?: Pick<AcpDraftBoundSessionOwnership, 'deleteOnDiscard' | 'generation'>,
  ): Promise<ChatModel> {
    if (this.sessionCreationPromise) {
      return this.sessionCreationPromise;
    }

    this.beginSessionLoading();
    const operationId = `acp-launch-${Date.now()}-${this.nextSessionCreationId++}`;
    const generation = ++this.sessionCreationGeneration;
    this.sessionCreationOperationId = operationId;
    this.sessionCreationPromise = this.doStartSessionModel(operationId, generation, draftBoundSession);
    try {
      return await this.sessionCreationPromise;
    } finally {
      this.sessionCreationPromise = undefined;
      if (this.sessionCreationOperationId === operationId) {
        this.sessionCreationOperationId = undefined;
      }
      this.endSessionLoading();
    }
  }

  async cancelPendingSessionCreation(options?: { releaseCurrentUnacceptedSession?: boolean }): Promise<void> {
    const operationId = this.sessionCreationOperationId;
    const creation = this.sessionCreationPromise;
    if (operationId && creation) {
      this.sessionCreationGeneration += 1;
      await this.aiBackService.cancelSessionCreation?.(operationId);
      await creation.catch(() => undefined);
      return;
    }

    if (options?.releaseCurrentUnacceptedSession === false) {
      return;
    }

    const sessionModel = this._sessionModel;
    if (!sessionModel || this.acceptedRequestSessions.has(sessionModel.sessionId)) {
      return;
    }
    const draftBoundSession = this.draftBoundSession;
    if (draftBoundSession?.sessionId === sessionModel.sessionId) {
      await this.releaseDraftBoundSession(draftBoundSession, true);
      return;
    }
    this.cancelRequest();
    await (this.chatManagerService as AcpChatManagerService).disposeSession(sessionModel.sessionId);
    if (this._sessionModel === sessionModel) {
      this.enterDraftSession({ force: true });
    }
  }

  async ensureSessionModel(): Promise<ChatModel> {
    if (this._sessionModel) {
      return this._sessionModel;
    }

    const preparation = this.draftBoundSessionPreparation;
    if (preparation) {
      const preparedModel = await preparation;
      if (preparedModel) {
        return preparedModel;
      }
      if (this._sessionModel) {
        return this._sessionModel;
      }
      if (this.draftBoundSessionPreparation && this.draftBoundSessionPreparation !== preparation) {
        return this.ensureSessionModel();
      }
    }

    return this.startSessionModel();
  }

  /**
   * Kept as a compatibility entry point for callers from the former bootstrap
   * experiment. Initial catalogs are now scoped to an explicit Agentic draft.
   */
  async ensureBootstrapSessionModel(): Promise<ChatModel | undefined> {
    return this._sessionModel;
  }

  enterDraftSession(options?: { force?: boolean }): void {
    this.draftSessionState = this.createDraftStateFromModel(this._sessionModel) || this.draftSessionState;
    this._sessionModel = undefined as unknown as ChatModel;
    this.setAvailableCommands([]);
    this.setSkillCatalogState('unavailable');
    this.permissionBridgeService.setActiveSession(undefined);
    this._onSessionModelChange.fire(undefined);
    this._onModeChange.fire('');
    this._onChangeSession.fire('');
  }

  enterAgenticTaskDraft(target: AcpTargetConfigRequest): void {
    const previousDraftBoundSession = this.draftBoundSession;
    this.draftBoundSession = undefined;
    const generation = ++this.draftBoundSessionGeneration;
    this.pendingAgenticTarget = target;
    this.scheduleStandbyTarget(target);
    this.enterDraftSession({ force: true });
    this.setSkillCatalogState(
      this.aiBackService.getSessionCapabilities && this.configProvider.resolveConfigForTarget
        ? 'pending'
        : 'unavailable',
    );
    if (previousDraftBoundSession) {
      void this.releaseDraftBoundSession(previousDraftBoundSession, false);
    }
    void this.cancelPendingSessionCreation({ releaseCurrentUnacceptedSession: false });
    this.prepareDraftBoundSession(target, generation);
  }

  async discardAgenticTaskDraft(): Promise<void> {
    this.standbyTargetGeneration += 1;
    if (this.standbyTargetTimer) {
      clearTimeout(this.standbyTargetTimer);
      this.standbyTargetTimer = undefined;
    }
    ++this.draftBoundSessionGeneration;
    const draftBoundSession = this.draftBoundSession;
    this.draftBoundSession = undefined;
    await this.cancelPendingSessionCreation({ releaseCurrentUnacceptedSession: false });
    if (draftBoundSession) {
      await this.releaseDraftBoundSession(draftBoundSession, true);
    }
    this.pendingAgenticTarget = undefined;
    this.inputDraft = undefined;
    this.setSkillCatalogState('unavailable');
    this.agenticTaskRegistry.clearPendingLaunch?.();
  }

  private prepareDraftBoundSession(target: AcpTargetConfigRequest, generation: number): void {
    if (!this.aiBackService.getSessionCapabilities || !this.configProvider.resolveConfigForTarget) {
      return;
    }

    let preparation!: Promise<ChatModel | undefined>;
    preparation = (async () => {
      try {
        const config = await this.configProvider.resolveConfigForTarget!(target);
        const capabilities = await this.aiBackService.getSessionCapabilities!(config);
        if (generation !== this.draftBoundSessionGeneration || this.pendingAgenticTarget !== target) {
          return undefined;
        }
        if (!capabilities.close || !capabilities.delete) {
          this.setSkillCatalogState('unavailable');
          return undefined;
        }
        return await this.startSessionModel({ deleteOnDiscard: capabilities.delete, generation });
      } catch (error) {
        if (generation === this.draftBoundSessionGeneration) {
          this.logger.warn?.('[ACP Chat][Frontend] Failed to prepare draft-bound ACP session', error);
          this.setSkillCatalogState('unavailable');
        }
        return undefined;
      }
    })().finally(() => {
      if (this.draftBoundSessionPreparation === preparation) {
        this.draftBoundSessionPreparation = undefined;
      }
    });
    this.draftBoundSessionPreparation = preparation;
  }

  private async releaseDraftBoundSession(
    draftBoundSession: AcpDraftBoundSessionOwnership,
    resetActiveDraft: boolean,
  ): Promise<void> {
    if (this.acceptedRequestSessions.has(draftBoundSession.sessionId)) {
      return;
    }
    if (this.draftBoundSession === draftBoundSession) {
      this.draftBoundSession = undefined;
    }

    const rawSessionId = this.stripAcpPrefix(draftBoundSession.sessionId);
    try {
      await this.aiBackService.closeSession?.(rawSessionId);
    } catch (error) {
      this.logger.warn?.('[ACP Chat][Frontend] Failed to close draft-bound ACP session', error);
    }
    if (draftBoundSession.deleteOnDiscard) {
      try {
        await this.aiBackService.deleteSession?.(rawSessionId);
      } catch (error) {
        this.logger.warn?.('[ACP Chat][Frontend] Failed to delete draft-bound ACP session', error);
      }
    }

    const acpManager = this.chatManagerService as AcpChatManagerService;
    await acpManager.disposeSession(draftBoundSession.sessionId);
    if (resetActiveDraft && this._sessionModel?.sessionId === draftBoundSession.sessionId) {
      this.enterDraftSession({ force: true });
    }
  }

  private scheduleStandbyTarget(target: AcpTargetConfigRequest): void {
    const generation = ++this.standbyTargetGeneration;
    if (this.standbyTargetTimer) {
      clearTimeout(this.standbyTargetTimer);
    }
    this.standbyTargetTimer = setTimeout(() => {
      this.standbyTargetTimer = undefined;
      void this.declareStandbyTarget(target, generation);
    }, 500);
  }

  private async flushStandbyTarget(target: AcpTargetConfigRequest): Promise<void> {
    const generation = ++this.standbyTargetGeneration;
    if (this.standbyTargetTimer) {
      clearTimeout(this.standbyTargetTimer);
      this.standbyTargetTimer = undefined;
    }
    await this.declareStandbyTarget(target, generation);
  }

  private async declareStandbyTarget(target: AcpTargetConfigRequest, generation: number): Promise<void> {
    if (!this.aiBackService.setAcpStandbyTarget || !this.configProvider.resolveConfigForTarget) {
      return;
    }
    try {
      const config = await this.configProvider.resolveConfigForTarget(target);
      if (generation !== this.standbyTargetGeneration) {
        return;
      }
      await this.aiBackService.setAcpStandbyTarget(config);
    } catch (error) {
      if (generation === this.standbyTargetGeneration) {
        this.logger.warn?.('[ACP Chat][Frontend] Failed to update ACP standby target', error);
      }
    }
  }

  /**
   * Returns the launch target selected for an Agentic draft or captured on an
   * ACP session model. Agent Session routing never falls back to local Tasks.
   */
  getActiveAgenticTaskTarget(sessionId?: string): AcpTargetConfigRequest | undefined {
    const target = sessionId
      ? (this.chatManagerService.getSession(sessionId) as ChatModel | undefined)?.acpTarget
      : this.pendingAgenticTarget;
    return target && { ...target };
  }

  getActiveAgenticTaskAgentId(sessionId?: string): string | undefined {
    return this.getActiveAgenticTaskTarget(sessionId)?.agentId;
  }

  /** Whether the active composition state is an unaccepted Agentic draft. */
  isActiveAgenticTaskDraft(): boolean {
    return Boolean(
      this.pendingAgenticTarget ||
        (this.draftBoundSession && this._sessionModel?.sessionId === this.draftBoundSession.sessionId),
    );
  }

  private isAgenticLayout(): boolean {
    return this.panelLayoutService?.getLayoutMode() === 'agentic';
  }

  private getAgentSessionCatalogRefreshBarrier(request: ChatRequestModel, sessionId: string): Promise<void> {
    const existingBarrier = this.agentSessionCatalogRefreshBarriers.get(sessionId);
    if (existingBarrier) {
      return existingBarrier;
    }

    const barrier = this.refreshCatalogAfterFirstAgenticPrompt(sessionId)
      .catch((error) => {
        this.logger.error(
          `[ACP Chat][Frontend] refresh Agent session catalog failed — sessionId=${sessionId}, requestId=${
            request.requestId
          }, error=${error instanceof Error ? error.message : String(error)}`,
        );
      })
      .finally(() => {
        if (this.agentSessionCatalogRefreshBarriers.get(sessionId) === barrier) {
          this.agentSessionCatalogRefreshBarriers.delete(sessionId);
        }
      });
    this.agentSessionCatalogRefreshBarriers.set(sessionId, barrier);
    return barrier;
  }

  private async refreshCatalogAfterFirstAgenticPrompt(sessionId: string | undefined): Promise<void> {
    if (!sessionId || !this.isAgenticLayout()) {
      return;
    }

    const model = this.chatManagerService.getSession(sessionId);
    if (!model) {
      return;
    }
    const target = model.acpTarget;
    if (!target) {
      throw new Error(`Resolved ACP target is unavailable for Agentic Task session ${sessionId}`);
    }
    const workspaceUri = URI.file(target.cwd).toString();

    const uri = URI.parse(workspaceUri);
    const project = {
      workspaceUri: uri.toString(),
      workspacePath: target.cwd,
      joinedAt: Date.now(),
      availability: 'available' as const,
    };

    await this.agenticTaskRegistry.registerProject(project);
    await (this.chatManagerService as AcpChatManagerService).refreshAgentSessionCatalog();
  }

  isAgenticTaskSessionObserved(sessionId: string): boolean {
    return false;
  }

  getObservedAgenticTaskStatus(sessionId: string): AgenticTaskStatus | undefined {
    return undefined;
  }

  private toAgenticTaskStatus(status: ThreadStatus): AgenticTaskStatus {
    switch (status) {
      case 'working':
        return 'running';
      case 'stopping':
        return 'stopping';
      case 'disconnected':
        return 'stopped';
      case 'errored':
        return 'error';
      case 'idle':
      case 'awaiting_prompt':
      case 'auth_required':
      default:
        return 'ready';
    }
  }

  private createDraftStateFromModel(model: ChatModel | undefined): AcpDraftSessionState | undefined {
    if (!model) {
      return undefined;
    }

    return {
      agentModes: model.agentModes ? [...model.agentModes] : undefined,
      currentModeId: model.currentModeId,
      agentModels: model.agentModels ? [...model.agentModels] : undefined,
      modelId: model.modelId,
      configOptions: cloneConfigOptions(model.configOptions),
    };
  }

  private cloneInputDraft(draft: AcpTurnDraft): AcpTurnDraft {
    return {
      ...draft,
      images: draft.images ? [...draft.images] : undefined,
    };
  }

  private fireDraftSessionStateChange(): void {
    this._onSessionModelChange.fire(undefined);
  }

  private updateDraftConfigOption(configId: string, value: boolean | string): void {
    this.draftSessionState = {
      ...this.draftSessionState,
      configOptions: (this.draftSessionState.configOptions || []).map((option) =>
        readConfigOptionId(option) === configId ? updateConfigOptionValue(option, value) : option,
      ),
    };
    this.fireDraftSessionStateChange();
  }

  private async applyDraftSessionState(model: ChatModel, draftState: AcpDraftSessionState): Promise<void> {
    const sessionId = this.stripAcpPrefix(model.sessionId);

    if (
      draftState.currentModeId &&
      draftState.currentModeId !== model.currentModeId &&
      model.agentModes?.some((mode) => mode.id === draftState.currentModeId)
    ) {
      try {
        await this.aiBackService.setSessionMode?.(sessionId, draftState.currentModeId);
        model.currentModeId = draftState.currentModeId;
        this._onModeChange.fire(draftState.currentModeId);
      } catch (error) {
        this.logger.warn?.(`[ACP Chat][Frontend] Failed to apply draft mode "${draftState.currentModeId}"`, error);
      }
    }

    if (
      draftState.modelId &&
      draftState.modelId !== model.modelId &&
      model.agentModels?.some((agentModel) => agentModel.modelId === draftState.modelId)
    ) {
      try {
        await this.aiBackService.setSessionModel?.(sessionId, draftState.modelId);
        model.modelId = draftState.modelId;
      } catch (error) {
        this.logger.warn?.(`[ACP Chat][Frontend] Failed to apply draft model "${draftState.modelId}"`, error);
      }
    }

    const draftConfigValues = new Map<string, boolean | string>();
    (draftState.configOptions || []).forEach((option) => {
      const id = readConfigOptionId(option);
      const value = readConfigOptionValue(option);
      if (id && value !== undefined) {
        draftConfigValues.set(id, value);
      }
    });

    if (draftConfigValues.size === 0) {
      return;
    }

    const nextConfigOptions: AcpSessionConfigOption[] = [];
    for (const option of model.configOptions || []) {
      const optionId = readConfigOptionId(option);
      const draftValue = optionId ? draftConfigValues.get(optionId) : undefined;
      if (!optionId || draftValue === undefined || readConfigOptionValue(option) === draftValue) {
        nextConfigOptions.push(option);
        continue;
      }

      try {
        await this.aiBackService.setSessionConfigOption?.(sessionId, optionId, draftValue);
        nextConfigOptions.push(updateConfigOptionValue(option, draftValue));
      } catch (error) {
        this.logger.warn?.(`[ACP Chat][Frontend] Failed to apply draft config option "${optionId}"`, error);
        nextConfigOptions.push(option);
      }
    }

    model.configOptions = nextConfigOptions;
  }

  async setSessionMode(modeId: string): Promise<void> {
    const sessionId = this._sessionModel ? this.stripAcpPrefix(this._sessionModel.sessionId) : undefined;
    if (!sessionId) {
      this.draftSessionState = {
        ...this.draftSessionState,
        currentModeId: modeId,
      };
      this._onModeChange.fire(modeId);
      this.fireDraftSessionStateChange();
      return;
    }

    try {
      await this.aiBackService.setSessionMode?.(sessionId, modeId);
      if (this._sessionModel) {
        this._sessionModel.currentModeId = modeId;
        this._onSessionModelChange.fire(this._sessionModel);
      }
      this._onModeChange.fire(modeId);
    } catch (e) {
      this.messageService.error((e as Error).message);
    }
  }

  async setSessionModel(modelId: string): Promise<void> {
    const sessionId = this._sessionModel ? this.stripAcpPrefix(this._sessionModel.sessionId) : undefined;
    if (!sessionId) {
      this.draftSessionState = {
        ...this.draftSessionState,
        modelId,
      };
      this.fireDraftSessionStateChange();
      return;
    }

    try {
      await this.aiBackService.setSessionModel?.(sessionId, modelId);
      if (this._sessionModel) {
        this._sessionModel.modelId = modelId;
        this._onSessionModelChange.fire(this._sessionModel);
      }
    } catch (e) {
      this.messageService.error((e as Error).message);
    }
  }

  async setSessionConfigOption(configId: string, value: boolean | string): Promise<void> {
    const sessionId = this._sessionModel ? this.stripAcpPrefix(this._sessionModel.sessionId) : undefined;
    if (!sessionId) {
      this.updateDraftConfigOption(configId, value);
      return;
    }

    try {
      await this.aiBackService.setSessionConfigOption?.(sessionId, configId, value);
      if (this._sessionModel) {
        this._sessionModel.configOptions = this._sessionModel.configOptions.map((option) => {
          const optionId = option.id || option.configId;
          return optionId === configId ? updateConfigOptionValue(option, value) : option;
        });
        this._onSessionModelChange.fire(this._sessionModel);
      }
    } catch (e) {
      this.messageService.error((e as Error).message);
    }
  }

  override async createSessionModel() {
    try {
      await this.startSessionModel();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.messageService.error(`Failed to create session. (${errorMessage})`);
    }
  }

  override async clearSessionModel(sessionId?: string, force = false) {
    sessionId = sessionId || this._sessionModel?.sessionId;
    if (!sessionId) {
      this.enterDraftSession({ force: true });
      return;
    }
    this._onWillClearSession.fire(sessionId);
    const clearedSessionId =
      this._sessionModel && sessionId === this._sessionModel.sessionId ? this.stripAcpPrefix(sessionId) : undefined;
    try {
      const acpManager = this.chatManagerService as AcpChatManagerService;
      if (acpManager.disposeSession) {
        if (force) {
          await acpManager.disposeSession(sessionId, true);
        } else {
          await acpManager.disposeSession(sessionId);
        }
      } else {
        this.chatManagerService.clearSession(sessionId);
      }
    } finally {
      if (clearedSessionId) {
        this.permissionBridgeService.clearSessionDialogs(clearedSessionId);
      }
      if (this._sessionModel && sessionId === this._sessionModel.sessionId) {
        this.enterDraftSession({ force: true });
      } else if (this._sessionModel) {
        this._onChangeSession.fire(this._sessionModel.sessionId);
      }
    }
  }

  override getSessions() {
    return this.chatManagerService.getSessions();
  }

  async loadSessionModel(sessionId: string) {
    const acpManager = this.chatManagerService as AcpChatManagerService;
    const loadResult = await acpManager.loadSession(sessionId);
    await loadResult?.liveReady;
    return this.chatManagerService.getSession(sessionId);
  }

  async getSessionsByAcp() {
    const acpManager = this.chatManagerService as AcpChatManagerService;
    if (this.isAgenticLayout()) {
      await acpManager.refreshAgentSessionCatalog();
      return acpManager
        .getAgentSessionCatalog()
        .map((session) => acpManager.getSession(session.sessionId))
        .filter((session): session is ChatModel => Boolean(session));
    }
    await acpManager.loadSessionList();
    if (acpManager.getSessions().length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * 3));
      await acpManager.loadSessionList();
    }
    return this.chatManagerService.getSessions();
  }

  getAgentSessions(): AcpAgentSessionDescriptor[] {
    return (this.chatManagerService as AcpChatManagerService).getAgentSessionCatalog();
  }

  async refreshAgentSessions(): Promise<AcpAgentSessionDescriptor[]> {
    return (this.chatManagerService as AcpChatManagerService).refreshAgentSessionCatalog();
  }

  get onDidChangeAgentSessions() {
    return (this.chatManagerService as AcpChatManagerService).onDidChangeAgentSessionCatalog;
  }

  private async applyActivatedSession(
    sessionId: string,
    session: ChatModel,
    shouldApply: () => boolean = () => true,
  ): Promise<boolean> {
    if (!shouldApply()) {
      return false;
    }

    this._sessionModel = session;
    // Notify permission bridge of session change
    const rawSessionId = this.stripAcpPrefix(sessionId);
    this.permissionBridgeService.setActiveSession(rawSessionId);
    this.setAvailableCommands((this.chatManagerService as AcpChatManagerService).getAvailableCommands(sessionId));
    this._onSessionModelChange.fire(this._sessionModel);
    this._onChangeSession.fire(this._sessionModel.sessionId);
    return true;
  }

  async activateAgenticTaskSession(
    sessionId: string,
    shouldApply: () => boolean = () => true,
  ): Promise<AgenticTaskSessionActivationResult> {
    return this.doActivateAgenticSession(sessionId, shouldApply, true);
  }

  async activateAgentSession(
    session: AcpAgentSessionDescriptor,
    shouldApply: () => boolean = () => true,
  ): Promise<AgenticTaskSessionActivationResult> {
    return this.doActivateAgenticSession(session.sessionId, shouldApply, false);
  }

  private async doActivateAgenticSession(
    sessionId: string,
    shouldApply: () => boolean,
    showFallbackMessage: boolean,
  ): Promise<AgenticTaskSessionActivationResult> {
    const selectionVersion = ++this.sessionSelectionVersion;
    let releaseLoadingOnReturn = true;
    this.beginSessionLoading();
    this.pendingAgenticSessionId = sessionId;
    this.agenticSessionLiveReadyStatuses.set(sessionId, 'pending');
    try {
      const acpManager = this.chatManagerService as AcpChatManagerService;
      const loadResult = await acpManager.loadSession(sessionId);
      const session = this.chatManagerService.getSession(sessionId);
      if (selectionVersion !== this.sessionSelectionVersion || !shouldApply()) {
        this.agenticSessionLiveReadyStatuses.delete(sessionId);
        this.clearPendingAgenticSession(sessionId);
        await acpManager.disposeSession(sessionId);
        return { status: 'superseded' };
      }
      if (!session) {
        this.agenticSessionLiveReadyStatuses.delete(sessionId);
        this.clearPendingAgenticSession(sessionId);
        if (showFallbackMessage) {
          this.messageService.info(ACP_LOAD_TASK_FALLBACK_MESSAGE);
        }
        return { status: 'failed' };
      }
      const activated = await this.applyActivatedSession(
        sessionId,
        session,
        () => selectionVersion === this.sessionSelectionVersion && shouldApply(),
      );
      if (!activated) {
        this.agenticSessionLiveReadyStatuses.delete(sessionId);
        await acpManager.disposeSession(sessionId);
      } else if (loadResult?.liveReady) {
        releaseLoadingOnReturn = false;
        void loadResult.liveReady.then(
          (status) => {
            if (selectionVersion === this.sessionSelectionVersion) {
              this.agenticSessionLiveReadyStatuses.set(sessionId, status);
            }
            this.endSessionLoading();
          },
          () => {
            if (selectionVersion === this.sessionSelectionVersion) {
              this.agenticSessionLiveReadyStatuses.set(sessionId, 'failed');
            }
            this.endSessionLoading();
          },
        );
      } else {
        this.agenticSessionLiveReadyStatuses.set(sessionId, 'ready');
      }
      this.clearPendingAgenticSession(sessionId);
      return { status: activated ? 'activated' : 'superseded' };
    } catch (error) {
      this.agenticSessionLiveReadyStatuses.delete(sessionId);
      this.clearPendingAgenticSession(sessionId);
      if (selectionVersion === this.sessionSelectionVersion && shouldApply()) {
        if (showFallbackMessage) {
          this.messageService.info(formatAcpLoadTaskFallbackMessage(error));
        }
        return { status: isAcpSessionNotFoundError(error) ? 'conversation-unavailable' : 'failed' };
      }
      return { status: 'superseded' };
    } finally {
      if (releaseLoadingOnReturn) {
        this.endSessionLoading();
      }
    }
  }

  async validateAgenticTaskSession(
    sessionId: string,
    shouldApply: () => boolean = () => true,
  ): Promise<AgenticTaskSessionValidationResult> {
    this.beginSessionLoading();
    try {
      const acpManager = this.chatManagerService as AcpChatManagerService;
      const loadResult = await acpManager.loadSession(sessionId);
      await loadResult?.liveReady;
      if (!shouldApply()) {
        await acpManager.disposeSession(sessionId);
        return { status: 'superseded' };
      }
      const session = this.chatManagerService.getSession(sessionId);
      if (!session) {
        this.messageService.info(ACP_LOAD_TASK_FALLBACK_MESSAGE);
        return { status: 'failed' };
      }
      if (!shouldApply()) {
        await acpManager.disposeSession(sessionId);
        return { status: 'superseded' };
      }
      return { status: 'validated', taskStatus: this.toAgenticTaskStatus(session.threadStatus) };
    } catch (error) {
      if (!shouldApply()) {
        return { status: 'superseded' };
      }
      this.messageService.info(formatAcpLoadTaskFallbackMessage(error));
      return { status: isAcpSessionNotFoundError(error) ? 'conversation-unavailable' : 'failed' };
    } finally {
      this.endSessionLoading();
    }
  }

  override async activateSession(sessionId: string) {
    const selectionVersion = ++this.sessionSelectionVersion;
    this.beginSessionLoading();
    try {
      const acpManager = this.chatManagerService as AcpChatManagerService;
      if (selectionVersion !== this.sessionSelectionVersion) {
        return;
      }
      const loadResult = await acpManager.loadSession(sessionId);
      await loadResult?.liveReady;
      if (selectionVersion !== this.sessionSelectionVersion) {
        await acpManager.disposeSession(sessionId);
        return;
      }
      const updatedSession = this.chatManagerService.getSession(sessionId);
      if (!updatedSession) {
        this.messageService.info(
          `Session ${sessionId} not found. A new chat draft is ready, and a session will be created when you send a message.`,
        );
        this.enterDraftSession({ force: true });
        return;
      }
      const activated = await this.applyActivatedSession(
        sessionId,
        updatedSession,
        () => selectionVersion === this.sessionSelectionVersion,
      );
      if (!activated) {
        await acpManager.disposeSession(sessionId);
      }
    } catch (error) {
      if (selectionVersion !== this.sessionSelectionVersion) {
        return;
      }
      this.messageService.info(formatAcpLoadSessionFallbackMessage(error));
      this.enterDraftSession({ force: true });
    } finally {
      this.endSessionLoading();
    }
  }

  override dispose(): void {
    this.lifecycleGeneration += 1;
    this.standbyTargetGeneration += 1;
    if (this.standbyTargetTimer) {
      clearTimeout(this.standbyTargetTimer);
      this.standbyTargetTimer = undefined;
    }
    this.permissionBridgeService.setActiveSession(undefined);
    this.agentSessionCatalogRefreshBarriers.clear();
    this.requestCancellationGenerations.clear();
    this.acceptedRequestSessions.clear();
    this._onModeChange.dispose();
    this._onSessionLoadingChange.dispose();
    this._onSessionModelChange.dispose();
    super.dispose();
  }
}

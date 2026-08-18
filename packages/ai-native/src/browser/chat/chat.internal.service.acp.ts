import { Autowired, Injectable } from '@opensumi/di';
import { AINativeConfigService, ILogger } from '@opensumi/ide-core-browser';
import {
  ACP_SESSION_NOT_FOUND_ERROR_NAME,
  AcpTargetConfigRequest,
  AvailableCommand,
  ChatMessageRole,
  DisposableCollection,
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
import { AcpSessionConfigOption, AcpSessionModeOption, AcpSessionModelOption } from './session-provider';

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

  private availableCommands: AvailableCommand[] = [];

  private draftSessionState: AcpDraftSessionState = {};
  private inputDraft: AcpTurnDraft | undefined;

  private sessionStateDisposable: IDisposable | undefined;

  private storageInitDisposable: IDisposable | undefined;

  private sessionCreationPromise: Promise<ChatModel> | undefined;
  private sessionCreationOperationId: string | undefined;
  private sessionCreationGeneration = 0;
  private nextSessionCreationId = 1;

  private bootstrapSessionId: string | undefined;

  private bootstrapSessionAttempted = false;

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

  private readonly taskObservationDisposables = new Map<
    string,
    { model: ChatModel; disposable: DisposableCollection }
  >();
  private readonly agenticTaskRegistrationBarriers = new Map<string, Promise<void>>();
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

  private hasDraftSessionState(): boolean {
    return Boolean(
      this.draftSessionState.currentModeId ||
        this.draftSessionState.modelId ||
        this.draftSessionState.agentModes?.length ||
        this.draftSessionState.agentModels?.length ||
        this.draftSessionState.configOptions?.length,
    );
  }

  private isUnusedBootstrapSession(model: ChatModel | undefined): boolean {
    return Boolean(
      model &&
        this.bootstrapSessionId &&
        model.sessionId === this.bootstrapSessionId &&
        model.history.getMessages().length === 0 &&
        model.requests.length === 0,
    );
  }

  getAvailableCommands(): AvailableCommand[] {
    return this.availableCommands;
  }

  setAvailableCommands(commands: AvailableCommand[]) {
    this.availableCommands = commands;
    this._onAvailableCommandsChange.fire(commands);
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
    return this.chatManagerService.getSessions().filter((session) => !this.isUnusedBootstrapSession(session));
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
      let registrationBarrier = this.agenticTaskRegistrationBarriers.get(sessionId);
      const result = this.chatManagerService.sendRequest(sessionId, request, regenerate, () => {
        requestAccepted = true;
        this.acceptedRequestSessions.add(sessionId);
        onRequestAccepted?.();
        if (shouldRegisterAgenticTask && !registrationBarrier) {
          registrationBarrier = this.getAgenticTaskRegistrationBarrier(request, sessionId);
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
      if (shouldRegisterAgenticTask && !requestAccepted && !this.acceptedRequestSessions.has(sessionId)) {
        await this.releaseUnacceptedTaskLaunchSession(sessionId);
      }
    }
  }

  private async releaseUnacceptedTaskLaunchSession(sessionId: string): Promise<void> {
    if (await this.agenticTaskRegistry.getTask(sessionId)) {
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
        await this.observeRegisteredTaskSessions();
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
        const wasObserved = this.taskObservationDisposables.has(event.sessionId);
        this._sessionModel = event.model;
        if (wasObserved) {
          this.observeTaskSession(event.model);
        }
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

  private async doStartSessionModel(operationId: string, generation: number): Promise<ChatModel> {
    const draftSessionState = this.draftSessionState;
    const launch = this.agenticTaskRegistry.consumePendingLaunch?.();
    let target = this.pendingAgenticTarget;
    if (!target && launch) {
      const project = await this.agenticTaskRegistry.getProject(launch.projectId);
      target = project ? { agentId: launch.agentId, cwd: project.workspacePath } : undefined;
    }
    if (target) {
      this.pendingAgenticTarget = target;
      await this.flushStandbyTarget(target);
    }
    const acpManager = this.chatManagerService as AcpChatManagerService;
    const sessionModel = await acpManager.startSession({ acpTarget: target, operationId });
    if (generation !== this.sessionCreationGeneration) {
      await acpManager.disposeSession(sessionModel.sessionId);
      throw createSessionCreationCancelledError();
    }
    this.pendingAgenticTarget = undefined;
    await this.applyDraftSessionState(sessionModel, draftSessionState);
    if (generation !== this.sessionCreationGeneration) {
      await acpManager.disposeSession(sessionModel.sessionId);
      throw createSessionCreationCancelledError();
    }
    this._sessionModel = sessionModel;
    this.setAvailableCommands(acpManager.getAvailableCommands(this._sessionModel.sessionId));
    this.draftSessionState = this.createDraftStateFromModel(this._sessionModel) || {};
    this._onSessionModelChange.fire(this._sessionModel);
    // Notify permission bridge of session change
    const rawSessionId = this.stripAcpPrefix(this._sessionModel.sessionId);
    this.permissionBridgeService.setActiveSession(rawSessionId);
    this._onChangeSession.fire(this._sessionModel.sessionId);
    return this._sessionModel;
  }

  private async startSessionModel(): Promise<ChatModel> {
    if (this.sessionCreationPromise) {
      return this.sessionCreationPromise;
    }

    this.beginSessionLoading();
    const operationId = `acp-launch-${Date.now()}-${this.nextSessionCreationId++}`;
    const generation = ++this.sessionCreationGeneration;
    this.sessionCreationOperationId = operationId;
    this.sessionCreationPromise = this.doStartSessionModel(operationId, generation);
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

  async cancelPendingSessionCreation(): Promise<void> {
    const operationId = this.sessionCreationOperationId;
    const creation = this.sessionCreationPromise;
    if (operationId && creation) {
      this.sessionCreationGeneration += 1;
      await this.aiBackService.cancelSessionCreation?.(operationId);
      await creation.catch(() => undefined);
      return;
    }

    const sessionModel = this._sessionModel;
    if (!sessionModel || this.acceptedRequestSessions.has(sessionModel.sessionId)) {
      return;
    }
    if (this.isAgenticLayout() && (await this.agenticTaskRegistry.getTask(sessionModel.sessionId))) {
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

    return this.startSessionModel();
  }

  async ensureBootstrapSessionModel(): Promise<ChatModel | undefined> {
    if (!this.aiNativeConfigService.capabilities.supportsAgentMode || this._sessionModel) {
      return this._sessionModel;
    }

    if (this.bootstrapSessionAttempted || this.hasDraftSessionState()) {
      return undefined;
    }

    this.bootstrapSessionAttempted = true;
    try {
      const model = await this.startSessionModel();
      this.bootstrapSessionId = model.sessionId;
      return model;
    } catch (error) {
      this.logger.warn?.('[ACP Chat][Frontend] Failed to create bootstrap session', error);
      return undefined;
    }
  }

  enterDraftSession(options?: { force?: boolean }): void {
    if (!options?.force && this.isUnusedBootstrapSession(this._sessionModel)) {
      return;
    }

    const sessionId = this._sessionModel?.sessionId;
    if (sessionId) {
      this.agenticTaskRegistry.clearRememberedActiveTaskSession(sessionId);
    }
    this.draftSessionState = this.createDraftStateFromModel(this._sessionModel) || this.draftSessionState;
    this._sessionModel = undefined as unknown as ChatModel;
    this.setAvailableCommands([]);
    this.permissionBridgeService.setActiveSession(undefined);
    this._onSessionModelChange.fire(undefined);
    this._onModeChange.fire('');
    this._onChangeSession.fire('');
  }

  enterAgenticTaskDraft(target: AcpTargetConfigRequest): void {
    this.pendingAgenticTarget = target;
    this.scheduleStandbyTarget(target);
    this.enterDraftSession({ force: true });
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
   * Returns the Agent selected for an Agentic draft or an unregistered ACP
   * session. The Task registry becomes the source of truth after the first
   * prompt is registered.
   */
  getActiveAgenticTaskAgentId(sessionId?: string): string | undefined {
    if (!sessionId) {
      return this.pendingAgenticTarget?.agentId;
    }

    return (this.chatManagerService.getSession(sessionId) as ChatModel | undefined)?.acpTarget?.agentId;
  }

  private isAgenticLayout(): boolean {
    return this.panelLayoutService?.getLayoutMode() === 'agentic';
  }

  private getAgenticTaskRegistrationBarrier(request: ChatRequestModel, sessionId: string): Promise<void> {
    const existingBarrier = this.agenticTaskRegistrationBarriers.get(sessionId);
    if (existingBarrier) {
      return existingBarrier;
    }

    const barrier = this.registerFirstAgenticPrompt(request, sessionId)
      .catch((error) => {
        this.logger.error(
          `[ACP Chat][Frontend] register Agentic task failed — sessionId=${sessionId}, requestId=${
            request.requestId
          }, error=${error instanceof Error ? error.message : String(error)}`,
        );
      })
      .finally(() => {
        if (this.agenticTaskRegistrationBarriers.get(sessionId) === barrier) {
          this.agenticTaskRegistrationBarriers.delete(sessionId);
        }
      });
    this.agenticTaskRegistrationBarriers.set(sessionId, barrier);
    return barrier;
  }

  private async registerFirstAgenticPrompt(request: ChatRequestModel, sessionId: string | undefined): Promise<void> {
    if (!sessionId || !this.isAgenticLayout()) {
      return;
    }

    const existingTask = await this.agenticTaskRegistry.getTask(sessionId);
    const model = this.chatManagerService.getSession(sessionId);
    if (existingTask) {
      if (model) {
        this.observeTaskSession(model);
      }
      return;
    }

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
    await this.agenticTaskRegistry.registerFirstPrompt({
      sessionId,
      agentId: target.agentId,
      project,
      firstPrompt: request.message.prompt,
      createdAt: model.createdAt,
    });
    this.agenticTaskRegistry.rememberActiveTaskSession(sessionId);
    this.observeTaskSession(model);
    await this.observeRegisteredTaskSessions();
  }

  private async observeRegisteredTaskSessions(): Promise<void> {
    if (!this.isAgenticLayout()) {
      return;
    }

    for (const model of this.chatManagerService.getSessions()) {
      if (model.acpTarget && (await this.agenticTaskRegistry.getTask(model.sessionId))) {
        this.observeTaskSession(model);
      }
    }
  }

  private observeTaskSession(model: ChatModel): void {
    if (!this.isAgenticLayout()) {
      return;
    }

    const existing = this.taskObservationDisposables.get(model.sessionId);
    if (existing?.model === model) {
      return;
    }
    existing?.disposable.dispose();

    const seenMessageIds = new Set(model.history.getMessages().map((message) => message.id));
    const pendingPermissionRequestIds = new Set<string>();
    const disposable = new DisposableCollection();
    void this.agenticTaskRegistry.updateStatus(model.sessionId, this.toAgenticTaskStatus(model.threadStatus));
    disposable.push(
      model.onThreadStatusChange((status) => {
        if (!this.isAgenticLayout()) {
          return;
        }
        void this.agenticTaskRegistry.updateStatus(model.sessionId, this.toAgenticTaskStatus(status));
      }),
    );
    disposable.push(
      model.history.onMessageChange((messages) => {
        if (!this.isAgenticLayout()) {
          messages.forEach((message) => seenMessageIds.add(message.id));
          return;
        }
        const hasAgentActivity = messages.some((message) => {
          if (seenMessageIds.has(message.id)) {
            return false;
          }
          seenMessageIds.add(message.id);
          if (message.role !== ChatMessageRole.Assistant) {
            return false;
          }
          return Boolean(message.content);
        });
        if (hasAgentActivity) {
          this.markUnreadIfBackground(model.sessionId);
        }
      }),
    );
    disposable.push(
      this.permissionBridgeService.onDidRequestPermission((params) => {
        if (!this.isAgenticLayout()) {
          return;
        }
        if (this.stripAcpPrefix(model.sessionId) !== this.stripAcpPrefix(params.sessionId)) {
          return;
        }
        pendingPermissionRequestIds.add(params.requestId);
        void this.agenticTaskRegistry.updateAttention(model.sessionId, 'permission');
        this.markUnreadIfBackground(model.sessionId);
      }),
    );
    disposable.push(
      this.permissionBridgeService.onDidReceivePermissionResult((result) => {
        pendingPermissionRequestIds.delete(result.requestId);
        if (
          pendingPermissionRequestIds.size > 0 ||
          this.permissionBridgeService.hasPendingForSession(model.sessionId)
        ) {
          return;
        }
        void this.agenticTaskRegistry.updateAttention(model.sessionId, undefined);
      }),
    );
    if (this.permissionBridgeService.hasPendingForSession(model.sessionId)) {
      void this.agenticTaskRegistry.updateAttention(model.sessionId, 'permission');
      this.markUnreadIfBackground(model.sessionId);
    }
    this.taskObservationDisposables.set(model.sessionId, { model, disposable });
  }

  isAgenticTaskSessionObserved(sessionId: string): boolean {
    return this.taskObservationDisposables.has(sessionId);
  }

  getObservedAgenticTaskStatus(sessionId: string): AgenticTaskStatus | undefined {
    const observation = this.taskObservationDisposables.get(sessionId);
    return observation ? this.toAgenticTaskStatus(observation.model.threadStatus) : undefined;
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

  private markUnreadIfBackground(sessionId: string): void {
    if (this._sessionModel?.sessionId !== sessionId) {
      void this.agenticTaskRegistry.markUnread(sessionId, true);
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
    await acpManager.loadSessionList();
    if (acpManager.getSessions().length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * 3));
      await acpManager.loadSessionList();
    }
    return this.chatManagerService.getSessions();
  }

  private async applyActivatedSession(
    sessionId: string,
    session: ChatModel,
    shouldApply: () => boolean = () => true,
  ): Promise<boolean> {
    const task = this.isAgenticLayout() ? await this.agenticTaskRegistry.getTask(session.sessionId) : undefined;
    if (!shouldApply()) {
      return false;
    }

    this._sessionModel = session;
    if (task) {
      this.observeTaskSession(session);
    }
    if (this.isAgenticLayout()) {
      this.agenticTaskRegistry.rememberActiveTaskSession(session.sessionId);
    }
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
        this.messageService.info(ACP_LOAD_TASK_FALLBACK_MESSAGE);
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
        this.messageService.info(formatAcpLoadTaskFallbackMessage(error));
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
      if (await this.agenticTaskRegistry.getTask(sessionId)) {
        this.observeTaskSession(session);
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
    this.agenticTaskRegistrationBarriers.clear();
    this.requestCancellationGenerations.clear();
    this.acceptedRequestSessions.clear();
    this.taskObservationDisposables.forEach(({ disposable }) => disposable.dispose());
    this.taskObservationDisposables.clear();
    this._onModeChange.dispose();
    this._onSessionLoadingChange.dispose();
    this._onSessionModelChange.dispose();
    super.dispose();
  }
}

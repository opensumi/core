import { Autowired, Injectable } from '@opensumi/di';
import { AINativeConfigService, ILogger } from '@opensumi/ide-core-browser';
import { AvailableCommand, Emitter, Event, IDisposable } from '@opensumi/ide-core-common';
import { IMessageService } from '@opensumi/ide-overlay';

import { AcpPermissionBridgeService } from '../acp/permission-bridge.service';

import { AcpChatManagerService } from './chat-manager.service.acp';
import { ChatModel, ChatRequestModel } from './chat-model';
import { ChatInternalService } from './chat.internal.service';

const ACP_LOAD_SESSION_FALLBACK_MESSAGE =
  'Unable to open this chat history. A new chat draft is ready, and a session will be created when you send a message.';
const ACP_LOAD_SESSION_NOT_FOUND_MESSAGE =
  'This chat history is no longer available. A new chat draft is ready, and a session will be created when you send a message.';

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>;
    const message = errorRecord.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    const nestedError = errorRecord.error;
    if (nestedError && typeof nestedError === 'object') {
      const nestedMessage = (nestedError as Record<string, unknown>).message;
      if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
        return nestedMessage;
      }
    }
  }

  return '';
}

export function formatAcpLoadSessionFallbackMessage(error: unknown): string {
  const errorMessage = getReadableErrorMessage(error);
  if (/session .*not found|not found|does not exist|no session/i.test(errorMessage)) {
    return ACP_LOAD_SESSION_NOT_FOUND_MESSAGE;
  }

  return ACP_LOAD_SESSION_FALLBACK_MESSAGE;
}

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

@Injectable()
export class AcpChatInternalService extends ChatInternalService {
  @Autowired(AINativeConfigService)
  protected aiNativeConfigService: AINativeConfigService;

  @Autowired(IMessageService)
  private messageService: IMessageService;

  @Autowired(AcpPermissionBridgeService)
  private permissionBridgeService: AcpPermissionBridgeService;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  private readonly _onModeChange = new Emitter<string>();
  public readonly onModeChange: Event<string> = this._onModeChange.event;

  private readonly _onSessionLoadingChange = new Emitter<boolean>();
  public readonly onSessionLoadingChange: Event<boolean> = this._onSessionLoadingChange.event;

  private readonly _onSessionModelChange = new Emitter<ChatModel | undefined>();
  public readonly onSessionModelChange: Event<ChatModel | undefined> = this._onSessionModelChange.event;

  private readonly _onAvailableCommandsChange = new Emitter<AvailableCommand[]>();
  public readonly onAvailableCommandsChange: Event<AvailableCommand[]> = this._onAvailableCommandsChange.event;

  private availableCommands: AvailableCommand[] = [];

  private sessionStateDisposable: IDisposable | undefined;

  private storageInitDisposable: IDisposable | undefined;

  private stripAcpPrefix(sessionId: string): string {
    return sessionId.startsWith('acp:') ? sessionId.slice(4) : sessionId;
  }

  getAvailableCommands(): AvailableCommand[] {
    return this.availableCommands;
  }

  setAvailableCommands(commands: AvailableCommand[]) {
    this.availableCommands = commands;
    this._onAvailableCommandsChange.fire(commands);
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

  override sendRequest(request: ChatRequestModel, regenerate = false) {
    const sessionId = this._sessionModel?.sessionId;
    this.logger.log(
      `[ACP Chat][Frontend] sendRequest start — sessionId=${sessionId ?? '(empty)'}, requestId=${
        request.requestId
      }, regenerate=${regenerate}, agentId=${request.message.agentId}, command=${
        request.message.command || '(empty)'
      }, messageChars=${request.message.prompt.length}, images=${request.message.images?.length ?? 0}`,
    );

    const result = super.sendRequest(request, regenerate);
    Promise.resolve(result).then(
      () => {
        this.logger.log(
          `[ACP Chat][Frontend] sendRequest done — sessionId=${sessionId ?? '(empty)'}, requestId=${request.requestId}`,
        );
      },
      (error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `[ACP Chat][Frontend] sendRequest error — sessionId=${sessionId ?? '(empty)'}, requestId=${
            request.requestId
          }, error=${message}`,
        );
      },
    );
    return result;
  }

  override init() {
    if (this.storageInitDisposable) {
      return;
    }

    this.ensureSessionStateListener();

    this.storageInitDisposable = this.chatManagerService.onStorageInit(async () => {
      if (this.aiNativeConfigService.capabilities.supportsAgentMode) {
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

      this._onSessionModelChange.fire(this._sessionModel);
      if (event.currentModeId !== undefined && event.currentModeId !== event.previousModeId) {
        this._onModeChange.fire(event.currentModeId);
      }
    });
    this.addDispose(this.sessionStateDisposable);
  }

  private async startSessionModel(): Promise<ChatModel> {
    this._sessionModel = await this.chatManagerService.startSession();
    const acpManager = this.chatManagerService as AcpChatManagerService;
    this.setAvailableCommands(acpManager.getAvailableCommands());
    this._onSessionModelChange.fire(this._sessionModel);
    // Notify permission bridge of session change
    const rawSessionId = this.stripAcpPrefix(this._sessionModel.sessionId);
    this.permissionBridgeService.setActiveSession(rawSessionId);
    this._onChangeSession.fire(this._sessionModel.sessionId);
    return this._sessionModel;
  }

  async ensureSessionModel(): Promise<ChatModel> {
    if (this._sessionModel) {
      return this._sessionModel;
    }

    this._onSessionLoadingChange.fire(true);
    try {
      return await this.startSessionModel();
    } finally {
      this._onSessionLoadingChange.fire(false);
    }
  }

  enterDraftSession(): void {
    this._sessionModel = undefined as unknown as ChatModel;
    this.setAvailableCommands([]);
    this.permissionBridgeService.setActiveSession(undefined);
    this._onSessionModelChange.fire(undefined);
    this._onModeChange.fire('');
    this._onChangeSession.fire('');
  }

  async setSessionMode(modeId: string): Promise<void> {
    const sessionId = this._sessionModel ? this.stripAcpPrefix(this._sessionModel.sessionId) : undefined;
    if (!sessionId) {
      throw new Error('No active session');
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
      throw new Error('No active session');
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
      throw new Error('No active session');
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
    this._onSessionLoadingChange.fire(true);
    try {
      await this.startSessionModel();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.messageService.error(`Failed to create session. (${errorMessage})`);
    } finally {
      this._onSessionLoadingChange.fire(false);
    }
  }

  override async clearSessionModel(sessionId?: string) {
    sessionId = sessionId || this._sessionModel?.sessionId;
    if (!sessionId) {
      this.enterDraftSession();
      return;
    }
    this._onWillClearSession.fire(sessionId);
    const clearedSessionId =
      this._sessionModel && sessionId === this._sessionModel.sessionId ? this.stripAcpPrefix(sessionId) : undefined;
    this.chatManagerService.clearSession(sessionId);
    if (clearedSessionId) {
      this.permissionBridgeService.clearSessionDialogs(clearedSessionId);
    }
    if (this._sessionModel && sessionId === this._sessionModel.sessionId) {
      this.enterDraftSession();
    } else if (this._sessionModel) {
      this._onChangeSession.fire(this._sessionModel.sessionId);
    }
  }

  override getSessions() {
    return this.chatManagerService.getSessions();
  }

  async loadSessionModel(sessionId: string) {
    const acpManager = this.chatManagerService as AcpChatManagerService;
    await acpManager.loadSession(sessionId);
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

  override async activateSession(sessionId: string) {
    this._onSessionLoadingChange.fire(true);
    try {
      const acpManager = this.chatManagerService as AcpChatManagerService;
      await acpManager.loadSession(sessionId);
      const updatedSession = this.chatManagerService.getSession(sessionId);
      if (!updatedSession) {
        this.messageService.info(
          `Session ${sessionId} not found. A new chat draft is ready, and a session will be created when you send a message.`,
        );
        this.enterDraftSession();
        return;
      }
      this._sessionModel = updatedSession;
      // Notify permission bridge of session change
      const rawSessionId = this.stripAcpPrefix(sessionId);
      this.permissionBridgeService.setActiveSession(rawSessionId);
      this.setAvailableCommands(acpManager.getAvailableCommands());
      this._onSessionModelChange.fire(this._sessionModel);
      this._onChangeSession.fire(this._sessionModel.sessionId);
    } catch (error) {
      this.messageService.info(formatAcpLoadSessionFallbackMessage(error));
      this.enterDraftSession();
    } finally {
      this._onSessionLoadingChange.fire(false);
    }
  }

  override dispose(): void {
    this.permissionBridgeService.setActiveSession(undefined);
    this._onModeChange.dispose();
    this._onSessionLoadingChange.dispose();
    this._onSessionModelChange.dispose();
    super.dispose();
  }
}

import { Autowired, Injectable } from '@opensumi/di';
import { AINativeConfigService } from '@opensumi/ide-core-browser';
import { AvailableCommand, Emitter, Event } from '@opensumi/ide-core-common';
import { IMessageService } from '@opensumi/ide-overlay';

import { AcpPermissionBridgeService } from '../acp/permission-bridge.service';

import { AcpChatManagerService } from './chat-manager.service.acp';
import { ChatModel } from './chat-model';
import { ChatInternalService } from './chat.internal.service';

const ACP_LOAD_SESSION_FALLBACK_MESSAGE = 'Unable to open this chat history. A new session has been created.';
const ACP_LOAD_SESSION_NOT_FOUND_MESSAGE = 'This chat history is no longer available. A new session has been created.';

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

@Injectable()
export class AcpChatInternalService extends ChatInternalService {
  @Autowired(AINativeConfigService)
  protected aiNativeConfigService: AINativeConfigService;

  @Autowired(IMessageService)
  private messageService: IMessageService;

  @Autowired(AcpPermissionBridgeService)
  private permissionBridgeService: AcpPermissionBridgeService;

  private readonly _onModeChange = new Emitter<string>();
  public readonly onModeChange: Event<string> = this._onModeChange.event;

  private readonly _onSessionLoadingChange = new Emitter<boolean>();
  public readonly onSessionLoadingChange: Event<boolean> = this._onSessionLoadingChange.event;

  private readonly _onSessionModelChange = new Emitter<ChatModel | undefined>();
  public readonly onSessionModelChange: Event<ChatModel | undefined> = this._onSessionModelChange.event;

  private readonly _onAvailableCommandsChange = new Emitter<AvailableCommand[]>();
  public readonly onAvailableCommandsChange: Event<AvailableCommand[]> = this._onAvailableCommandsChange.event;

  private availableCommands: AvailableCommand[] = [];

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

  override init() {
    this.chatManagerService.onStorageInit(async () => {
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
  }

  async setSessionMode(modeId: string): Promise<void> {
    const sessionId = this._sessionModel?.sessionId;
    if (!sessionId) {
      throw new Error('No active session');
    }

    try {
      await this.aiBackService.setSessionMode?.(sessionId, modeId);
      this._onModeChange.fire(modeId);
    } catch (e) {
      this.messageService.error((e as Error).message);
    }
  }

  override async createSessionModel() {
    this._onSessionLoadingChange.fire(true);
    try {
      this._sessionModel = await this.chatManagerService.startSession();
      const acpManager = this.chatManagerService as AcpChatManagerService;
      this.setAvailableCommands(acpManager.getAvailableCommands());
      this._onSessionModelChange.fire(this._sessionModel);
      // Notify permission bridge of session change
      const rawSessionId = this.stripAcpPrefix(this._sessionModel.sessionId);
      this.permissionBridgeService.setActiveSession(rawSessionId);
      this._onChangeSession.fire(this._sessionModel.sessionId);
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
      throw new Error('No active session');
    }
    this._onWillClearSession.fire(sessionId);
    const clearedSessionId =
      this._sessionModel && sessionId === this._sessionModel.sessionId ? this.stripAcpPrefix(sessionId) : undefined;
    this.chatManagerService.clearSession(sessionId);
    if (clearedSessionId) {
      this.permissionBridgeService.clearSessionDialogs(clearedSessionId);
    }
    if (this._sessionModel && sessionId === this._sessionModel.sessionId) {
      this._sessionModel = await this.chatManagerService.startSession();
      const acpManager = this.chatManagerService as AcpChatManagerService;
      this.setAvailableCommands(acpManager.getAvailableCommands());
      this._onSessionModelChange.fire(this._sessionModel);
      const rawSessionId = this.stripAcpPrefix(this._sessionModel.sessionId);
      this.permissionBridgeService.setActiveSession(rawSessionId);
    }
    if (this._sessionModel) {
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
        this.messageService.info(`Session ${sessionId} not found, creating a new session.`);
        await this.createSessionModel();
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
      await this.createSessionModel();
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

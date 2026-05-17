import { Autowired, Injectable } from '@opensumi/di';
import { AINativeConfigService } from '@opensumi/ide-core-browser';
import { AvailableCommand, Emitter, Event } from '@opensumi/ide-core-common';
import { IMessageService } from '@opensumi/ide-overlay';

import { AcpChatManagerService } from './chat-manager.service.acp';
import { ChatModel } from './chat-model';
import { ChatInternalService } from './chat.internal.service';

@Injectable()
export class AcpChatInternalService extends ChatInternalService {
  @Autowired(AINativeConfigService)
  protected aiNativeConfigService: AINativeConfigService;

  @Autowired(IMessageService)
  private messageService: IMessageService;

  private readonly _onModeChange = new Emitter<string>();
  public readonly onModeChange: Event<string> = this._onModeChange.event;

  private readonly _onSessionLoadingChange = new Emitter<boolean>();
  public readonly onSessionLoadingChange: Event<boolean> = this._onSessionLoadingChange.event;

  private readonly _onSessionModelChange = new Emitter<ChatModel | undefined>();
  public readonly onSessionModelChange: Event<ChatModel | undefined> = this._onSessionModelChange.event;

  private readonly _onAvailableCommandsChange = new Emitter<AvailableCommand[]>();
  public readonly onAvailableCommandsChange: Event<AvailableCommand[]> = this._onAvailableCommandsChange.event;

  private availableCommands: AvailableCommand[] = [];

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
    this._sessionModel = await this.chatManagerService.startSession();
    const acpManager = this.chatManagerService as AcpChatManagerService;
    this.setAvailableCommands(acpManager.getAvailableCommands());
    this._onSessionModelChange.fire(this._sessionModel);
    this._onChangeSession.fire(this._sessionModel.sessionId);
    this._onSessionLoadingChange.fire(false);
  }

  override async clearSessionModel(sessionId?: string) {
    sessionId = sessionId || this._sessionModel?.sessionId;
    if (!sessionId) {
      throw new Error('No active session');
    }
    this._onWillClearSession.fire(sessionId);
    this.chatManagerService.clearSession(sessionId);
    if (this._sessionModel && sessionId === this._sessionModel.sessionId) {
      this._sessionModel = await this.chatManagerService.startSession();
      const acpManager = this.chatManagerService as AcpChatManagerService;
      this.setAvailableCommands(acpManager.getAvailableCommands());
      this._onSessionModelChange.fire(this._sessionModel);
    }
    if (this._sessionModel) {
      this._onChangeSession.fire(this._sessionModel.sessionId);
    }
  }

  override getSessions() {
    return this.chatManagerService.getSessions();
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
      this.setAvailableCommands(acpManager.getAvailableCommands());
      this._onSessionModelChange.fire(this._sessionModel);
      this._onChangeSession.fire(this._sessionModel.sessionId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.messageService.info(`Failed to load session, creating a new session. (${errorMessage})`);
      await this.createSessionModel();
    } finally {
      this._onSessionLoadingChange.fire(false);
    }
  }

  override dispose(): void {
    this._onModeChange.dispose();
    this._onSessionLoadingChange.dispose();
    this._onSessionModelChange.dispose();
    super.dispose();
  }
}

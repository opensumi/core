import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { AIBackSerivcePath, Disposable, Emitter, Event, IAIBackService } from '@opensumi/ide-core-common';

import { IChatManagerService } from '../../common';

import { ChatManagerService } from './chat-manager.service';
import { ChatModel, ChatRequestModel } from './chat-model';

/**
 * @internal
 */
@Injectable()
export class ChatInternalService extends Disposable {
  @Autowired(AIBackSerivcePath)
  public aiBackService: IAIBackService;

  @Autowired(PreferenceService)
  protected preferenceService: PreferenceService;

  // Exposed as protected so AcpChatInternalService subclass can access it
  @Autowired(IChatManagerService)
  protected chatManagerService: ChatManagerService;

  private readonly _onChangeRequestId = new Emitter<string>();
  public readonly onChangeRequestId: Event<string> = this._onChangeRequestId.event;

  protected readonly _onChangeSession = new Emitter<string>();
  public readonly onChangeSession: Event<string> = this._onChangeSession.event;

  private readonly _onCancelRequest = new Emitter<void>();
  public readonly onCancelRequest: Event<void> = this._onCancelRequest.event;

  protected readonly _onWillClearSession = new Emitter<string>();
  public readonly onWillClearSession: Event<string> = this._onWillClearSession.event;

  protected readonly _onRegenerateRequest = new Emitter<void>();
  public readonly onRegenerateRequest: Event<void> = this._onRegenerateRequest.event;

  private _latestRequestId: string;
  public get latestRequestId(): string {
    return this._latestRequestId;
  }

  // Exposed as protected so AcpChatInternalService subclass can access it
  protected _sessionModel: ChatModel;
  get sessionModel() {
    return this._sessionModel;
  }

  init() {
    this.chatManagerService.onStorageInit(async () => {
      const sessions = this.chatManagerService.getSessions();
      if (sessions.length > 0) {
        await this.activateSession(sessions[sessions.length - 1].sessionId);
      } else {
        await this.createSessionModel();
      }
    });
  }

  public setLatestRequestId(id: string): void {
    this._latestRequestId = id;
    this._onChangeRequestId.fire(id);
  }

  createRequest(input: string, agentId: string, images?: string[], command?: string) {
    return this.chatManagerService.createRequest(this._sessionModel.sessionId, input, agentId, command, images);
  }

  sendRequest(request: ChatRequestModel, regenerate = false) {
    const result = this.chatManagerService.sendRequest(this._sessionModel.sessionId, request, regenerate);
    if (regenerate) {
      this._onRegenerateRequest.fire();
    }
    return result;
  }

  cancelRequest() {
    this.chatManagerService.cancelRequest(this._sessionModel.sessionId);
    this._onCancelRequest.fire();
  }

  async createSessionModel() {
    this._sessionModel = await this.chatManagerService.startSession();
    this._onChangeSession.fire(this._sessionModel.sessionId);
  }

  async clearSessionModel(sessionId?: string) {
    sessionId = sessionId || this._sessionModel.sessionId;
    this._onWillClearSession.fire(sessionId);
    this.chatManagerService.clearSession(sessionId);
    if (sessionId === this._sessionModel.sessionId) {
      this._sessionModel = await this.chatManagerService.startSession();
    }
    this._onChangeSession.fire(this._sessionModel.sessionId);
  }

  getSessions() {
    return this.chatManagerService.getSessions();
  }

  getSession(sessionId: string) {
    return this.chatManagerService.getSession(sessionId);
  }

  activateSession(sessionId: string) {
    const targetSession = this.chatManagerService.getSession(sessionId);
    if (!targetSession) {
      throw new Error(`There is no session with session id ${sessionId}`);
    }
    this._sessionModel = targetSession;
    this._onChangeSession.fire(this._sessionModel.sessionId);
  }

  override dispose(): void {
    this._sessionModel?.dispose();
    super.dispose();
  }
}

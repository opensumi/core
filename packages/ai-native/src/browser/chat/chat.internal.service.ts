/**
 * ChatInternalService - 聊天内部服务
 *
 * 负责聊天功能的内部状态管理和事件控制：
 * - 管理当前会话模型
 * - 创建和管理请求
 * - 发送和取消请求
 * - 管理会话生命周期（创建、清除、激活）
 * - 提供事件通知（Request 变化、Session 变化、取消、重新生成等）
 *
 * 被以下类调用:
 * - ChatService: 依赖注入使用，用于访问 sessionModel
 * - ChatView (chat.view.tsx): 依赖注入使用，用于会话管理和事件订阅
 */
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

  @Autowired(IChatManagerService)
  private chatManagerService: ChatManagerService;

  private readonly _onChangeRequestId = new Emitter<string>();
  public readonly onChangeRequestId: Event<string> = this._onChangeRequestId.event;

  private readonly _onChangeSession = new Emitter<string>();
  public readonly onChangeSession: Event<string> = this._onChangeSession.event;

  private readonly _onCancelRequest = new Emitter<void>();
  public readonly onCancelRequest: Event<void> = this._onCancelRequest.event;

  private readonly _onWillClearSession = new Emitter<string>();
  public readonly onWillClearSession: Event<string> = this._onWillClearSession.event;

  private readonly _onRegenerateRequest = new Emitter<void>();
  public readonly onRegenerateRequest: Event<void> = this._onRegenerateRequest.event;

  private _latestRequestId: string;
  public get latestRequestId(): string {
    return this._latestRequestId;
  }

  #sessionModel: ChatModel;
  get sessionModel() {
    return this.#sessionModel;
  }

  init() {
    this.chatManagerService.onStorageInit(() => {
      const sessions = this.chatManagerService.getSessions();
      if (sessions.length > 0) {
        this.activateSession(sessions[sessions.length - 1].sessionId);
      } else {
        this.createSessionModel();
      }
    });
  }

  public setLatestRequestId(id: string): void {
    this._latestRequestId = id;
    this._onChangeRequestId.fire(id);
  }

  createRequest(input: string, agentId: string, images?: string[], command?: string) {
    return this.chatManagerService.createRequest(this.#sessionModel.sessionId, input, agentId, command, images);
  }

  sendRequest(request: ChatRequestModel, regenerate = false) {
    const result = this.chatManagerService.sendRequest(this.#sessionModel.sessionId, request, regenerate);
    if (regenerate) {
      this._onRegenerateRequest.fire();
    }
    return result;
  }

  cancelRequest() {
    this.chatManagerService.cancelRequest(this.#sessionModel.sessionId);
    this._onCancelRequest.fire();
  }

  createSessionModel() {
    this.#sessionModel = this.chatManagerService.startSession();
    this._onChangeSession.fire(this.#sessionModel.sessionId);
  }

  clearSessionModel(sessionId?: string) {
    sessionId = sessionId || this.#sessionModel.sessionId;
    this._onWillClearSession.fire(sessionId);
    this.chatManagerService.clearSession(sessionId);
    if (sessionId === this.#sessionModel.sessionId) {
      this.#sessionModel = this.chatManagerService.startSession();
    }
    this._onChangeSession.fire(this.#sessionModel.sessionId);
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
    this.#sessionModel = targetSession;
    this._onChangeSession.fire(this.#sessionModel.sessionId);
  }

  override dispose(): void {
    this.#sessionModel?.dispose();
    super.dispose();
  }
}

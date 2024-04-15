import { Autowired, Injectable } from '@opensumi/di';
import { IAIReporter, PreferenceService } from '@opensumi/ide-core-browser';
import {
  AIBackSerivcePath,
  CancelResponse,
  CancellationTokenSource,
  Disposable,
  Emitter,
  ErrorResponse,
  Event,
  IAIBackService,
  IAIBackServiceOption,
  ReplyResponse,
} from '@opensumi/ide-core-common';

import { IChatManagerService, IChatMessageStructure } from '../../common';
import { MsgStreamManager } from '../model/msg-stream-manager';

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

  @Autowired(MsgStreamManager)
  private readonly msgStreamManager: MsgStreamManager;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  @Autowired(IChatManagerService)
  private chatManagerService: ChatManagerService;

  private readonly _onChangeSessionId = new Emitter<string>();
  public readonly onChangeSessionId: Event<string> = this._onChangeSessionId.event;

  private _latestSessionId: string;
  public get latestSessionId(): string {
    return this._latestSessionId;
  }

  #sessionModel: ChatModel;
  get sessionModel() {
    return this.#sessionModel;
  }

  constructor() {
    super();
    this.#sessionModel = this.chatManagerService.startSession();
  }

  public cancelIndicatorChatView = new CancellationTokenSource();

  public cancelChatViewToken() {
    this.cancelIndicatorChatView.cancel();
    this.cancelIndicatorChatView = new CancellationTokenSource();
  }

  public async destroyStreamRequest(sessionId: string) {
    if (this.aiBackService.destroyStreamRequest) {
      await this.aiBackService.destroyStreamRequest(sessionId);
      this.msgStreamManager.sendDoneStatue();
    }
  }

  /**
   * by backend service
   * @param message
   */
  public onMessage(message: string, sessionId: string) {
    try {
      const msgObj = JSON.parse(message);

      if (msgObj.id && msgObj.choices) {
        const { id, choices } = msgObj;
        this.msgStreamManager.recordMessage(id, choices[0]);
      } else {
        this.msgStreamManager.sendErrorStatue();
      }

      if (msgObj.errorCode && sessionId) {
        const errMsg = msgObj.errorMsg || '';
        this.aiReporter.end(sessionId, {
          message: errMsg,
          success: false,
        });
      }
    } catch (error) {
      throw new Error(`onMessage error: ${error}`);
    }
  }

  public async messageWithStream(input: string, options: IAIBackServiceOption = {}, sessionId: string): Promise<void> {
    this.msgStreamManager.setCurrentSessionId(sessionId);
    this.msgStreamManager.sendThinkingStatue();

    await this.aiBackService.requestStream(
      input,
      {
        ...options,
        sessionId,
      },
      this.cancelIndicatorChatView.token,
    );
  }

  public async message(input: string, options: IAIBackServiceOption = {}) {
    const result = await this.aiBackService.request(input, options, this.cancelIndicatorChatView.token);

    if (result.isCancel) {
      return new CancelResponse();
    }

    if (result.errorCode !== 0) {
      return new ErrorResponse('');
    }

    return new ReplyResponse(result.data!);
  }

  public setLatestSessionId(id: string): void {
    this._latestSessionId = id;
    this._onChangeSessionId.fire(id);
  }

  createRequest(input: string, agentId: string, command?: string) {
    return this.chatManagerService.createRequest(this.#sessionModel.sessionId, input, agentId, command);
  }

  sendRequest(request: ChatRequestModel, regenerate = false) {
    return this.chatManagerService.sendRequest(this.#sessionModel.sessionId, request, regenerate);
  }

  cancelRequest() {
    this.chatManagerService.cancelRequest(this.#sessionModel.sessionId);
  }

  clearSessionModel() {
    this.chatManagerService.clearSession(this.#sessionModel.sessionId);
    this.#sessionModel = this.chatManagerService.startSession();
  }

  override dispose(): void {
    this.#sessionModel?.dispose();
    super.dispose();
  }
}

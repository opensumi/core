import { Autowired, Injectable } from '@opensumi/di';
import { IAIInlineChatService } from '@opensumi/ide-core-browser';
import { AIBackSerivcePath, Emitter, Event, IAIBackService, runWhenIdle } from '@opensumi/ide-core-common';

export const enum EInlineChatStatus {
  READY,
  THINKING,
  DONE,
  ERROR,
}

@Injectable({ multiple: false })
export class AIInlineChatService implements IAIInlineChatService {
  @Autowired(AIBackSerivcePath)
  aiBackService: IAIBackService;

  private _status: EInlineChatStatus = EInlineChatStatus.READY;

  public get status(): EInlineChatStatus {
    return this._status;
  }

  public readonly _onInlineChatVisible = new Emitter<boolean>();
  public readonly onInlineChatVisible: Event<boolean> = this._onInlineChatVisible.event;

  private readonly _onChatStatus = new Emitter<EInlineChatStatus>();
  public readonly onChatStatus: Event<EInlineChatStatus> = this._onChatStatus.event;

  public readonly _onAccept = new Emitter<void>();
  public readonly onAccept: Event<void> = this._onAccept.event;

  public readonly _onDiscard = new Emitter<void>();
  public readonly onDiscard: Event<void> = this._onDiscard.event;

  public readonly _onRegenerate = new Emitter<void>();
  public readonly onRegenerate: Event<void> = this._onRegenerate.event;

  private readonly _onThumbs = new Emitter<boolean>();
  public readonly onThumbs: Event<boolean> = this._onThumbs.event;

  public fireThumbsEvent(isThumbsUp: boolean) {
    this._onThumbs.fire(isThumbsUp);
  }

  public isLoading(): boolean {
    return this._status === EInlineChatStatus.THINKING;
  }

  public launchChatStatus(status: EInlineChatStatus) {
    return runWhenIdle(() => {
      this._status = status;
      this._onChatStatus.fire(status);
    });
  }
}

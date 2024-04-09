import { Autowired, Injectable } from '@opensumi/di';
import { IAIInlineChatService } from '@opensumi/ide-core-browser';
import { AIBackSerivcePath, Disposable, Emitter, Event, IAIBackService, runWhenIdle } from '@opensumi/ide-core-common';

export const enum EInlineChatStatus {
  READY,
  THINKING,
  DONE,
  ERROR,
}

@Injectable({ multiple: false })
export class AIInlineChatService extends Disposable implements IAIInlineChatService {
  @Autowired(AIBackSerivcePath)
  aiBackService: IAIBackService;

  private _status: EInlineChatStatus = EInlineChatStatus.READY;

  public get status(): EInlineChatStatus {
    return this._status;
  }

  private readonly _onChatStatus = this.registerDispose(new Emitter<EInlineChatStatus>());
  public readonly onChatStatus: Event<EInlineChatStatus> = this._onChatStatus.event;

  public readonly _onAccept = this.registerDispose(new Emitter<void>());
  public readonly onAccept: Event<void> = this._onAccept.event;

  public readonly _onDiscard = this.registerDispose(new Emitter<void>());
  public readonly onDiscard: Event<void> = this._onDiscard.event;

  public readonly _onRegenerate = this.registerDispose(new Emitter<void>());
  public readonly onRegenerate: Event<void> = this._onRegenerate.event;

  private readonly _onThumbs = this.registerDispose(new Emitter<boolean>());
  public readonly onThumbs: Event<boolean> = this._onThumbs.event;

  public fireThumbsEvent(isThumbsUp: boolean) {
    this._onThumbs.fire(isThumbsUp);
  }

  public isLoading(): boolean {
    return this._status === EInlineChatStatus.THINKING;
  }

  public launchChatStatus(status: EInlineChatStatus) {
    runWhenIdle(() => {
      this._status = status;
      this._onChatStatus.fire(status);
    });
  }
}

import { Autowired, Injectable } from '@opensumi/di';
import { IAiInlineChatService } from '@opensumi/ide-core-browser';
import { Emitter, Event, runWhenIdle } from '@opensumi/ide-core-common';
import { AiBackSerivcePath, IAiBackService } from '@opensumi/ide-core-common/lib/ai-native';

export const enum EInlineChatStatus {
  READY,
  THINKING,
  DONE,
  ERROR,
}

@Injectable({ multiple: false })
export class AiInlineChatService implements IAiInlineChatService {
  @Autowired(AiBackSerivcePath)
  aiBackService: IAiBackService;

  private _status: EInlineChatStatus = EInlineChatStatus.READY;

  public get status(): EInlineChatStatus {
    return this._status;
  }

  private readonly _onChatStatus = new Emitter<EInlineChatStatus>();
  public readonly onChatStatus: Event<EInlineChatStatus> = this._onChatStatus.event;

  // 采纳
  public readonly _onAccept = new Emitter<void>();
  public readonly onAccept: Event<void> = this._onAccept.event;

  // 丢弃
  public readonly _onDiscard = new Emitter<void>();
  public readonly onDiscard: Event<void> = this._onDiscard.event;

  // 重新生成
  public readonly _onRegenerate = new Emitter<void>();
  public readonly onRegenerate: Event<void> = this._onRegenerate.event;

  // 点赞点踩
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

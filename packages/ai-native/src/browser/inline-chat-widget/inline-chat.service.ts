import { Injectable, Autowired } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Emitter, Event, CommandService } from '@opensumi/ide-core-common';

import { AiBackSerivcePath, IAiBackService } from '../../common/index';

export const enum EInlineChatStatus {
  READY,
  THINKING,
  DONE,
  ERROR,
}

@Injectable({ multiple: false })
export class AiInlineChatService {
  @Autowired(AiBackSerivcePath)
  aiBackService: IAiBackService;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @Autowired(PreferenceService)
  protected preferenceService: PreferenceService;

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

  public isLoading(): boolean {
    return this._status === EInlineChatStatus.THINKING;
  }

  public launchChatStatus(status: EInlineChatStatus) {
    setTimeout(() => {
      this._status = status;
      this._onChatStatus.fire(status);
    });
  }
}

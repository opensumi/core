import { Autowired, Injectable } from '@opensumi/di';
import { Disposable, Emitter, Event } from '@opensumi/ide-core-common';

import { IChatInternalService, IChatMessageStructure } from '../../common';

import { ChatInternalService } from './chat.internal.service';

@Injectable()
export class ChatService extends Disposable {
  @Autowired(IChatInternalService)
  private chatInternalService: ChatInternalService;

  private readonly _onChatMessageLaunch = new Emitter<IChatMessageStructure>();
  public readonly onChatMessageLaunch: Event<IChatMessageStructure> = this._onChatMessageLaunch.event;

  private readonly _onChatReplyMessageLaunch = new Emitter<string>();
  public readonly onChatReplyMessageLaunch: Event<string> = this._onChatReplyMessageLaunch.event;

  public sendMessage(data: IChatMessageStructure) {
    this._onChatMessageLaunch.fire(data);
  }

  /**
   * 主动以 ai role 的身份回复消息
   */
  public sendReplyMessage(data: string) {
    this._onChatReplyMessageLaunch.fire(data);
  }
}

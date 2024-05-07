import { Autowired, Injectable } from '@opensumi/di';
import { Disposable, Emitter, Event } from '@opensumi/ide-core-common';

import { IChatMessageStructure } from '../../common';
import { IHistoryChatMessage, MsgHistoryManager } from '../model/msg-history-manager';

@Injectable()
export class ChatService extends Disposable {
  @Autowired(MsgHistoryManager)
  private msgHistoryManager: MsgHistoryManager;

  private readonly _onChatMessageLaunch = new Emitter<IChatMessageStructure>();
  public readonly onChatMessageLaunch: Event<IChatMessageStructure> = this._onChatMessageLaunch.event;

  private readonly _onChatReplyMessageLaunch = new Emitter<string>();
  public readonly onChatReplyMessageLaunch: Event<string> = this._onChatReplyMessageLaunch.event;

  constructor () {
    super();
    this.addDispose(this.msgHistoryManager);
  }

  public sendMessage(data: IChatMessageStructure) {
    this._onChatMessageLaunch.fire(data);
  }

  public clearHistoryMessages() {
    this.msgHistoryManager.clearMessages();
  }

  /**
   * 主动以 ai role 的身份回复消息
   */
  public sendReplyMessage(data: string) {
    this._onChatReplyMessageLaunch.fire(data);
  }

  public getHistoryMessages(): IHistoryChatMessage[] {
    return this.msgHistoryManager.getMessages();
  }
}

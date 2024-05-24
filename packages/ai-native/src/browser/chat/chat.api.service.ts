import { Autowired, Injectable } from '@opensumi/di';
import { Disposable, Emitter, Event } from '@opensumi/ide-core-common';
import { IHistoryChatMessage } from '@opensumi/ide-core-common/lib/types/ai-native';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { AI_CHAT_VIEW_ID, IChatMessageStructure } from '../../common';
import { MsgHistoryManager } from '../model/msg-history-manager';

@Injectable()
export class ChatService extends Disposable {
  @Autowired(MsgHistoryManager)
  private msgHistoryManager: MsgHistoryManager;

  @Autowired(IMainLayoutService)
  private mainLayoutService: IMainLayoutService;

  private readonly _onChatMessageLaunch = new Emitter<IChatMessageStructure>();
  public readonly onChatMessageLaunch: Event<IChatMessageStructure> = this._onChatMessageLaunch.event;

  private readonly _onChatReplyMessageLaunch = new Emitter<string>();
  public readonly onChatReplyMessageLaunch: Event<string> = this._onChatReplyMessageLaunch.event;

  private readonly _onScrollToBottom = new Emitter<void>();
  public readonly onScrollToBottom: Event<void> = this._onScrollToBottom.event;

  constructor() {
    super();
    this.addDispose(this.msgHistoryManager);
  }

  /**
   * 显示聊天视图
   */
  public showChatView() {
    this.mainLayoutService.toggleSlot(AI_CHAT_VIEW_ID, true);
  }

  public sendMessage(data: IChatMessageStructure) {
    this.showChatView();
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

  public scrollToBottom(): void {
    this._onScrollToBottom.fire();
  }
}

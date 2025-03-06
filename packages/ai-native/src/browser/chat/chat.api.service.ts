import { Autowired, Injectable } from '@opensumi/di';
import { Disposable, Emitter, Event } from '@opensumi/ide-core-common';
import { IChatComponent, IChatContent } from '@opensumi/ide-core-common/lib/types/ai-native';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { AI_CHAT_VIEW_ID, IChatInternalService, IChatMessageListItem, IChatMessageStructure } from '../../common';

import { ChatInternalService } from './chat.internal.service';

@Injectable()
export class ChatService extends Disposable {
  @Autowired(IChatInternalService)
  chatInternalService: ChatInternalService;

  @Autowired(IMainLayoutService)
  private mainLayoutService: IMainLayoutService;

  private readonly _onChatMessageLaunch = new Emitter<IChatMessageStructure>();
  public readonly onChatMessageLaunch: Event<IChatMessageStructure> = this._onChatMessageLaunch.event;

  private readonly _onChatReplyMessageLaunch = new Emitter<IChatContent | IChatComponent>();
  public readonly onChatReplyMessageLaunch: Event<IChatContent | IChatComponent> = this._onChatReplyMessageLaunch.event;

  private readonly _onChatMessageListLaunch = new Emitter<IChatMessageListItem[]>();
  public readonly onChatMessageListLaunch: Event<IChatMessageListItem[]> = this._onChatMessageListLaunch.event;

  private readonly _onScrollToBottom = new Emitter<void>();
  public readonly onScrollToBottom: Event<void> = this._onScrollToBottom.event;

  constructor() {
    super();
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
    this.chatInternalService.sessionModel?.history.clearMessages();
  }

  /**
   * 主动以 ai role 的身份回复消息
   */
  public sendReplyMessage(data: string | IChatComponent | IChatContent) {
    if (typeof data === 'string') {
      this._onChatReplyMessageLaunch.fire({
        kind: 'content',
        content: data,
      });
    } else {
      this._onChatReplyMessageLaunch.fire(data);
    }
  }

  public sendMessageList(list: IChatMessageListItem[]) {
    this._onChatMessageListLaunch.fire(list);
  }

  public scrollToBottom(): void {
    this._onScrollToBottom.fire();
  }
}

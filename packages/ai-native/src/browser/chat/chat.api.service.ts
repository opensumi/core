/**
 * ChatService - 聊天 API 服务
 *
 * 提供聊天功能的外部调用接口，负责消息发送和视图控制：
 * - 显示聊天视图
 * - 发送用户消息和 AI 回复消息
 * - 管理消息列表和滚动行为
 * - 清除历史消息
 *
 * 被以下类调用:
 * - ChatAgentService: 填充聊天输入
 * - 外部模块：通过 ChatServiceToken 注入使用
 */
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

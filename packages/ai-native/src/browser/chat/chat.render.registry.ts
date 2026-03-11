/**
 * ChatRenderRegistry - 聊天渲染注册器
 *
 * 负责管理聊天视图各部分的渲染组件注册：
 * - 欢迎页面渲染
 * - AI 角色消息渲染
 * - 用户角色消息渲染
 * - 思考状态渲染
 * - 输入框渲染
 * - 思考结果渲染
 * - 视图头部渲染
 *
 * 被以下类调用:
 * - ChatView (chat.view.tsx): 获取注册的渲染组件
 */
import { Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import {
  ChatAIRoleRender,
  ChatInputRender,
  ChatThinkingRender,
  ChatThinkingResultRender,
  ChatUserRoleRender,
  ChatViewHeaderRender,
  ChatWelcomeRender,
  IChatRenderRegistry,
} from '../types';

@Injectable()
export class ChatRenderRegistry extends Disposable implements IChatRenderRegistry {
  public chatWelcomeRender?: ChatWelcomeRender;
  public chatAIRoleRender?: ChatAIRoleRender;
  public chatUserRoleRender?: ChatUserRoleRender;
  public chatThinkingRender?: ChatThinkingRender;
  public chatInputRender?: ChatInputRender;
  public chatThinkingResultRender?: ChatThinkingResultRender;
  public chatViewHeaderRender?: ChatViewHeaderRender;

  registerWelcomeRender(render: ChatWelcomeRender): void {
    this.chatWelcomeRender = render;
  }

  registerAIRoleRender(render: ChatAIRoleRender): void {
    this.chatAIRoleRender = render;
  }

  registerUserRoleRender(render: ChatUserRoleRender): void {
    this.chatUserRoleRender = render;
  }

  registerThinkingRender(render: ChatThinkingRender): void {
    this.chatThinkingRender = render;
  }

  registerInputRender(render: ChatInputRender): void {
    this.chatInputRender = render;
  }

  registerThinkingResultRender(render: ChatThinkingResultRender): void {
    this.chatThinkingResultRender = render;
  }

  registerChatViewHeaderRender(render: ChatViewHeaderRender): void {
    this.chatViewHeaderRender = render;
  }
}

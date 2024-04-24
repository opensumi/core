import { Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import {
  ChatAIRoleRender,
  ChatInputRender,
  ChatThinkingRender,
  ChatUserRoleRender,
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
}

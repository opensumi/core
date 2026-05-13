import { Injectable } from '@opensumi/di';
import { Disposable, Emitter, IDisposable } from '@opensumi/ide-core-common';

import {
  ChatAIRoleRender,
  ChatHistoryRender,
  ChatInputRender,
  ChatThinkingRender,
  ChatThinkingResultRender,
  ChatUserRoleRender,
  ChatViewHeaderRender,
  ChatWelcomePageRender,
  ChatWelcomeRender,
  IChatMessageProcessor,
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
  public chatHistoryRender?: ChatHistoryRender;

  private messageProcessors: IChatMessageProcessor[] = [];

  private readonly _onDidChangeProcessors = new Emitter<void>();
  readonly onDidChangeProcessors = this._onDidChangeProcessors.event;

  registerMessageProcessor(processor: IChatMessageProcessor): IDisposable {
    const p = { priority: 100, ...processor };
    this.messageProcessors.push(p);
    this.messageProcessors.sort((a, b) => a.priority! - b.priority!);
    this._onDidChangeProcessors.fire();

    const disposable = Disposable.create(() => {
      const idx = this.messageProcessors.indexOf(p);
      if (idx !== -1) {
        this.messageProcessors.splice(idx, 1);
        this._onDidChangeProcessors.fire();
      }
    });
    this.addDispose(disposable);
    return disposable;
  }

  getMessageProcessors(): IChatMessageProcessor[] {
    return [...this.messageProcessors];
  }

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

  public enabledMentionTypes?: string[];

  registerEnabledMentionTypes(types: string[]): void {
    this.enabledMentionTypes = types;
  }

  registerThinkingResultRender(render: ChatThinkingResultRender): void {
    this.chatThinkingResultRender = render;
  }

  registerChatViewHeaderRender(render: ChatViewHeaderRender): void {
    this.chatViewHeaderRender = render;
  }

  registerChatHistoryRender(render: ChatHistoryRender): void {
    this.chatHistoryRender = render;
  }

  public chatWelcomePageRender?: ChatWelcomePageRender;

  registerChatWelcomePageRender(render: ChatWelcomePageRender): void {
    this.chatWelcomePageRender = render;
  }
}

import { Injectable } from '@opensumi/di';
import { Dispatcher, Disposable, Emitter, Event, uuid } from '@opensumi/ide-core-common';

import { ChatMessageRole, IChatMessage } from '../../common/index';

export interface IHistoryChatMessage extends IChatMessage {
  id: string;
  order: number;

  type?: 'string' | 'component';
  relationId?: string;
  component?: React.ReactNode;
  componentProps?: { [key in string]: any };

  agentId?: string;
  agentCommand?: string;
}

type IExcludeMessage = Omit<IHistoryChatMessage, 'id' | 'order'>;

@Injectable({ multiple: false })
export class MsgHistoryManager extends Disposable {
  private messageMap: Map<string, IHistoryChatMessage> = new Map();

  private readonly _onMessageChange = new Emitter<IHistoryChatMessage[]>();
  public readonly onMessageChange: Event<IHistoryChatMessage[]> = this._onMessageChange.event;

  override dispose(): void {
    this.clearMessages();
    super.dispose();
  }

  public clearMessages() {
    this.messageMap.clear();
  }

  private doAddMessage(message: IExcludeMessage): string {
    const id = uuid(6);
    const order = this.messageMap.size;

    const msg = {
      ...message,
      id,
      order,
      type: message.type || 'string',
    };

    this.messageMap.set(id, msg);

    this._onMessageChange.fire(this.getMessages());
    return id;
  }

  public getMessages(): IHistoryChatMessage[] {
    return Array.from(this.messageMap.values()).sort((a, b) => a.order - b.order);
  }

  public addUserMessage(message: Omit<IExcludeMessage, 'role'>): string {
    return this.doAddMessage({
      ...message,
      role: ChatMessageRole.User,
    });
  }

  public addAgentMessage(message: Required<Pick<IExcludeMessage, 'agentId' | 'agentCommand' | 'content'>>): string {
    return this.doAddMessage({
      ...message,
      role: ChatMessageRole.User,
    });
  }

  public addAssistantMessage(message: Omit<IExcludeMessage, 'role'>): string {
    return this.doAddMessage({
      ...message,
      role: ChatMessageRole.Assistant,
    });
  }

  public updateAssistantMessage(id: string, message: Omit<IExcludeMessage, 'role'>) {
    if (!this.messageMap.has(id)) {
      return;
    }

    const oldMessage = this.messageMap.get(id);

    this.messageMap.set(id, {
      ...oldMessage!,
      content: message.content,
    });
  }
}

import { Injectable } from '@opensumi/di';
import { Disposable, Emitter, Event, uuid } from '@opensumi/ide-core-common';
import { ChatMessageRole } from '@opensumi/ide-core-common/lib/types/ai-native';
import { IHistoryChatMessage } from '@opensumi/ide-core-common/lib/types/ai-native';

type IExcludeMessage = Omit<IHistoryChatMessage, 'id' | 'order'>;

@Injectable({ multiple: false })
export class MsgHistoryManager extends Disposable {
  private messageMap: Map<string, IHistoryChatMessage> = new Map();
  private messageAdditionalMap: Map<string, Record<string, any>> = new Map();

  private readonly _onMessageChange = new Emitter<IHistoryChatMessage[]>();
  public readonly onMessageChange: Event<IHistoryChatMessage[]> = this._onMessageChange.event;

  private readonly _onMessageAdditionalChange = new Emitter<Record<string, any>>();
  public readonly onMessageAdditionalChange: Event<Record<string, any>> = this._onMessageAdditionalChange.event;

  override dispose(): void {
    this.clearMessages();
    super.dispose();
  }

  public clearMessages() {
    this.messageMap.clear();
    this.messageAdditionalMap.clear();
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

  public addUserMessage(
    message: Required<Pick<IExcludeMessage, 'agentId' | 'agentCommand' | 'content' | 'relationId'>>,
  ): string {
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

  public setMessageAdditional(id: string, additional: Record<string, any>) {
    if (!this.messageMap.has(id)) {
      return;
    }

    this.messageAdditionalMap.set(id, additional);

    this._onMessageAdditionalChange.fire(additional);
  }

  public getMessageAdditional(id: string): Record<string, any> {
    return this.messageAdditionalMap.get(id) || {};
  }
}

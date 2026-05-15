import { Injectable } from '@opensumi/di';
import {
  ChatInputFooterItem,
  ChatInputFooterRegistryToken,
  Disposable,
  Emitter,
  Event,
  FooterButtonPosition,
  IChatInputFooterRegistry,
  IDisposable,
} from '@opensumi/ide-core-common';

export { ChatInputFooterRegistryToken, FooterButtonPosition };

export interface ChatInputFooterContribution extends ChatInputFooterItem {
  id: string;
}

@Injectable()
export class ChatInputFooterRegistry extends Disposable implements IChatInputFooterRegistry {
  private contributions: ChatInputFooterContribution[] = [];
  private readonly onDidChangeEmitter = new Emitter<void>();
  readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;

  registerFooterItem(id: string, item: ChatInputFooterItem): IDisposable {
    const existing = this.contributions.findIndex((c) => c.id === id);
    if (existing !== -1) {
      this.contributions.splice(existing, 1);
    }

    const entry: ChatInputFooterContribution = {
      id,
      ...item,
      order: item.order ?? 100,
      position: item.position ?? FooterButtonPosition.LEFT,
    };
    this.contributions.push(entry);
    this.contributions.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const disposable = Disposable.create(() => {
      const idx = this.contributions.indexOf(entry);
      if (idx !== -1) {
        this.contributions.splice(idx, 1);
        this.onDidChangeEmitter.fire();
      }
    });
    this.addDispose(disposable);
    this.onDidChangeEmitter.fire();
    return disposable;
  }

  getItems(): ChatInputFooterContribution[] {
    return this.contributions.filter((c) => !c.visible || c.visible());
  }
}

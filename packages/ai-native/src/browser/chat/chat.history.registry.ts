import React from 'react';

import { Injectable } from '@opensumi/di';
import { ChatHistoryRegistryToken, Disposable, IDisposable } from '@opensumi/ide-core-common';

export interface ChatHistoryContribution {
  id: string;
  component: React.ComponentType<any>;
  /** Higher value = higher priority. Default 0. */
  priority?: number;
  /** Optional condition. History component is selected only when this returns true. */
  when?: () => boolean;
}

export interface IChatHistoryRegistry {
  registerChatHistory(contribution: ChatHistoryContribution): IDisposable;
  getChatHistoryContributions(): ChatHistoryContribution[];
  getActiveChatHistory(): ChatHistoryContribution | null;
}

@Injectable()
export class ChatHistoryRegistry extends Disposable implements IChatHistoryRegistry {
  private contributions: ChatHistoryContribution[] = [];

  registerChatHistory(contribution: ChatHistoryContribution): IDisposable {
    const entry = { ...contribution, priority: contribution.priority ?? 0 };
    this.contributions.push(entry);
    this.contributions.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    const disposable = Disposable.create(() => {
      const idx = this.contributions.indexOf(entry);
      if (idx !== -1) {
        this.contributions.splice(idx, 1);
      }
    });
    this.addDispose(disposable);
    return disposable;
  }

  getChatHistoryContributions(): ChatHistoryContribution[] {
    return [...this.contributions];
  }

  getActiveChatHistory(): ChatHistoryContribution | null {
    for (const c of this.contributions) {
      if (!c.when || c.when()) {
        return c;
      }
    }
    return null;
  }
}

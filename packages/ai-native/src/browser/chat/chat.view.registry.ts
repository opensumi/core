import React from 'react';

import { Injectable } from '@opensumi/di';
import { ChatViewRegistryToken, Disposable, IDisposable } from '@opensumi/ide-core-common';

export interface ChatViewContribution {
  id: string;
  component: React.ComponentType;
  /** Higher value = higher priority. Default 0. */
  priority?: number;
  /** Optional condition. View is selected only when this returns true. */
  when?: () => boolean;
}

export interface IChatViewRegistry {
  registerChatView(contribution: ChatViewContribution): IDisposable;
  getChatViewContributions(): ChatViewContribution[];
  /** Get the highest-priority contribution whose `when()` condition passes, or null. */
  getActiveChatView(): ChatViewContribution | null;
}

@Injectable()
export class ChatViewRegistry extends Disposable implements IChatViewRegistry {
  private contributions: ChatViewContribution[] = [];

  registerChatView(contribution: ChatViewContribution): IDisposable {
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

  getChatViewContributions(): ChatViewContribution[] {
    return [...this.contributions];
  }

  getActiveChatView(): ChatViewContribution | null {
    for (const c of this.contributions) {
      if (!c.when || c.when()) {
        return c;
      }
    }
    return null;
  }
}

import { DataContent } from 'ai';
import React from 'react';

import { Injectable } from '@opensumi/di';
import { Disposable, IDisposable } from '@opensumi/ide-core-common';

import { LLMContextService } from '../../common/llm-context';

/**
 * Props interface for chat input components.
 * Based on AcpChatMentionInput's prop surface — all registered inputs must satisfy this contract.
 */
export interface IChatInputProps {
  onSend: (
    value: string,
    images?: string[],
    agentId?: string,
    command?: string,
    option?: { model: string; [key: string]: any },
  ) => void;
  onValueChange?: (value: string) => void;
  onExpand?: (value: boolean) => void;
  placeholder?: string;
  enableOptions?: boolean;
  disabled?: boolean;
  sendBtnClassName?: string;
  defaultHeight?: number;
  value?: string;
  images?: Array<DataContent | URL>;
  autoFocus?: boolean;
  theme?: string | null;
  setTheme: (theme: string | null) => void;
  agentId: string;
  setAgentId: (id: string) => void;
  defaultAgentId?: string;
  command: string;
  setCommand: (command: string) => void;
  disableModelSelector?: boolean;
  sessionModelId?: string;
  contextService?: LLMContextService;
  agentModes?: Array<{ id: string; name: string; description?: string }>;
  agentCwd?: string;
}

export interface ChatInputContribution {
  id: string;
  component: React.ComponentType<IChatInputProps>;
  /** Higher value = higher priority. Default 0. */
  priority?: number;
  /** Optional condition. Input is selected only when this returns true. */
  when?: () => boolean;
}

export interface IChatInputRegistry {
  registerChatInput(contribution: ChatInputContribution): IDisposable;
  getChatInputContributions(): ChatInputContribution[];
  /** Get the highest-priority input whose `when()` condition passes, or null. */
  getActiveChatInput(): ChatInputContribution | null;
}

@Injectable()
export class ChatInputRegistry extends Disposable implements IChatInputRegistry {
  private contributions: ChatInputContribution[] = [];

  registerChatInput(contribution: ChatInputContribution): IDisposable {
    const entry: ChatInputContribution = {
      ...contribution,
      priority: contribution.priority ?? 0,
    };
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

  getChatInputContributions(): ChatInputContribution[] {
    return [...this.contributions];
  }

  getActiveChatInput(): ChatInputContribution | null {
    for (const c of this.contributions) {
      if (!c.when || c.when()) {
        return c;
      }
    }
    return null;
  }
}

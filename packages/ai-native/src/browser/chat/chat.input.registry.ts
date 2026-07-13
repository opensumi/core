import { DataContent } from 'ai';
import React from 'react';

import { Injectable } from '@opensumi/di';
import { Disposable, IDisposable } from '@opensumi/ide-core-common';

import { LLMContextService } from '../../common/llm-context';

import type { AcpTurnDraft, QueuedTurn, TurnActionResult } from './acp-chat-queued-turns';
import type { AcpSessionConfigOption, AcpSessionModelOption } from './session-provider';

export type ChatInputCapability =
  | 'restore-draft'
  | 'focus'
  | 'expand'
  | 'images'
  | 'mentions'
  | 'paste'
  | 'rich-queued-edit';

export interface ChatInputHandle {
  restoreDraft?(draft: AcpTurnDraft): void;
  focus?(): void;
  setExpanded?(expanded: boolean): void;
  toggleExpanded?(): void;
  closeTransientUi?(): boolean;
}

export interface ChatInputTurnActions {
  submit(draft: AcpTurnDraft, intent: 'normal' | 'immediate'): Promise<TurnActionResult>;
  stop(): Promise<TurnActionResult>;
  fastTrack(): Promise<TurnActionResult>;
  invalidateFastTrack(): void;
  takeBackLastQueuedTurn(): QueuedTurn | undefined;
}

export interface QueuedTurnEditorProps {
  turn: QueuedTurn;
  onSave(draft: AcpTurnDraft): Promise<void> | void;
  onCancel(): void;
  onImmediateSend(draft: AcpTurnDraft): Promise<void> | void;
  onReady?(handle: ChatInputHandle | null): void;
}

/**
 * Props interface for chat input components.
 * Based on AcpChatMentionInput's prop surface — all registered inputs must satisfy this contract.
 */
export interface IChatInputProps {
  onSend?: (
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
  loading?: boolean;
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
  currentModeId?: string;
  agentModels?: AcpSessionModelOption[];
  currentModelId?: string;
  configOptions?: AcpSessionConfigOption[];
  agentCwd?: string;
  turnActions?: ChatInputTurnActions;
  onInputHandleReady?: (handle: ChatInputHandle | null) => void;
}

export interface LegacyChatInputProps extends Omit<IChatInputProps, 'onSend'> {
  onSend: NonNullable<IChatInputProps['onSend']>;
}

export type ChatInputComponent = React.ComponentType<IChatInputProps> | React.ComponentType<LegacyChatInputProps>;

export interface ChatInputContribution {
  id: string;
  component: ChatInputComponent;
  /** Higher value = higher priority. Default 0. */
  priority?: number;
  /** Optional condition. Input is selected only when this returns true. */
  when?: () => boolean;
  capabilities?: ChatInputCapability[];
  queuedTurnEditor?: React.ComponentType<QueuedTurnEditorProps>;
}

export interface IChatInputRegistry {
  registerChatInput(contribution: ChatInputContribution): IDisposable;
  getChatInputContributions(): ChatInputContribution[];
  /** Get the highest-priority input whose `when()` condition passes, or null. */
  getActiveChatInput(): ChatInputContribution | null;
  setActiveInputHandle(handle: ChatInputHandle | null, ownerId?: string): void;
  getActiveInputHandle(): ChatInputHandle | null;
}

@Injectable()
export class ChatInputRegistry extends Disposable implements IChatInputRegistry {
  private contributions: ChatInputContribution[] = [];
  private activeInputHandle: ChatInputHandle | null = null;
  private activeInputHandleOwnerId: string | undefined;
  private activeContribution: ChatInputContribution | null = null;

  registerChatInput(contribution: ChatInputContribution): IDisposable {
    if (this.contributions.some(({ id }) => id === contribution.id)) {
      throw new Error(`Chat input contribution id "${contribution.id}" is already registered.`);
    }
    const entry: ChatInputContribution = {
      ...contribution,
      priority: contribution.priority ?? 0,
      capabilities: [...(contribution.capabilities || [])],
    };
    this.contributions.push(entry);
    this.contributions.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    this.updateActiveContribution();

    const disposable = Disposable.create(() => {
      const idx = this.contributions.indexOf(entry);
      if (idx !== -1) {
        this.contributions.splice(idx, 1);
        this.updateActiveContribution();
      }
    });
    this.addDispose(disposable);
    return disposable;
  }

  getChatInputContributions(): ChatInputContribution[] {
    return this.contributions.map((contribution) => ({
      ...contribution,
      capabilities: [...(contribution.capabilities || [])],
    }));
  }

  getActiveChatInput(): ChatInputContribution | null {
    const contribution = this.updateActiveContribution();
    if (contribution) {
      return {
        ...contribution,
        capabilities: [...(contribution.capabilities || [])],
      };
    }
    return null;
  }

  setActiveInputHandle(handle: ChatInputHandle | null, ownerId?: string): void {
    const activeContribution = this.updateActiveContribution();
    if (ownerId !== undefined) {
      if (handle && activeContribution?.id !== ownerId) {
        return;
      }
      if (!handle && this.activeInputHandleOwnerId !== ownerId) {
        return;
      }
    }
    this.activeInputHandle = handle;
    this.activeInputHandleOwnerId = handle ? ownerId : undefined;
  }

  getActiveInputHandle(): ChatInputHandle | null {
    this.updateActiveContribution();
    return this.activeInputHandle;
  }

  private updateActiveContribution(): ChatInputContribution | null {
    let activeContribution: ChatInputContribution | null = null;
    for (const contribution of this.contributions) {
      if (!contribution.when || contribution.when()) {
        activeContribution = contribution;
        break;
      }
    }
    if (activeContribution !== this.activeContribution) {
      this.activeContribution = activeContribution;
      this.activeInputHandle = null;
      this.activeInputHandleOwnerId = undefined;
    }
    return activeContribution;
  }
}

import { IHistoryChatMessage } from '@opensumi/ide-core-common';

export interface AgenticConversationViewModel {
  readonly sessionId: string;
  readonly messages: readonly Readonly<IHistoryChatMessage>[];
}

export interface AgenticConversationViewModelCacheOptions {
  maxConversations?: number;
  maxMessages?: number;
}

const DEFAULT_MAX_CONVERSATIONS = 5;
const DEFAULT_MAX_MESSAGES = 5000;

export function createAgenticConversationViewModel(
  sessionId: string,
  messages: readonly IHistoryChatMessage[],
): AgenticConversationViewModel {
  return updateAgenticConversationViewModel(sessionId, messages);
}

function isSameMessage(left: Readonly<IHistoryChatMessage>, right: Readonly<IHistoryChatMessage>): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function updateAgenticConversationViewModel(
  sessionId: string,
  messages: readonly IHistoryChatMessage[],
  previous?: AgenticConversationViewModel,
): AgenticConversationViewModel {
  const previousMessages =
    previous?.sessionId === sessionId
      ? new Map(previous.messages.map((message) => [message.id, message] as const))
      : new Map<string, Readonly<IHistoryChatMessage>>();
  return {
    sessionId,
    messages: messages.map((message) => {
      const existing = previousMessages.get(message.id);
      return existing && isSameMessage(existing, message)
        ? existing
        : (JSON.parse(JSON.stringify(message)) as IHistoryChatMessage);
    }),
  };
}

export function isAgenticConversationViewModelCurrent(
  viewModel: AgenticConversationViewModel,
  messages: readonly IHistoryChatMessage[],
): boolean {
  if (viewModel.messages.length !== messages.length) {
    return false;
  }
  return viewModel.messages.every((message, index) => isSameMessage(message, messages[index]));
}

export class AgenticConversationViewModelCache {
  private readonly maxConversations: number;
  private readonly maxMessages: number;
  private readonly entries = new Map<string, AgenticConversationViewModel>();
  private protectedSessionIds = new Set<string>();
  private messageCount = 0;

  constructor(options: AgenticConversationViewModelCacheOptions = {}) {
    this.maxConversations = options.maxConversations ?? DEFAULT_MAX_CONVERSATIONS;
    this.maxMessages = options.maxMessages ?? DEFAULT_MAX_MESSAGES;
  }

  has(sessionId: string): boolean {
    return this.entries.has(sessionId);
  }

  get(sessionId: string): AgenticConversationViewModel | undefined {
    const viewModel = this.entries.get(sessionId);
    if (!viewModel) {
      return undefined;
    }
    this.entries.delete(sessionId);
    this.entries.set(sessionId, viewModel);
    return viewModel;
  }

  set(viewModel: AgenticConversationViewModel): boolean {
    const existing = this.entries.get(viewModel.sessionId);
    if (existing) {
      this.entries.delete(viewModel.sessionId);
      this.messageCount -= existing.messages.length;
    }
    this.entries.set(viewModel.sessionId, viewModel);
    this.messageCount += viewModel.messages.length;
    this.evict(viewModel.sessionId);
    return this.entries.has(viewModel.sessionId);
  }

  delete(sessionId: string): boolean {
    const existing = this.entries.get(sessionId);
    if (!existing) {
      return false;
    }
    this.entries.delete(sessionId);
    this.messageCount -= existing.messages.length;
    return true;
  }

  protect(sessionIds: Iterable<string>): void {
    this.protectedSessionIds = new Set(sessionIds);
    this.evict();
  }

  private evict(insertedSessionId?: string): void {
    while (this.entries.size > this.maxConversations || this.messageCount > this.maxMessages) {
      const sessionIds = Array.from(this.entries.keys());
      const candidate = sessionIds.find((sessionId) => !this.protectedSessionIds.has(sessionId));
      if (!candidate) {
        if (insertedSessionId && this.entries.has(insertedSessionId)) {
          this.delete(insertedSessionId);
        }
        return;
      }
      this.delete(candidate);
    }
  }
}

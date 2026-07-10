export interface AcpQueuedMessageOption {
  model: string;
  [key: string]: unknown;
}

export interface AcpQueuedMessageDraft {
  message: string;
  images?: string[];
  agentId?: string;
  command?: string;
  option?: AcpQueuedMessageOption;
}

export interface AcpQueuedMessage extends AcpQueuedMessageDraft {
  id: string;
}

export type AcpQueuedMessageProcessingState = 'auto' | 'paused' | 'awaiting-turn-completion';

export interface AcpQueuedMessagesState {
  entries: AcpQueuedMessage[];
  nextId: number;
  processingState: AcpQueuedMessageProcessingState;
  pendingDispatch?: AcpQueuedMessage;
}

export interface AcpQueuedMessageMutation {
  state: AcpQueuedMessagesState;
  entry?: AcpQueuedMessage;
}

export interface AcpQueuedMessageSendNowMutation extends AcpQueuedMessageMutation {
  shouldCancelCurrentTurn: boolean;
}

export function createAcpQueuedMessagesState(): AcpQueuedMessagesState {
  return {
    entries: [],
    nextId: 0,
    processingState: 'auto',
  };
}

export function enqueueAcpQueuedMessage(
  state: AcpQueuedMessagesState,
  draft: AcpQueuedMessageDraft,
): AcpQueuedMessageMutation & { entry: AcpQueuedMessage } {
  const entry: AcpQueuedMessage = {
    ...draft,
    id: `queued-message-${state.nextId}`,
  };

  return {
    entry,
    state: {
      ...state,
      entries: [...state.entries, entry],
      nextId: state.nextId + 1,
      processingState: 'auto',
    },
  };
}

export function removeAcpQueuedMessage(state: AcpQueuedMessagesState, id: string): AcpQueuedMessageMutation {
  const index = state.entries.findIndex((entry) => entry.id === id);
  if (index === -1) {
    return { state };
  }

  const entries = [...state.entries];
  const [entry] = entries.splice(index, 1);

  return {
    entry,
    state: {
      ...state,
      entries,
    },
  };
}

export function clearAcpQueuedMessages(state: AcpQueuedMessagesState): AcpQueuedMessagesState {
  return {
    ...state,
    entries: [],
    pendingDispatch: undefined,
    processingState: 'auto',
  };
}

export function pauseAcpQueuedMessages(state: AcpQueuedMessagesState): AcpQueuedMessagesState {
  return {
    ...state,
    processingState: 'paused',
  };
}

export function resumeAcpQueuedMessages(state: AcpQueuedMessagesState): AcpQueuedMessagesState {
  return {
    ...state,
    processingState: 'auto',
  };
}

export function requestAcpQueuedMessageSendNow(
  state: AcpQueuedMessagesState,
  id: string,
  isGenerating: boolean,
): AcpQueuedMessageSendNowMutation {
  const removeResult = removeAcpQueuedMessage(state, id);
  if (!removeResult.entry) {
    return {
      state,
      shouldCancelCurrentTurn: false,
    };
  }

  if (!isGenerating) {
    return {
      state: {
        ...removeResult.state,
        processingState: 'auto',
      },
      entry: removeResult.entry,
      shouldCancelCurrentTurn: false,
    };
  }

  return {
    state: {
      ...removeResult.state,
      processingState: 'awaiting-turn-completion',
      pendingDispatch: removeResult.entry,
    },
    shouldCancelCurrentTurn: true,
  };
}

export function completeAcpQueuedTurn(state: AcpQueuedMessagesState): AcpQueuedMessageMutation {
  if (state.processingState === 'awaiting-turn-completion') {
    return {
      entry: state.pendingDispatch,
      state: {
        ...state,
        pendingDispatch: undefined,
        processingState: 'auto',
      },
    };
  }

  if (state.processingState === 'paused' || state.entries.length === 0) {
    return { state };
  }

  const [entry, ...entries] = state.entries;
  return {
    entry,
    state: {
      ...state,
      entries,
    },
  };
}

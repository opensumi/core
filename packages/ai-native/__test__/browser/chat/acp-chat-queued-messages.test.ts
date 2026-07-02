import {
  completeAcpQueuedTurn,
  createAcpQueuedMessagesState,
  enqueueAcpQueuedMessage,
  pauseAcpQueuedMessages,
  removeAcpQueuedMessage,
  requestAcpQueuedMessageSendNow,
  resumeAcpQueuedMessages,
} from '../../../src/browser/chat/acp-chat-queued-messages';

describe('ACP chat queued messages', () => {
  it('dispatches queued messages in FIFO order when turns complete', () => {
    let state = createAcpQueuedMessagesState();

    let enqueueResult = enqueueAcpQueuedMessage(state, { message: 'first' });
    state = enqueueResult.state;
    enqueueResult = enqueueAcpQueuedMessage(state, { message: 'second' });
    state = enqueueResult.state;

    let completeResult = completeAcpQueuedTurn(state);
    expect(completeResult.entry?.message).toBe('first');
    state = completeResult.state;

    completeResult = completeAcpQueuedTurn(state);
    expect(completeResult.entry?.message).toBe('second');
    state = completeResult.state;

    expect(state.entries).toHaveLength(0);
  });

  it('keeps queued messages paused after the user stops generation', () => {
    let state = createAcpQueuedMessagesState();

    state = enqueueAcpQueuedMessage(state, { message: 'queued after stop' }).state;
    state = pauseAcpQueuedMessages(state);

    const completeResult = completeAcpQueuedTurn(state);

    expect(completeResult.entry).toBeUndefined();
    expect(completeResult.state.entries.map((entry) => entry.message)).toEqual(['queued after stop']);
  });

  it('resumes automatic processing after the user sends again', () => {
    let state = createAcpQueuedMessagesState();

    state = enqueueAcpQueuedMessage(state, { message: 'queued after resume' }).state;
    state = pauseAcpQueuedMessages(state);
    state = resumeAcpQueuedMessages(state);

    const completeResult = completeAcpQueuedTurn(state);

    expect(completeResult.entry?.message).toBe('queued after resume');
    expect(completeResult.state.entries).toHaveLength(0);
  });

  it('defers Send Now until the current pending request finishes cancelling', () => {
    let state = createAcpQueuedMessagesState();

    const first = enqueueAcpQueuedMessage(state, { message: 'send now' });
    state = first.state;
    state = enqueueAcpQueuedMessage(state, { message: 'later' }).state;

    const sendNowResult = requestAcpQueuedMessageSendNow(state, first.entry.id, true);
    expect(sendNowResult.entry).toBeUndefined();
    expect(sendNowResult.shouldCancelCurrentTurn).toBe(true);
    expect(sendNowResult.state.entries.map((entry) => entry.message)).toEqual(['later']);

    const completeResult = completeAcpQueuedTurn(sendNowResult.state);
    expect(completeResult.entry?.message).toBe('send now');
    expect(completeResult.state.entries.map((entry) => entry.message)).toEqual(['later']);
  });

  it('removes the requested queued message without disturbing the rest of the queue', () => {
    let state = createAcpQueuedMessagesState();

    state = enqueueAcpQueuedMessage(state, { message: 'keep' }).state;
    const removed = enqueueAcpQueuedMessage(state, { message: 'remove me' });
    state = removed.state;
    state = enqueueAcpQueuedMessage(state, { message: 'also keep' }).state;

    const removeResult = removeAcpQueuedMessage(state, removed.entry.id);

    expect(removeResult.entry?.message).toBe('remove me');
    expect(removeResult.state.entries.map((entry) => entry.message)).toEqual(['keep', 'also keep']);
  });
});

import { ChatMessageRole } from '@opensumi/ide-core-common';

import {
  AgenticConversationViewModelCache,
  createAgenticConversationViewModel,
  isAgenticConversationViewModelCurrent,
  updateAgenticConversationViewModel,
} from '../../../src/browser/chat/agentic-conversation-view-model';

function message(id: string) {
  return {
    id,
    order: Number(id.replace(/\D/g, '')) || 0,
    role: ChatMessageRole.User,
    content: `message ${id}`,
    relationId: `relation-${id}`,
  };
}

describe('Agentic Conversation View Model', () => {
  it('keeps canonical Message identities without creating presentation nodes', () => {
    const messages = [message('m1'), message('m2')];

    const viewModel = createAgenticConversationViewModel('acp:task', messages);

    expect(viewModel.sessionId).toBe('acp:task');
    expect(viewModel.messages.map((item) => item.id)).toEqual(['m1', 'm2']);
    expect(viewModel.messages[0]).not.toHaveProperty('text');
  });

  it('evicts the least recently used unprotected conversation by conversation count', () => {
    const cache = new AgenticConversationViewModelCache({ maxConversations: 2, maxMessages: 100 });
    cache.set(createAgenticConversationViewModel('acp:a', [message('a1')]));
    cache.set(createAgenticConversationViewModel('acp:b', [message('b1')]));
    cache.get('acp:a');

    cache.set(createAgenticConversationViewModel('acp:c', [message('c1')]));

    expect(cache.has('acp:a')).toBe(true);
    expect(cache.has('acp:b')).toBe(false);
    expect(cache.has('acp:c')).toBe(true);
  });

  it('uses the message budget and protects Active and Pending conversations', () => {
    const cache = new AgenticConversationViewModelCache({ maxConversations: 5, maxMessages: 3 });
    cache.set(createAgenticConversationViewModel('acp:active', [message('a1'), message('a2')]));
    cache.set(createAgenticConversationViewModel('acp:old', [message('o1')]));
    cache.protect(['acp:active', 'acp:pending']);

    cache.set(createAgenticConversationViewModel('acp:pending', [message('p1'), message('p2')]));

    expect(cache.has('acp:active')).toBe(true);
    expect(cache.has('acp:pending')).toBe(false);
    expect(cache.has('acp:old')).toBe(false);
  });

  it('keeps the message budget as a hard limit when one protected conversation is oversized', () => {
    const cache = new AgenticConversationViewModelCache({ maxConversations: 5, maxMessages: 1 });
    cache.protect(['acp:active']);

    const cached = cache.set(createAgenticConversationViewModel('acp:active', [message('a1'), message('a2')]));

    expect(cached).toBe(false);
    expect(cache.has('acp:active')).toBe(false);
  });

  it('detects same-count canonical history updates before reusing a cached view model', () => {
    const messages = [message('m1')];
    const viewModel = createAgenticConversationViewModel('acp:task', messages);
    messages[0].content = 'updated while inactive';

    expect(isAgenticConversationViewModelCurrent(viewModel, messages)).toBe(false);
  });

  it('reuses unchanged message descriptors and replaces only updated live entries', () => {
    const initialMessages = [message('m1'), message('m2')];
    const initial = createAgenticConversationViewModel('acp:task', initialMessages);
    const updatedMessages = [initialMessages[0], { ...initialMessages[1], content: 'streamed update' }];

    const updated = updateAgenticConversationViewModel('acp:task', updatedMessages, initial);

    expect(updated.messages[0]).toBe(initial.messages[0]);
    expect(updated.messages[1]).not.toBe(initial.messages[1]);
    expect(updated.messages[1].content).toBe('streamed update');
  });

  it('reuses the whole view model when canonical history is unchanged', () => {
    const messages = [message('m1'), message('m2')];
    const initial = createAgenticConversationViewModel('acp:task', messages);

    const updated = updateAgenticConversationViewModel(
      'acp:task',
      messages.map((item) => ({ ...item })),
      initial,
    );

    expect(updated).toBe(initial);
    expect(updated.messages).toBe(initial.messages);
  });
});

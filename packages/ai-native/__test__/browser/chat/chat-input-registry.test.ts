import * as React from 'react';

import { ChatInputRegistry } from '../../../src/browser/chat/chat.input.registry';

describe('ChatInputRegistry ACP turn capabilities', () => {
  it('keeps a legacy input valid without new fields', () => {
    const registry = new ChatInputRegistry();
    const LegacyInput = () => React.createElement('div');
    registry.registerChatInput({ id: 'legacy', component: LegacyInput, priority: 10 });
    expect(registry.getActiveChatInput()).toMatchObject({ id: 'legacy', capabilities: [] });
  });

  it('returns declared capabilities and a queued editor', () => {
    const registry = new ChatInputRegistry();
    const Input = () => React.createElement('div');
    const QueuedEditor = () => React.createElement('div');
    registry.registerChatInput({
      id: 'rich',
      component: Input,
      queuedTurnEditor: QueuedEditor,
      capabilities: ['restore-draft', 'focus', 'expand', 'rich-queued-edit'],
      priority: 20,
    });
    expect(registry.getActiveChatInput()).toMatchObject({
      id: 'rich',
      queuedTurnEditor: QueuedEditor,
      capabilities: ['restore-draft', 'focus', 'expand', 'rich-queued-edit'],
    });
  });

  it('defensively copies declared capabilities', () => {
    const registry = new ChatInputRegistry();
    const Input = () => React.createElement('div');
    const capabilities: Array<'restore-draft' | 'focus' | 'expand'> = ['restore-draft', 'focus'];
    registry.registerChatInput({ id: 'input', component: Input, capabilities });

    capabilities.push('expand');
    const contribution = registry.getActiveChatInput();
    expect(contribution?.capabilities).not.toBe(capabilities);
    expect(contribution?.capabilities).toEqual(['restore-draft', 'focus']);
  });

  it('routes commands only to the currently mounted input handle', () => {
    const registry = new ChatInputRegistry();
    const firstHandle = { toggleExpanded: jest.fn() };
    const currentHandle = { focus: jest.fn() };
    registry.setActiveInputHandle(firstHandle);
    registry.setActiveInputHandle(currentHandle);
    expect(registry.getActiveInputHandle()).toBe(currentHandle);
    registry.setActiveInputHandle(null);
    expect(registry.getActiveInputHandle()).toBeNull();
  });
});

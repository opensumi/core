import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { MentionPanel } from '../../src/browser/components/mention-input/mention-panel';

jest.mock('@opensumi/ide-core-browser/lib/components', () => ({
  Icon: () => null,
  getIcon: (name: string) => name,
}));

jest.mock('../../src/browser/components/mention-input/mention-input.module.less', () => ({
  active: 'active',
  loading_bar: 'loading_bar',
  mention_item: 'mention_item',
  mention_item_description: 'mention_item_description',
  mention_item_left: 'mention_item_left',
  mention_item_right: 'mention_item_right',
  mention_item_text: 'mention_item_text',
  mention_list: 'mention_list',
  mention_panel: 'mention_panel',
  no_results: 'no_results',
}));

describe('MentionPanel accessibility', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('用 listbox 和 option 暴露过滤后的命令及当前键盘选中项', () => {
    act(() => {
      root.render(
        <MentionPanel
          items={[
            { id: '/bdd_echo', type: 'slash', text: '/bdd_echo', description: 'Echo' },
            { id: '/bdd_plan', type: 'slash', text: '/bdd_plan', description: 'Plan' },
          ]}
          activeIndex={0}
          onSelectItem={jest.fn()}
          position={{ top: 0, left: 0 }}
          filter='/plan'
          visible
          level={0}
          listId='agentic-chat-suggestion-list'
          ariaLabel='Available commands'
          optionIdPrefix='agentic-chat-suggestion-option'
        />,
      );
    });

    const listbox = container.querySelector('[role="listbox"]');
    const options = Array.from(container.querySelectorAll('[role="option"]'));

    expect(listbox?.getAttribute('id')).toBe('agentic-chat-suggestion-list');
    expect(listbox?.getAttribute('aria-label')).toBe('Available commands');
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain('/bdd_plan');
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    expect(options[0].getAttribute('id')).toBe('agentic-chat-suggestion-option-0');
  });
});

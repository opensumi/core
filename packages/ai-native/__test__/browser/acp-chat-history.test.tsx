import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { Simulate, act } from 'react-dom/test-utils';

import AcpChatHistory, { IChatHistoryItem, IChatHistoryProps } from '../../src/browser/acp/components/AcpChatHistory';

jest.mock('@opensumi/ide-components', () => {
  const React = require('react');
  return {
    Icon: ({ 'data-testid': testId, iconClass, animate }: any) =>
      React.createElement('span', {
        'data-testid': testId,
        'data-icon-class': iconClass,
        'data-animate': animate,
      }),
    Input: ({ value, defaultValue, onChange, onPressEnter, onBlur, className, placeholder }: any) =>
      React.createElement('input', {
        className,
        placeholder,
        value,
        defaultValue,
        onChange,
        onBlur,
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key === 'Enter') {
            onPressEnter?.(event);
          }
        },
      }),
    Loading: () => React.createElement('span', { 'data-testid': 'acp-chat-history-loading' }),
    Popover: ({ children, content, title }: any) =>
      React.createElement(
        'div',
        { 'data-testid': 'mock-popover', title },
        children,
        React.createElement('div', { 'data-testid': 'mock-popover-content' }, content),
      ),
    PopoverPosition: {
      bottomRight: 'bottomRight',
      top: 'top',
    },
    PopoverTriggerType: {
      click: 'click',
    },
    getIcon: (name: string) => `icon-${name}`,
  };
});

jest.mock('@opensumi/ide-core-browser', () => ({
  localize: (_key: string, defaultValue?: string) => defaultValue || _key,
}));

jest.mock('@opensumi/ide-core-browser/lib/components/ai-native', () => ({
  EnhanceIcon: ({ className, onClick, ariaLabel }: any) =>
    require('react').createElement('span', {
      'aria-label': ariaLabel,
      className,
      onClick,
    }),
}));

jest.mock('../../src/browser/components/acp/chat-history.module.less', () => ({
  chat_history_header: 'chat_history_header',
  chat_history_header_title: 'chat_history_header_title',
  chat_history_header_actions: 'chat_history_header_actions',
  chat_history_header_actions_history: 'chat_history_header_actions_history',
  chat_history_button_wrapper: 'chat_history_button_wrapper',
  pending_permission_badge: 'pending_permission_badge',
  pending_permission_badge_inline: 'pending_permission_badge_inline',
  chat_history_header_actions_new: 'chat_history_header_actions_new',
  chat_history_header_actions_new_disabled: 'chat_history_header_actions_new_disabled',
  chat_history_header_bar: 'chat_history_header_bar',
  chat_history_inline: 'chat_history_inline',
  chat_history_inline_content: 'chat_history_inline_content',
  chat_history_inline_list: 'chat_history_inline_list',
  chat_history_search: 'chat_history_search',
  chat_history_list: 'chat_history_list',
  chat_history_list_disabled: 'chat_history_list_disabled',
  chat_history_loading: 'chat_history_loading',
  chat_history_item: 'chat_history_item',
  chat_history_item_selected: 'chat_history_item_selected',
  chat_history_item_pending: 'chat_history_item_pending',
  chat_history_item_content: 'chat_history_item_content',
  chat_history_item_pending_icon: 'chat_history_item_pending_icon',
  chat_history_item_title: 'chat_history_item_title',
}));

describe('AcpChatHistory BDD', () => {
  let container: HTMLDivElement;
  let root: Root;

  const baseHistoryList: IChatHistoryItem[] = [
    {
      id: 'acp:oldest',
      title: 'Oldest Session',
      updatedAt: 1000,
      loading: false,
      threadStatus: 'idle',
    },
    {
      id: 'acp:middle',
      title: 'Middle Session',
      updatedAt: 2000,
      loading: false,
      threadStatus: 'awaiting_prompt',
    },
    {
      id: 'acp:current',
      title: 'New Session',
      updatedAt: 3000,
      loading: false,
      threadStatus: 'idle',
    },
  ];

  const defaultProps: IChatHistoryProps = {
    title: 'Chat History',
    historyList: baseHistoryList,
    currentId: 'acp:current',
    onNewChat: jest.fn(),
    onHistoryItemSelect: jest.fn(),
    onHistoryItemChange: jest.fn(),
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
  });

  function renderHistory(props: Partial<IChatHistoryProps> = {}) {
    const mergedProps = { ...defaultProps, ...props };
    act(() => {
      root.render(React.createElement(AcpChatHistory, mergedProps));
    });
    return mergedProps;
  }

  function getRenderedItemIds(): string[] {
    return Array.from(container.querySelectorAll('[data-testid^="chat-history-item-"]')).map((item) =>
      item.getAttribute('data-testid')!.replace('chat-history-item-', ''),
    );
  }

  function getHistoryItem(id: string): HTMLElement {
    const item = container.querySelector(`[data-testid="chat-history-item-${id}"]`);
    expect(item).not.toBeNull();
    return item as HTMLElement;
  }

  function changeSearchValue(value: string): void {
    const input = container.querySelector('input[placeholder="aiNative.operate.chatHistory.searchPlaceholder"]');
    expect(input).not.toBeNull();
    act(() => {
      Simulate.change(input as HTMLInputElement, { target: { value } } as any);
    });
  }

  it('Given manager order puts the current empty session last, when the popover renders, then the current session appears first', () => {
    renderHistory();

    expect(container.querySelector('[data-testid="acp-chat-history-button"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="acp-chat-history-popover"]')).not.toBeNull();
    expect(getRenderedItemIds()).toEqual(['acp:current', 'acp:middle', 'acp:oldest']);
    expect(getHistoryItem('acp:current').className).toContain('chat_history_item_selected');
  });

  it('Given inline variant, when it renders, then it shows the history list directly without the popover trigger', () => {
    renderHistory({ variant: 'inline' });

    expect(container.querySelector('[data-testid="acp-chat-history-button"]')).toBeNull();
    expect(container.querySelector('[data-testid="acp-chat-history-popover"]')).toBeNull();
    expect(container.querySelector('[data-testid="acp-chat-history-inline"]')).not.toBeNull();
    expect(getRenderedItemIds()).toEqual(['acp:current', 'acp:middle', 'acp:oldest']);
  });

  it('Given inline variant mounts, when a visible-change callback is provided, then it refreshes history once', () => {
    const onHistoryPopoverVisibleChange = jest.fn();

    renderHistory({ variant: 'inline', onHistoryPopoverVisibleChange });

    expect(onHistoryPopoverVisibleChange).toHaveBeenCalledWith(true);
  });

  it('Given a selected history item changes, when the component rerenders, then selection changes without moving the item to the top', () => {
    const selected = jest.fn();
    renderHistory({ currentId: 'acp:current', onHistoryItemSelect: selected });

    act(() => {
      getHistoryItem('acp:middle').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(selected).toHaveBeenCalledWith(expect.objectContaining({ id: 'acp:middle' }));

    renderHistory({ currentId: 'acp:middle', onHistoryItemSelect: selected });

    expect(getRenderedItemIds()).toEqual(['acp:current', 'acp:middle', 'acp:oldest']);
    expect(getHistoryItem('acp:middle').className).toContain('chat_history_item_selected');
    expect(getHistoryItem('acp:current').className).not.toContain('chat_history_item_selected');
  });

  it('Given a search query, when it matches one title, then only matching history items are shown', () => {
    renderHistory();

    changeSearchValue('Middle');

    expect(getRenderedItemIds()).toEqual(['acp:middle']);
    expect(container.textContent).toContain('Middle Session');
    expect(container.textContent).not.toContain('Oldest Session');
  });

  it('Given search is active, when a history item is selected, then the search value is cleared', () => {
    const selected = jest.fn();
    renderHistory({ onHistoryItemSelect: selected });
    changeSearchValue('Middle');

    act(() => {
      getHistoryItem('acp:middle').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(selected).toHaveBeenCalledWith(expect.objectContaining({ id: 'acp:middle' }));
    expect(getRenderedItemIds()).toEqual(['acp:current', 'acp:middle', 'acp:oldest']);
  });

  it('Given history is disabled, when the user clicks an item or the new-chat action, then no command is fired', () => {
    const onNewChat = jest.fn();
    const onHistoryItemSelect = jest.fn();
    renderHistory({ disabled: true, onNewChat, onHistoryItemSelect });

    act(() => {
      getHistoryItem('acp:middle').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      container
        .querySelector('.chat_history_header_actions_new')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onHistoryItemSelect).not.toHaveBeenCalled();
    expect(onNewChat).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="acp-chat-history-popover"]')?.className).toContain(
      'chat_history_list_disabled',
    );
  });

  it('Given inline history is disabled, when it renders, then disabled styling still applies to the inline list', () => {
    renderHistory({ variant: 'inline', disabled: true });

    expect(container.querySelector('[data-testid="acp-chat-history-inline"]')?.className).toContain(
      'chat_history_list_disabled',
    );
  });

  it('Given inline history has pending permissions, when it renders, then the inline header keeps the badge visible', () => {
    renderHistory({ variant: 'inline', pendingPermissionBadge: 3 });

    const badge = container.querySelector('[data-testid="acp-pending-permission-badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain('pending_permission_badge_inline');
    expect(badge?.textContent).toBe('3');
  });

  it('Given inline history is loading, when it renders, then the inline list shows the loading state', () => {
    renderHistory({ variant: 'inline', historyLoading: true });

    expect(container.querySelector('[data-testid="acp-chat-history-inline"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="acp-chat-history-loading"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="chat-history-item-acp:current"]')).toBeNull();
  });

  it('Given a session has pending permission, when it renders, then it shows the pending icon instead of the thread status icon', () => {
    renderHistory({
      historyList: [
        ...baseHistoryList,
        {
          id: 'acp:pending',
          title: 'Needs Permission',
          updatedAt: 4000,
          loading: false,
          hasPendingPermission: true,
        },
      ],
    });

    expect(container.querySelector('[data-testid="acp-permission-pending-acp:pending"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="acp-thread-status-acp:pending-default"]')).toBeNull();
    expect(getHistoryItem('acp:pending').className).toContain('chat_history_item_pending');
  });

  it('Given the history list is loading, when it renders, then the list items are replaced by a loading state', () => {
    renderHistory({ historyLoading: true });

    expect(container.querySelector('[data-testid="acp-chat-history-loading"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="chat-history-item-acp:current"]')).toBeNull();
  });

  it('Given more than one hundred history items, when the popover renders, then it keeps only the latest one hundred in reverse display order', () => {
    const historyList = Array.from({ length: 101 }, (_, index) => ({
      id: `acp:${index}`,
      title: `Session ${index}`,
      updatedAt: index,
      loading: false,
    }));

    renderHistory({ historyList, currentId: 'acp:100' });

    const renderedIds = getRenderedItemIds();
    expect(renderedIds).toHaveLength(100);
    expect(renderedIds[0]).toBe('acp:100');
    expect(renderedIds[99]).toBe('acp:1');
    expect(renderedIds).not.toContain('acp:0');
  });
});

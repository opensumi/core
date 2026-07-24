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
    Popover: ({ children, content, id, position, title }: any) =>
      React.createElement(
        'div',
        { 'data-testid': 'mock-popover', 'data-popover-id': id, 'data-position': position, title },
        children,
        React.createElement('div', { 'data-testid': 'mock-popover-content' }, content),
      ),
    PopoverPosition: {
      bottomRight: 'bottomRight',
      top: 'top',
      topLeft: 'topLeft',
    },
    PopoverTriggerType: {
      click: 'click',
    },
    getIcon: (name: string) => `icon-${name}`,
  };
});

jest.mock('@opensumi/ide-core-browser', () => ({
  KeybindingRegistry: class KeybindingRegistry {},
  localize: (_key: string, defaultValue?: string) => defaultValue || _key,
  useInjectable: () => ({
    acceleratorFor: () => ['Ctrl+Alt+N'],
    getKeybindingsForCommand: () => [{ keybinding: 'ctrlcmd+alt+n', priority: 0, resolved: [{}] }],
    onKeybindingsChanged: () => ({ dispose: jest.fn() }),
  }),
}));

jest.mock('@opensumi/ide-core-browser/lib/components/ai-native', () => ({
  EnhanceIcon: ({ className, onClick, onKeyDown, onMouseDown, tabIndex, role, ariaLabel }: any) =>
    require('react').createElement(
      'div',
      {
        'aria-label': ariaLabel,
        onClick,
        onKeyDown,
        onMouseDown,
        role,
        tabIndex,
      },
      require('react').createElement('span', { className }),
    ),
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
  chat_history_header_actions_mcp: 'chat_history_header_actions_mcp',
  chat_history_header_inline_actions: 'chat_history_header_inline_actions',
  chat_history_header_actions_collapse: 'chat_history_header_actions_collapse',
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
      createdAt: 1000,
      loading: false,
      threadStatus: 'idle',
    },
    {
      id: 'acp:middle',
      title: 'Middle Session',
      createdAt: 2000,
      loading: false,
      threadStatus: 'awaiting_prompt',
    },
    {
      id: 'acp:current',
      title: 'New Session',
      createdAt: 3000,
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

  it('Given manager order is mixed, when the popover renders, then sessions are ordered by creation time descending', () => {
    renderHistory({
      historyList: [
        {
          id: 'acp:newest',
          title: 'Newest Session',
          createdAt: 3000,
          loading: false,
        },
        {
          id: 'acp:oldest',
          title: 'Oldest Session',
          createdAt: 1000,
          loading: false,
        },
        {
          id: 'acp:middle',
          title: 'Middle Session',
          createdAt: 2000,
          loading: false,
        },
      ],
      currentId: 'acp:middle',
    });

    expect(getRenderedItemIds()).toEqual(['acp:newest', 'acp:middle', 'acp:oldest']);
  });

  it('Given legacy sessions have no creation time, when the popover renders, then it falls back to reverse manager order', () => {
    renderHistory({
      historyList: baseHistoryList.map((item) => ({
        ...item,
        createdAt: 0,
      })),
    });

    expect(getRenderedItemIds()).toEqual(['acp:current', 'acp:middle', 'acp:oldest']);
  });

  it('Given inline variant, when it renders, then it shows the history list directly without the popover trigger', () => {
    renderHistory({ variant: 'inline' });

    expect(container.querySelector('[data-testid="acp-chat-history-button"]')).toBeNull();
    expect(container.querySelector('[data-testid="acp-chat-history-popover"]')).toBeNull();
    expect(container.querySelector('.chat_history_header_actions')).toBeNull();
    expect(container.querySelector('[data-testid="acp-chat-history-inline"]')).not.toBeNull();
    expect(getRenderedItemIds()).toEqual(['acp:current', 'acp:middle', 'acp:oldest']);
  });

  it('Given inline variant, when the header renders, then the title is replaced by inline actions without new chat', () => {
    const onNewChat = jest.fn();
    renderHistory({ variant: 'inline', title: 'AI Assistant', onNewChat });

    const title = container.querySelector('.chat_history_header_title') as HTMLElement;
    const newChatAction = title.querySelector('.chat_history_header_actions_new') as HTMLElement;

    expect(title.textContent).not.toContain('AI Assistant');
    expect(newChatAction).toBeNull();
    expect(onNewChat).not.toHaveBeenCalled();
  });

  it('Given popover history, when New Chat renders, then its tooltip shows the effective shortcut', () => {
    renderHistory();

    expect(container.querySelector('[data-popover-id="ai-chat-header-new"]')?.getAttribute('title')).toBe(
      'New Chat (Ctrl+Alt+N)',
    );
  });

  it('Given popover history, when New Chat renders, then it has an accessible label', () => {
    renderHistory();

    expect(container.querySelector('[aria-label="New Chat"]')).not.toBeNull();
  });

  it.each(['Enter', ' '])('Given New Chat is focused, when %p is pressed, then it opens a new chat', (key) => {
    const onNewChat = jest.fn();
    renderHistory({ onNewChat });
    const newChat = container.querySelector('[aria-label="New Chat"]') as HTMLElement;

    expect(newChat.getAttribute('role')).toBe('button');
    expect(newChat.tabIndex).toBe(0);

    act(() => {
      newChat.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }));
    });

    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it('Given inline variant has an MCP config action, when the header renders, then it appears after collapse and opens MCP config', () => {
    const onOpenMCPConfig = jest.fn();
    renderHistory({ variant: 'inline', onOpenMCPConfig, onToggleHistoryCollapsed: jest.fn() });

    const inlineActions = container.querySelector('.chat_history_header_inline_actions') as HTMLElement;
    const actionClasses = Array.from(
      inlineActions.querySelectorAll(
        '.chat_history_header_actions_collapse, .chat_history_header_actions_new, .chat_history_header_actions_mcp',
      ),
    ).map((action) => action.className);
    const mcpAction = inlineActions.querySelector('.chat_history_header_actions_mcp') as HTMLElement;

    expect(actionClasses).toEqual(['chat_history_header_actions_collapse', 'chat_history_header_actions_mcp']);
    expect(mcpAction).not.toBeNull();

    act(() => {
      mcpAction.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onOpenMCPConfig).toHaveBeenCalledTimes(1);
  });

  it('Given no MCP config action is provided, when inline history renders, then it does not show the MCP button', () => {
    renderHistory({ variant: 'inline' });

    expect(container.querySelector('.chat_history_header_actions_mcp')).toBeNull();
  });

  it('Given popover variant has an MCP config action, when it renders, then it does not show the MCP button', () => {
    renderHistory({ onOpenMCPConfig: jest.fn() });

    expect(container.querySelector('.chat_history_header_actions_mcp')).toBeNull();
  });

  it('Given inline variant supports collapse, when the collapse action is clicked, then it toggles history', () => {
    const onToggleHistoryCollapsed = jest.fn();
    renderHistory({ variant: 'inline', onToggleHistoryCollapsed });

    const collapseAction = container.querySelector('.chat_history_header_actions_collapse') as HTMLElement;
    expect(collapseAction).not.toBeNull();

    act(() => {
      collapseAction.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onToggleHistoryCollapsed).toHaveBeenCalledTimes(1);
  });

  it('Given inline variant supports collapse, when the collapse action renders at the left edge, then its tooltip opens toward the right', () => {
    renderHistory({ variant: 'inline', onToggleHistoryCollapsed: jest.fn() });

    const collapsePopover = container.querySelector('[data-popover-id="ai-chat-header-collapse-history"]');

    expect(collapsePopover).not.toBeNull();
    expect(collapsePopover?.getAttribute('data-position')).toBe('topLeft');
  });

  it('Given inline history is collapsed, when it renders, then it keeps header actions and hides the history list', () => {
    renderHistory({ variant: 'inline', historyCollapsed: true, onToggleHistoryCollapsed: jest.fn() });

    expect(container.querySelector('.chat_history_header_actions_collapse')).not.toBeNull();
    expect(container.querySelector('.chat_history_header_actions_new')).toBeNull();
    expect(container.querySelector('[data-testid="acp-chat-history-collapsed"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="acp-chat-history-inline"]')).toBeNull();
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
          createdAt: 4000,
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
      createdAt: index,
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

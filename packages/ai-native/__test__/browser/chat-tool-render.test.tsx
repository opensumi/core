import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { ChatToolRender } from '../../src/browser/components/ChatToolRender';

const useInjectable = jest.fn();

jest.mock('@opensumi/ide-core-browser', () => ({
  useInjectable: (...args: unknown[]) => useInjectable(...args),
}));

jest.mock('@opensumi/ide-core-browser/lib/components', () => ({
  Icon: ({ iconClass }: { iconClass?: string }) => require('react').createElement('span', { 'data-icon': iconClass }),
}));

jest.mock('@opensumi/ide-core-browser/lib/components/ai-native', () => ({
  Loading: () => require('react').createElement('span', null, 'loading'),
}));

jest.mock('@opensumi/ide-core-common', () => ({
  uuid: () => 'uuid',
}));

jest.mock('@opensumi/ide-core-common/lib/localize', () => ({
  localize: (key: string) => key,
}));

jest.mock('../../src/browser/types', () => ({
  TokenMCPServerRegistry: Symbol('TokenMCPServerRegistry'),
}));

jest.mock('../../src/browser/components/ChatEditor', () => ({
  CodeEditorWithHighlight: ({ input }: { input: string }) => require('react').createElement('pre', null, input),
}));

jest.mock('../../src/browser/components/ChatToolResult', () => ({
  ChatToolResult: ({ result }: { result: string }) => require('react').createElement('pre', null, result),
}));

jest.mock('../../src/browser/components/ChatToolRender.module.less', () => ({
  chat_tool_render: 'chat_tool_render',
  expanded: 'expanded',
  section_label: 'section_label',
  state_icon: 'state_icon',
  tool_arguments: 'tool_arguments',
  tool_content: 'tool_content',
  tool_header: 'tool_header',
  tool_icon: 'tool_icon',
  tool_label: 'tool_label',
  tool_name: 'tool_name',
  tool_prefix: 'tool_prefix',
  tool_result: 'tool_result',
  tool_state: 'tool_state',
}));

describe('ChatToolRender', () => {
  let container: HTMLDivElement;
  let root: Root;
  let registry: {
    getMCPTool: jest.Mock;
    getToolComponent: jest.Mock;
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    registry = {
      getMCPTool: jest.fn(),
      getToolComponent: jest.fn(),
    };
    useInjectable.mockReturnValue(registry);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
  });

  function renderToolCall(name: string) {
    act(() => {
      root.render(
        <ChatToolRender
          value={{
            id: 'tool-call-1',
            type: 'function',
            function: {
              name,
              arguments: '{}',
            },
            state: 'complete',
          }}
        />,
      );
    });
  }

  function getToolHeader(): HTMLDivElement {
    return container.querySelector('.tool_header') as HTMLDivElement;
  }

  function getToolContent(): HTMLDivElement {
    return container.querySelector('.tool_content') as HTMLDivElement;
  }

  function keyDown(header: HTMLDivElement, key: string, repeat = false): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, repeat });
    act(() => {
      header.dispatchEvent(event);
    });
    return event;
  }

  it('uses a neutral prefix for non-MCP tool calls', () => {
    registry.getMCPTool.mockReturnValue(undefined);

    renderToolCall('terminal');

    expect(container.textContent).toContain('Called Tool');
    expect(container.textContent).not.toContain('Called MCP Tool');
    expect(container.textContent).toContain('terminal');
  });

  it('keeps the MCP prefix for registered MCP tools', () => {
    registry.getMCPTool.mockReturnValue({
      label: 'Read File',
    });

    renderToolCall('read_file');

    expect(container.textContent).toContain('Called MCP Tool');
    expect(container.textContent).toContain('Read File');
  });

  it('exposes the tool header as a focusable disclosure button', () => {
    renderToolCall('terminal');

    const header = getToolHeader();
    expect(header.tabIndex).toBe(0);
    expect(header.getAttribute('role')).toBe('button');
    expect(header.getAttribute('aria-expanded')).toBe('false');

    header.focus();
    expect(document.activeElement).toBe(header);
  });

  it('keeps click expansion behavior and exposes the expanded state', () => {
    renderToolCall('terminal');

    const header = getToolHeader();
    const content = getToolContent();

    act(() => header.click());
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(content.classList.contains('expanded')).toBe(true);

    act(() => header.click());
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(content.classList.contains('expanded')).toBe(false);
  });

  it('toggles from Enter without losing focus or reacting to key repeat', () => {
    renderToolCall('terminal');

    const header = getToolHeader();
    header.focus();

    keyDown(header, 'Enter');
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(header);

    keyDown(header, 'Enter', true);
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(header);

    keyDown(header, 'Enter');
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(header);
  });

  it('toggles from Space, prevents scrolling, and ignores key repeat', () => {
    renderToolCall('terminal');

    const header = getToolHeader();
    header.focus();

    const expandEvent = keyDown(header, ' ');
    expect(expandEvent.defaultPrevented).toBe(true);
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(header);

    const repeatedEvent = keyDown(header, ' ', true);
    expect(repeatedEvent.defaultPrevented).toBe(true);
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(header);

    const collapseEvent = keyDown(header, ' ');
    expect(collapseEvent.defaultPrevented).toBe(true);
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(header);
  });
});

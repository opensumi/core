import * as React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { act } from 'react-dom/test-utils';

jest.mock('@opensumi/ide-core-browser', () => {
  const actual = jest.requireActual('@opensumi/ide-core-browser');
  return {
    ...actual,
    getSymbolIcon: jest.fn(() => 'symbol-icon'),
    useInjectable: jest.fn(),
  };
});

jest.mock('@opensumi/ide-core-browser/lib/components', () => ({
  Icon: ({ className }: { className?: string }) => require('react').createElement('span', { className }),
  Popover: ({ children, title }: { children: React.ReactNode; title?: string }) =>
    require('react').createElement('div', { title }, children),
  PopoverPosition: {
    top: 'top',
  },
  getIcon: (name: string) => `icon-${name}`,
}));

jest.mock('@opensumi/ide-components/lib/image', () => ({
  Image: ({ src }: { src: string }) => require('react').createElement('img', { src }),
}));

jest.mock('../../src/browser/components/acp/MentionInput', () => ({
  MentionInput: ({
    currentMode,
    defaultInput,
    expanded,
    footerConfig,
  }: {
    currentMode?: string;
    defaultInput?: string;
    expanded?: boolean;
    footerConfig?: { defaultModel?: string; configOptions?: unknown[] };
  }) =>
    require('react').createElement('textarea', {
      'data-testid': 'acp-mention-input',
      'data-expanded': expanded ? 'true' : 'false',
      'data-current-mode': currentMode,
      'data-default-model': footerConfig?.defaultModel,
      'data-config-option-count': String(footerConfig?.configOptions?.length ?? 0),
      readOnly: true,
      value: defaultInput || '',
    }),
}));

jest.mock('../../src/browser/components/components.module.less', () => ({
  chat_input_container: 'chat_input_container',
  chat_input_container_expanded: 'chat_input_container_expanded',
  chat_input_body: 'chat_input_body',
  expand_icon: 'expand_icon',
  thumbnail_container: 'thumbnail_container',
  thumbnail: 'thumbnail',
  delete_button: 'delete_button',
}));

import { AcpChatMentionInput } from '../../src/browser/acp/components/AcpChatMentionInput';

function createMockService() {
  return {
    capabilities: { supportsAgentMode: true },
    workspace: { uri: undefined },
    roots: Promise.resolve([]),
    currentEditor: null,
    currentUri: undefined,
    enabledMentionTypes: undefined,
    executeCommand: jest.fn(),
    onModeChange: jest.fn(() => ({ dispose: jest.fn() })),
    onAvailableCommandsChange: jest.fn(() => ({ dispose: jest.fn() })),
    getAvailableCommands: jest.fn(() => []),
    getAllSlashCommand: jest.fn(() => []),
    getSlashCommandHandler: jest.fn(),
    getSlashCommandBySlashName: jest.fn(),
    getImageUploadProvider: jest.fn(),
    getActiveCodeEditor: jest.fn(),
    fromIcon: jest.fn(() => 'codicon codicon-test'),
    get: jest.fn(),
    error: jest.fn(),
    cancelRequest: jest.fn(),
    setSessionMode: jest.fn(),
    resolveChildren: jest.fn(() => Promise.resolve([])),
    asRelativePath: jest.fn(() => Promise.resolve(undefined)),
    getFileStat: jest.fn(() => Promise.resolve(undefined)),
    find: jest.fn(() => Promise.resolve([])),
    getIcon: jest.fn(() => ''),
    projectRules: Promise.resolve([]),
  };
}

describe('AcpChatMentionInput ref contract', () => {
  let container: HTMLDivElement;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockImplementation(() => createMockService());
  });

  afterEach(() => {
    unmountComponentAtNode(container);
    container.remove();
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('accepts a ref and exposes setInputValue without React ref warnings', () => {
    const ref = React.createRef<{ setInputValue: (value: string) => void }>();

    act(() => {
      render(
        React.createElement(AcpChatMentionInput, {
          ref,
          onSend: jest.fn(),
          setTheme: jest.fn(),
          agentId: '',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
        } as any),
        container,
      );
    });

    expect(consoleErrorSpy.mock.calls.flat().join('\n')).not.toContain('Function components cannot be given refs');
    expect(ref.current?.setInputValue).toEqual(expect.any(Function));

    act(() => {
      ref.current!.setInputValue('hello from ref');
    });

    expect((container.querySelector('[data-testid="acp-mention-input"]') as HTMLTextAreaElement).value).toBe(
      'hello from ref',
    );
  });

  it('toggles expanded state and notifies onExpand', () => {
    const onExpand = jest.fn();

    act(() => {
      render(
        React.createElement(AcpChatMentionInput, {
          onSend: jest.fn(),
          onExpand,
          setTheme: jest.fn(),
          agentId: '',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
        } as any),
        container,
      );
    });

    const input = () => container.querySelector('[data-testid="acp-mention-input"]') as HTMLTextAreaElement;
    const expandButton = container.querySelector('.expand_icon') as HTMLElement;
    const root = container.querySelector('.chat_input_container') as HTMLElement;
    expect(input().getAttribute('data-expanded')).toBe('false');
    expect(root.className).not.toContain('chat_input_container_expanded');
    expect(expandButton.querySelector('span')!.className).toContain('icon-fullescreen');

    act(() => {
      expandButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(input().getAttribute('data-expanded')).toBe('true');
    expect(root.className).toContain('chat_input_container_expanded');
    expect(expandButton.querySelector('span')!.className).toContain('icon-unfullscreen');
    expect(onExpand).toHaveBeenLastCalledWith(true);

    act(() => {
      expandButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(input().getAttribute('data-expanded')).toBe('false');
    expect(root.className).not.toContain('chat_input_container_expanded');
    expect(expandButton.querySelector('span')!.className).toContain('icon-fullescreen');
    expect(onExpand).toHaveBeenLastCalledWith(false);
    expect(onExpand).toHaveBeenCalledTimes(2);
  });

  it('syncs currentMode when currentModeId prop changes', () => {
    const props = {
      onSend: jest.fn(),
      setTheme: jest.fn(),
      agentId: '',
      setAgentId: jest.fn(),
      command: '',
      setCommand: jest.fn(),
      agentModes: [
        { id: 'plan', name: 'Plan Mode' },
        { id: 'code', name: 'Code Mode' },
      ],
    };

    act(() => {
      render(React.createElement(AcpChatMentionInput, { ...props, currentModeId: 'plan' } as any), container);
    });

    const input = () => container.querySelector('[data-testid="acp-mention-input"]') as HTMLTextAreaElement;
    expect(input().getAttribute('data-current-mode')).toBe('plan');

    act(() => {
      render(React.createElement(AcpChatMentionInput, { ...props, currentModeId: 'code' } as any), container);
    });

    expect(input().getAttribute('data-current-mode')).toBe('code');
  });

  it('syncs model and config options when props change', () => {
    const props = {
      onSend: jest.fn(),
      setTheme: jest.fn(),
      agentId: '',
      setAgentId: jest.fn(),
      command: '',
      setCommand: jest.fn(),
      agentModels: [
        { modelId: 'old-model', name: 'Old Model' },
        { modelId: 'qwen3.6-plus', name: 'Qwen' },
      ],
    };

    act(() => {
      render(
        React.createElement(AcpChatMentionInput, {
          ...props,
          currentModelId: 'old-model',
          configOptions: [{ id: 'permission', name: 'Permission' }],
        } as any),
        container,
      );
    });

    const input = () => container.querySelector('[data-testid="acp-mention-input"]') as HTMLTextAreaElement;
    expect(input().getAttribute('data-default-model')).toBe('old-model');
    expect(input().getAttribute('data-config-option-count')).toBe('1');

    act(() => {
      render(
        React.createElement(AcpChatMentionInput, {
          ...props,
          currentModelId: 'qwen3.6-plus',
          configOptions: [
            { id: 'permission', name: 'Permission' },
            { id: 'thinking', name: 'Thinking' },
          ],
        } as any),
        container,
      );
    });

    expect(input().getAttribute('data-default-model')).toBe('qwen3.6-plus');
    expect(input().getAttribute('data-config-option-count')).toBe('2');
  });
});

import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

jest.mock('@opensumi/ide-core-browser', () => {
  const actual = jest.requireActual('@opensumi/ide-core-browser');
  return {
    ...actual,
    useInjectable: jest.fn(),
    useLatest: (value: unknown) => ({ current: value }),
  };
});

jest.mock('@opensumi/ide-core-browser/lib/components', () => ({
  Icon: ({ className }: { className?: string }) => require('react').createElement('span', { className }),
  Popover: ({ children }: { children: React.ReactNode }) => require('react').createElement('div', null, children),
  PopoverPosition: { left: 'left' },
  getIcon: (name: string) => `icon-${name}`,
}));

jest.mock('@opensumi/ide-core-browser/lib/components/ai-native', () => ({
  EnhanceIcon: () => null,
}));

jest.mock('@opensumi/ide-core-browser/lib/components/ai-native/interactive-input/index', () => {
  const ReactModule = require('react') as typeof import('react');
  return {
    InteractiveInput: ReactModule.forwardRef(
      (
        props: {
          height?: number;
          onSend?: () => void;
          onValueChange?: (value: string) => void;
          value?: string;
        },
        ref: React.ForwardedRef<HTMLTextAreaElement>,
      ) =>
        ReactModule.createElement(
          'div',
          null,
          ReactModule.createElement('textarea', {
            'data-height': String(props.height),
            'data-testid': 'mock-interactive-textarea',
            onInput: (event: React.FormEvent<HTMLTextAreaElement>) => props.onValueChange?.(event.currentTarget.value),
            ref,
            value: props.value || '',
          }),
          ReactModule.createElement(
            'button',
            {
              'data-testid': 'mock-interactive-send',
              onClick: props.onSend,
              type: 'button',
            },
            'send',
          ),
        ),
    ),
  };
});

jest.mock('../../src/browser/mcp/mcp-tools-dialog.view', () => ({
  MCPToolsDialog: () => null,
}));

jest.mock('../../src/browser/components/components.module.less', () => ({
  active: 'active',
  chat_input_container: 'chat_input_container',
  chat_input_footer: 'chat_input_footer',
  input_wrapper: 'input_wrapper',
}));

import { AcpChatInput, IAcpChatInputProps } from '../../src/browser/acp/components/AcpChatInput';

import type { AcpTurnDraft } from '../../src/browser/chat/acp-chat-queued-turns';
import type { ChatInputHandle } from '../../src/browser/chat/chat.input.registry';

type FutureBasicInputProps = IAcpChatInputProps & {
  onInputHandleReady?: (handle: ChatInputHandle | null) => void;
};

let container: HTMLDivElement;
let root: Root;

function createService() {
  return {
    capabilities: { supportsMCP: false },
    cancelRequest: jest.fn(),
    executeCommand: jest.fn(),
    getActiveCodeEditor: jest.fn(),
    getAgents: jest.fn(() => []),
    getAllMCPTools: jest.fn(async () => []),
    getCommands: jest.fn(() => []),
    getSlashCommandBySlashName: jest.fn(),
    getSlashCommandHandler: jest.fn(),
    getRenderAgents: jest.fn(() => []),
    open: jest.fn(),
    parseMessage: jest.fn((value: string) => ({ message: value })),
  };
}

function renderBasicInput(overrides: Partial<FutureBasicInputProps> = {}) {
  const props: FutureBasicInputProps = {
    agentId: '',
    command: '',
    onSend: jest.fn(),
    setAgentId: jest.fn(),
    setCommand: jest.fn(),
    setTheme: jest.fn(),
    ...overrides,
  };
  act(() => {
    root.render(<AcpChatInput {...props} />);
  });
  return props;
}

function typeDraft(value: string) {
  const textarea = container.querySelector('[data-testid="mock-interactive-textarea"]') as HTMLTextAreaElement;
  act(() => {
    textarea.value = value;
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  });
  return textarea;
}

beforeEach(() => {
  container = document.createElement('div');
  const inputContainer = document.createElement('div');
  inputContainer.id = 'ai_chat_left_container';
  Object.defineProperty(inputContainer, 'clientHeight', { configurable: true, value: 400 });
  document.body.append(inputContainer, container);
  root = createRoot(container);
  jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockImplementation(() => createService());
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.querySelector('#ai_chat_left_container')?.remove();
  jest.clearAllMocks();
});

it('keeps legacy send and exposes only safe handle methods', () => {
  const onSend = jest.fn();
  const onInputHandleReady = jest.fn();
  renderBasicInput({ onSend, onInputHandleReady, agentId: 'agent', command: '/review' });
  typeDraft('basic draft');

  act(() => {
    (container.querySelector('[data-testid="mock-interactive-send"]') as HTMLButtonElement).click();
  });
  expect(onSend).toHaveBeenCalledWith('basic draft', [], 'agent', '/review');

  const handle = onInputHandleReady.mock.calls.find(([value]) => value)?.[0] as ChatInputHandle;
  expect(handle.restoreDraft).toEqual(expect.any(Function));
  expect(handle.focus).toEqual(expect.any(Function));
  expect(handle.setExpanded).toEqual(expect.any(Function));
  expect(handle.toggleExpanded).toBeUndefined();
  expect(handle.closeTransientUi).toBeUndefined();
  expect((handle as { richQueuedEditor?: unknown }).richQueuedEditor).toBeUndefined();
});

it('restores and focuses a basic draft through the safe handle and unregisters it on unmount', () => {
  const onInputHandleReady = jest.fn();
  const setAgentId = jest.fn();
  const setCommand = jest.fn();
  renderBasicInput({ onInputHandleReady, setAgentId, setCommand });
  const handle = onInputHandleReady.mock.calls.find(([value]) => value)?.[0] as ChatInputHandle;
  const draft: AcpTurnDraft = {
    message: 'restored basic draft',
    images: ['data:image/png;base64,ignored'],
    agentId: 'restored-agent',
    command: '/restore',
  };

  act(() => {
    handle.restoreDraft?.(draft);
    handle.focus?.();
    handle.setExpanded?.(true);
  });

  const textarea = container.querySelector('[data-testid="mock-interactive-textarea"]') as HTMLTextAreaElement;
  expect(textarea.value).toBe('restored basic draft');
  expect(document.activeElement).toBe(textarea);
  expect(setAgentId).toHaveBeenCalledWith('restored-agent');
  expect(setCommand).toHaveBeenCalledWith('/restore');

  act(() => root.unmount());
  expect(onInputHandleReady).toHaveBeenLastCalledWith(null);
  root = createRoot(container);
});

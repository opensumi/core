import * as React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

let mockMentionInputOnSend: ((content: string, option?: { model: string }) => unknown) | undefined;
let mockMentionInputOnSendImmediately: ((content: string, option?: { model: string }) => unknown) | undefined;
let mockMentionInputOnImageUpload: ((files: File[]) => Promise<void>) | undefined;
let mockMentionInputOnEscape: (() => void) | undefined;
let mockMentionInputOnEmptyArrowUp: (() => boolean) | undefined;
let mockMentionInputOnEmptySubmit: (() => void) | undefined;
let mockMentionInputOnToggleExpanded: (() => void) | undefined;
let mockMentionInputOnUserInput: (() => void) | undefined;
let mockUseActualMentionInput = false;
const mockMentionInputRestore = jest.fn();
const mockMentionInputFocus = jest.fn();
const mockMentionInputCloseTransientUi = jest.fn(() => true);

jest.mock('@opensumi/ide-core-browser', () => {
  const actual = jest.requireActual('@opensumi/ide-core-browser');
  return {
    ...actual,
    getSymbolIcon: jest.fn(() => 'symbol-icon'),
    useInjectable: jest.fn(),
  };
});

jest.mock('@opensumi/ide-core-common', () => {
  const actual = jest.requireActual('@opensumi/ide-core-common');
  return {
    ...actual,
    localize: jest.fn(actual.localize),
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

jest.mock('@opensumi/ide-core-browser/lib/components/ai-native', () => ({
  EnhanceIcon: ({ ariaLabel, onClick }: { ariaLabel?: string; onClick?: () => void }) =>
    require('react').createElement('button', { 'aria-label': ariaLabel, onClick, type: 'button' }, ariaLabel),
}));

jest.mock('../../src/browser/acp/permission-dialog-container', () => ({
  PermissionDialogManager: Symbol('PermissionDialogManager'),
}));

jest.mock('../../src/browser/components/permission-dialog-widget', () => ({
  PermissionDialogWidget: () => null,
}));

jest.mock('../../src/browser/chat/chat-input-footer.registry', () => ({
  ChatInputFooterRegistry: jest.fn(),
  ChatInputFooterRegistryToken: Symbol('ChatInputFooterRegistryToken'),
}));

jest.mock('../../src/browser/components/mention-input/mention-panel', () => ({
  MentionPanel: () => require('react').createElement('div'),
}));

jest.mock('../../src/browser/components/mention-input/mention-select', () => ({
  MentionSelect: () => require('react').createElement('select'),
}));

jest.mock('../../src/browser/components/acp/MentionInput', () => {
  const ReactModule = require('react') as typeof import('react');
  const ActualMentionInput = jest.requireActual('../../src/browser/components/acp/MentionInput').MentionInput;
  const MockMentionInput = ReactModule.forwardRef(
    (
      {
        currentMode,
        defaultInput,
        expanded,
        footerConfig,
        mentionItems,
        modeOptions,
        configOptions,
        onImageUpload,
        onEmptyArrowUp,
        onEmptySubmit,
        onEscape,
        onSend,
        onSendImmediately,
        onToggleExpanded,
        onUserInput,
      }: {
        currentMode?: string;
        defaultInput?: string;
        expanded?: boolean;
        footerConfig?: {
          buttons?: Array<{ id: string }>;
          defaultModel?: string;
          configOptions?: unknown[];
          showModeSelector?: boolean;
          showModelSelector?: boolean;
        };
        mentionItems?: unknown[];
        modeOptions?: unknown[];
        configOptions?: unknown[];
        onImageUpload?: (files: File[]) => Promise<void>;
        onEmptyArrowUp?: () => boolean;
        onEmptySubmit?: () => void;
        onEscape?: () => void;
        onSend?: (content: string, option?: { model: string }) => unknown;
        onSendImmediately?: (content: string, option?: { model: string }) => unknown;
        onToggleExpanded?: () => void;
        onUserInput?: () => void;
      },
      ref: React.ForwardedRef<unknown>,
    ) => {
      const React = require('react') as typeof import('react');
      const editorRef = React.useRef<HTMLDivElement>(null);
      const [value, setValue] = React.useState(defaultInput || '');
      mockMentionInputOnSend = onSend;
      mockMentionInputOnSendImmediately = onSendImmediately;
      mockMentionInputOnImageUpload = onImageUpload;
      mockMentionInputOnEscape = onEscape;
      mockMentionInputOnEmptyArrowUp = onEmptyArrowUp;
      mockMentionInputOnEmptySubmit = onEmptySubmit;
      mockMentionInputOnToggleExpanded = onToggleExpanded;
      mockMentionInputOnUserInput = onUserInput;

      React.useEffect(() => {
        setValue(defaultInput || '');
      }, [defaultInput]);

      React.useImperativeHandle(ref, () => ({
        getSerializedContent: () => (editorRef.current ? editorRef.current.textContent || '' : value),
        restoreSerializedContent: (content: string) => {
          mockMentionInputRestore(content);
          setValue(content);
          if (editorRef.current) {
            editorRef.current.textContent = content;
          }
        },
        focus: () => {
          mockMentionInputFocus();
          editorRef.current?.focus();
        },
        closeTransientUi: () => mockMentionInputCloseTransientUi(),
      }));

      return React.createElement(
        'div',
        null,
        React.createElement('textarea', {
          'data-testid': 'acp-mention-input',
          'data-expanded': expanded ? 'true' : 'false',
          'data-current-mode': currentMode,
          'data-default-model': footerConfig?.defaultModel,
          'data-config-option-count': String(footerConfig?.configOptions?.length ?? 0),
          'data-direct-config-option-count': String(configOptions?.length ?? 0),
          'data-footer-buttons': (footerConfig?.buttons || []).map(({ id }) => id).join(','),
          'data-mention-item-count': String(mentionItems?.length ?? 0),
          'data-mode-option-count': String(modeOptions?.length ?? 0),
          'data-on-image-upload': onImageUpload ? 'true' : 'false',
          'data-show-mode-selector': footerConfig?.showModeSelector ? 'true' : 'false',
          'data-show-model-selector': footerConfig?.showModelSelector ? 'true' : 'false',
          readOnly: true,
          value,
        }),
        React.createElement('div', {
          'data-testid': 'acp-contenteditable',
          contentEditable: true,
          ref: editorRef,
          suppressContentEditableWarning: true,
        }),
        React.createElement(
          'button',
          {
            'data-testid': 'acp-mention-send-whitespace',
            onClick: () => onSend?.('   \n\t  ', { model: 'mock-model' }),
            type: 'button',
          },
          'send whitespace',
        ),
        React.createElement(
          'button',
          {
            'data-testid': 'acp-mention-send-empty-html',
            onClick: () => onSend?.('<div><br></div>&nbsp;<span> </span>', { model: 'mock-model' }),
            type: 'button',
          },
          'send empty html',
        ),
      );
    },
  );

  return {
    MentionInput: ReactModule.forwardRef((props: Record<string, unknown>, ref: React.ForwardedRef<unknown>) =>
      ReactModule.createElement(mockUseActualMentionInput ? ActualMentionInput : MockMentionInput, { ...props, ref }),
    ),
  };
});

jest.mock('../../src/browser/components/components.module.less', () => ({
  chat_input_container: 'chat_input_container',
  chat_input_container_expanded: 'chat_input_container_expanded',
  chat_input_body: 'chat_input_body',
  expand_icon: 'expand_icon',
  thumbnail_container: 'thumbnail_container',
  thumbnail: 'thumbnail',
  delete_button: 'delete_button',
}));

import { localizationBundle as enUSLocalizationBundle } from '../../../i18n/src/common/en-US.lang';
import { localizationBundle as zhCNLocalizationBundle } from '../../../i18n/src/common/zh-CN.lang';
import { AcpChatMentionInput } from '../../src/browser/acp/components/AcpChatMentionInput';
import { AcpQueuedTurnEditor } from '../../src/browser/acp/components/AcpQueuedTurnEditor';
import { AcpTurnEditor } from '../../src/browser/acp/components/AcpTurnEditor';
import { AcpQueuedTurnModule } from '../../src/browser/chat/acp-chat-queued-turns';
import { AcpQueuedTurns } from '../../src/browser/chat/AcpQueuedTurns';

import type {
  AcpQueuedTurnPort,
  AcpTurnDraft,
  AcpTurnHandle,
  AcpTurnOutcome,
  TurnActionResult,
} from '../../src/browser/chat/acp-chat-queued-turns';
import type { ChatInputHandle } from '../../src/browser/chat/chat.input.registry';

interface AcpTurnEditorHandle extends ChatInputHandle {
  getDraft(): AcpTurnDraft;
  setInputValue(value: string): void;
}

interface MentionInputHandle {
  getSerializedContent(): string;
  restoreSerializedContent(content: string): void;
  focus(): void;
  closeTransientUi(): boolean;
}

const ActualMentionInput = jest.requireActual('../../src/browser/components/acp/MentionInput')
  .MentionInput as React.ForwardRefExoticComponent<React.RefAttributes<MentionInputHandle>>;

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
    getItems: jest.fn(() => []),
    onDidChange: jest.fn(() => ({ dispose: jest.fn() })),
    projectRules: Promise.resolve([]),
  };
}

function dispatchEditorKey(editor: HTMLElement, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  editor.dispatchEvent(event);
  return event;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('AcpChatMentionInput ref contract', () => {
  let container: HTMLDivElement;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockUseActualMentionInput = false;
    container = document.createElement('div');
    document.body.appendChild(container);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockImplementation(() => createMockService());
  });

  afterEach(() => {
    act(() => {
      unmountComponentAtNode(container);
    });
    container.remove();
    consoleErrorSpy.mockRestore();
    mockMentionInputOnSend = undefined;
    mockMentionInputOnSendImmediately = undefined;
    mockMentionInputOnImageUpload = undefined;
    mockMentionInputOnEscape = undefined;
    mockMentionInputOnEmptyArrowUp = undefined;
    mockMentionInputOnEmptySubmit = undefined;
    mockMentionInputOnToggleExpanded = undefined;
    mockMentionInputOnUserInput = undefined;
    mockUseActualMentionInput = false;
    jest.clearAllMocks();
  });

  it('exposes the full draft handle and registers the same handle instance', () => {
    const ref = React.createRef<AcpTurnEditorHandle>();
    const onInputHandleReady = jest.fn();
    const setAgentId = jest.fn();
    const setCommand = jest.fn();

    act(() => {
      render(
        React.createElement(AcpChatMentionInput, {
          ref,
          onInputHandleReady,
          onSend: jest.fn(),
          setTheme: jest.fn(),
          agentId: '',
          setAgentId,
          command: '',
          setCommand,
        } as any),
        container,
      );
    });

    const draft = {
      message: '{{@file:/workspace/editor.js}} follow up',
      images: ['data:image/png;base64,queued'],
      agentId: 'default-agent',
      command: '/review',
    };

    let draftReadImmediatelyAfterRestore: AcpTurnDraft | undefined;
    let didCloseTransientUi: boolean | undefined;
    act(() => {
      ref.current!.restoreDraft?.(draft);
      draftReadImmediatelyAfterRestore = ref.current!.getDraft();
      ref.current!.focus?.();
      ref.current!.setExpanded?.(true);
      didCloseTransientUi = ref.current!.closeTransientUi?.();
    });

    expect(ref.current?.getDraft).toEqual(expect.any(Function));
    expect(draftReadImmediatelyAfterRestore).toEqual(draft);
    expect(ref.current!.getDraft()).toEqual(draft);
    expect(mockMentionInputRestore).toHaveBeenCalledWith(draft.message);
    expect(mockMentionInputFocus).toHaveBeenCalledTimes(1);
    expect(mockMentionInputCloseTransientUi).toHaveBeenCalledTimes(1);
    expect(didCloseTransientUi).toBe(true);
    expect(setAgentId).toHaveBeenCalledWith('default-agent');
    expect(setCommand).toHaveBeenCalledWith('/review');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,queued');
    expect((container.querySelector('[data-testid="acp-mention-input"]') as HTMLTextAreaElement).dataset.expanded).toBe(
      'true',
    );
    expect(onInputHandleReady).toHaveBeenCalledWith(ref.current);
  });

  it('maps main editor intents to turn actions and restores a taken-back Queued Turn', async () => {
    const ref = React.createRef<AcpTurnEditorHandle>();
    const submit = jest.fn(async () => ({ accepted: true, outcome: 'queued' as const }));
    const stop = jest.fn(async () => ({ accepted: true, outcome: 'stopped' as const }));
    const fastTrack = jest.fn(async () => ({ accepted: true, outcome: 'started' as const }));
    const invalidateFastTrack = jest.fn();
    const takeBackLastQueuedTurn = jest.fn(() => ({
      id: 'queued-1',
      message: 'taken back draft',
      images: ['data:image/png;base64,taken-back'],
      agentId: 'restored-agent',
      command: '/restore',
    }));
    const legacyOnSend = jest.fn();
    const setAgentId = jest.fn();
    const setCommand = jest.fn();

    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          ref,
          variant: 'main',
          loading: true,
          onSend: legacyOnSend,
          setTheme: jest.fn(),
          agentId: 'agent',
          setAgentId,
          command: '/review',
          setCommand,
          turnActions: { submit, stop, fastTrack, invalidateFastTrack, takeBackLastQueuedTurn },
        }),
        container,
      );
    });

    await act(async () => {
      await mockMentionInputOnSend?.('normal draft', { model: 'model-1' });
      await mockMentionInputOnSendImmediately?.('immediate draft', { model: 'model-1' });
      mockMentionInputOnEscape?.();
      ref.current!.restoreDraft!({ message: '' });
      mockMentionInputOnEmptySubmit?.();
      mockMentionInputOnUserInput?.();
    });

    expect(submit).toHaveBeenNthCalledWith(
      1,
      { message: 'normal draft', images: [], agentId: 'agent', command: '/review' },
      'normal',
    );
    expect(submit).toHaveBeenNthCalledWith(
      2,
      { message: 'immediate draft', images: [], agentId: 'agent', command: '/review' },
      'immediate',
    );
    expect(legacyOnSend).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(fastTrack).toHaveBeenCalledTimes(1);
    expect(invalidateFastTrack).toHaveBeenCalledTimes(1);

    let tookBack = false;
    act(() => {
      tookBack = mockMentionInputOnEmptyArrowUp?.() || false;
    });
    expect(tookBack).toBe(true);
    expect(takeBackLastQueuedTurn).toHaveBeenCalledTimes(1);
    expect(mockMentionInputRestore).toHaveBeenCalledWith('taken back draft');
    expect(setAgentId).toHaveBeenCalledWith('restored-agent');
    expect(setCommand).toHaveBeenCalledWith('/restore');
  });

  it('maps queued editor Enter, Immediate Send, and Escape without expansion', async () => {
    const onSave = jest.fn();
    const onImmediateSend = jest.fn();
    const onCancelEdit = jest.fn();

    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          variant: 'queued',
          onSend: onSave,
          onCancelEdit,
          onImmediateSend,
          setTheme: jest.fn(),
          agentId: 'queued-agent',
          setAgentId: jest.fn(),
          command: '/queued-review',
          setCommand: jest.fn(),
        }),
        container,
      );
    });

    await act(async () => {
      await mockMentionInputOnSend?.('saved draft', { model: 'ignored-model' });
      await mockMentionInputOnSendImmediately?.('immediate draft', { model: 'ignored-model' });
      mockMentionInputOnEscape?.();
    });

    expect(onSave).toHaveBeenCalledWith('saved draft', [], 'queued-agent', '/queued-review', {
      model: 'ignored-model',
    });
    expect(onImmediateSend).toHaveBeenCalledWith({
      message: 'immediate draft',
      images: [],
      agentId: 'queued-agent',
      command: '/queued-review',
    });
    expect(onCancelEdit).toHaveBeenCalledTimes(1);
    expect(mockMentionInputOnToggleExpanded).toBeUndefined();
  });

  it('keeps the contenteditable node, focus, and selection when expanded state changes', () => {
    const ref = React.createRef<AcpTurnEditorHandle>();

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
        }),
        container,
      );
    });

    const editorBefore = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    editorBefore.textContent = 'preserve cursor';
    editorBefore.focus();
    const range = document.createRange();
    range.setStart(editorBefore.firstChild!, 8);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    expect(ref.current?.toggleExpanded).toEqual(expect.any(Function));

    act(() => {
      ref.current?.toggleExpanded?.();
    });

    const editorAfter = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    expect(editorAfter).toBe(editorBefore);
    expect(document.activeElement).toBe(editorBefore);
    expect(window.getSelection()!.getRangeAt(0).startOffset).toBe(8);
  });

  it('returns an empty message when the mounted editor is cleared after restoring a draft', () => {
    const ref = React.createRef<AcpTurnEditorHandle>();

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

    act(() => {
      ref.current!.restoreDraft?.({
        message: 'restored draft',
        images: [],
        agentId: '',
        command: '',
      });
    });

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    act(() => {
      editor.replaceChildren();
    });

    expect(ref.current!.getDraft().message).toBe('');
  });

  it('restores initialDraft callbacks only once under StrictMode', () => {
    const strictContainer = document.createElement('div');
    document.body.appendChild(strictContainer);
    const strictRoot = createRoot(strictContainer);
    const setAgentId = jest.fn();
    const setCommand = jest.fn();
    const onValueChange = jest.fn();
    const initialDraft = {
      message: 'strict draft',
      images: ['data:image/png;base64,strict'],
      agentId: 'strict-agent',
      command: '/strict',
    };

    act(() => {
      strictRoot.render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(AcpTurnEditor, {
            initialDraft,
            onSend: jest.fn(),
            onValueChange,
            setTheme: jest.fn(),
            agentId: '',
            setAgentId,
            command: '',
            setCommand,
          }),
        ),
      );
    });

    expect(setAgentId).toHaveBeenCalledTimes(1);
    expect(setAgentId).toHaveBeenCalledWith(initialDraft.agentId);
    expect(setCommand).toHaveBeenCalledTimes(1);
    expect(setCommand).toHaveBeenCalledWith(initialDraft.command);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(initialDraft.message);

    act(() => {
      strictRoot.unmount();
    });
    strictContainer.remove();
  });

  it('unregisters the input handle on unmount', () => {
    const ref = React.createRef<AcpTurnEditorHandle>();
    const onInputHandleReady = jest.fn();

    act(() => {
      render(
        React.createElement(AcpChatMentionInput, {
          ref,
          onInputHandleReady,
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

    expect(onInputHandleReady).toHaveBeenCalledWith(ref.current);

    act(() => {
      unmountComponentAtNode(container);
    });

    expect(onInputHandleReady).toHaveBeenLastCalledWith(null);
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

  it('legacy setInputValue focuses the real editor and places the caret at the end', () => {
    mockUseActualMentionInput = true;
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(createMockService());
    const ref = React.createRef<{ setInputValue: (value: string) => void }>();
    const inputValue = 'hello from legacy ref';

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

    act(() => {
      ref.current!.setInputValue(inputValue);
    });

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    const selection = window.getSelection()!;
    expect(editor.textContent).toBe(inputValue);
    expect(document.activeElement).toBe(editor);
    expect(selection.rangeCount).toBe(1);
    const caretRange = selection.getRangeAt(0);
    const contentBeforeCaret = caretRange.cloneRange();
    contentBeforeCaret.selectNodeContents(editor);
    contentBeforeCaret.setEnd(caretRange.endContainer, caretRange.endOffset);
    expect(caretRange.collapsed).toBe(true);
    expect(contentBeforeCaret.toString()).toBe(inputValue);
  });

  it('toggles expanded state and notifies onExpand', () => {
    const onExpand = jest.fn();
    const service = createMockService();
    const ref = React.createRef<AcpTurnEditorHandle>();
    service.executeCommand.mockImplementation((commandId: string) => {
      if (commandId === 'ai.chat.input.toggleExpanded') {
        ref.current?.toggleExpanded?.();
      }
    });
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(service);

    act(() => {
      render(
        React.createElement(AcpChatMentionInput, {
          ref,
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
    expect(service.executeCommand).toHaveBeenLastCalledWith('ai.chat.input.toggleExpanded');

    act(() => {
      mockMentionInputOnToggleExpanded?.();
    });

    expect(input().getAttribute('data-expanded')).toBe('false');
    expect(root.className).not.toContain('chat_input_container_expanded');
    expect(expandButton.querySelector('span')!.className).toContain('icon-fullescreen');
    expect(onExpand).toHaveBeenLastCalledWith(false);
    expect(onExpand).toHaveBeenCalledTimes(2);
    expect(service.executeCommand).toHaveBeenNthCalledWith(2, 'ai.chat.input.toggleExpanded');
  });

  it('keeps Mention and image input but hides main-only controls in the queued variant', () => {
    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          variant: 'queued',
          initialDraft: {
            message: '{{@file:/workspace/editor.ts}} review',
            images: ['data:image/png;base64,queued'],
          },
          onSend: jest.fn(),
          onCancelEdit: jest.fn(),
          onImmediateSend: jest.fn(),
          setTheme: jest.fn(),
          agentId: '',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
          agentModes: [
            { id: 'mode-1', name: 'Mode 1' },
            { id: 'mode-2', name: 'Mode 2' },
          ],
          agentModels: [{ modelId: 'model-1', name: 'Model 1' }],
          configOptions: [{ id: 'temperature', value: 'high' }],
        } as any),
        container,
      );
    });

    const input = container.querySelector('[data-testid="acp-mention-input"]') as HTMLTextAreaElement;
    expect(container.querySelector('.expand_icon')).toBeNull();
    expect(input.dataset.showModeSelector).toBe('false');
    expect(input.dataset.showModelSelector).toBe('false');
    expect(input.dataset.configOptionCount).toBe('0');
    expect(input.dataset.directConfigOptionCount).toBe('0');
    expect(input.dataset.footerButtons).toBe('upload-image');
    expect(Number(input.dataset.mentionItemCount)).toBeGreaterThan(0);
    expect(input.dataset.modeOptionCount).toBe('0');
    expect(input.dataset.onImageUpload).toBe('true');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,queued');
    expect(container.querySelector('[data-testid="acp-queued-editor-actions"]')).not.toBeNull();
  });

  it('accumulates consecutive queued image uploads through one mounted upload callback', async () => {
    const service = createMockService();
    service.getImageUploadProvider.mockReturnValue({
      imageUpload: jest.fn(async (file: File) => `data:image/png;base64,${file.name}`),
    });
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(service);
    const ref = React.createRef<AcpTurnEditorHandle>();

    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          ref,
          variant: 'queued',
          onSend: jest.fn(),
          onCancelEdit: jest.fn(),
          onImmediateSend: jest.fn(),
          setTheme: jest.fn(),
          agentId: '',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
        }),
        container,
      );
    });

    const upload = mockMentionInputOnImageUpload!;
    await act(async () => {
      await upload([new File(['a'], 'A.png', { type: 'image/png' })]);
      await upload([new File(['b'], 'B.png', { type: 'image/png' })]);
    });

    expect(ref.current!.getDraft().images).toEqual(['data:image/png;base64,A.png', 'data:image/png;base64,B.png']);
  });

  it('keeps successful images and reports the failure count after a partial upload', async () => {
    const service = createMockService();
    service.getImageUploadProvider.mockReturnValue({
      imageUpload: jest
        .fn()
        .mockResolvedValueOnce('data:image/png;base64,ok')
        .mockRejectedValueOnce(new Error('bad image')),
    });
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(service);
    const ref = React.createRef<AcpTurnEditorHandle>();

    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          ref,
          variant: 'queued',
          onSend: jest.fn(),
          onCancelEdit: jest.fn(),
          onImmediateSend: jest.fn(),
          setTheme: jest.fn(),
          agentId: '',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
        }),
        container,
      );
    });

    await act(async () => {
      await mockMentionInputOnImageUpload?.([
        new File(['ok'], 'ok.png', { type: 'image/png' }),
        new File(['bad'], 'bad.png', { type: 'image/png' }),
      ]);
    });

    expect(ref.current!.getDraft().images).toEqual(['data:image/png;base64,ok']);
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(service.error).toHaveBeenCalledWith('{0} image(s) failed to upload');
    expect(jest.requireMock('@opensumi/ide-core-common').localize).toHaveBeenCalledWith(
      'aiNative.chat.queue.imageUpload.partialFailure',
      '{0} image(s) failed to upload',
      '1',
    );
  });

  it('keeps the partial-upload failure count placeholder in both localization bundles', () => {
    const key = 'aiNative.chat.queue.imageUpload.partialFailure';
    expect(enUSLocalizationBundle.contents[key]).toContain('{0}');
    expect(zhCNLocalizationBundle.contents[key]).toContain('{0}');
  });

  it('ignores upload success and failure from an old session generation', async () => {
    const success = deferred<string>();
    const failure = deferred<string>();
    const service = createMockService();
    service.getImageUploadProvider.mockReturnValue({
      imageUpload: jest.fn((file: File) => (file.name === 'success.png' ? success.promise : failure.promise)),
    });
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(service);
    const ref = React.createRef<AcpTurnEditorHandle>();
    const renderEditor = (activeSessionId: string) =>
      React.createElement(AcpTurnEditor, {
        ref,
        activeSessionId,
        onSend: jest.fn(),
        setTheme: jest.fn(),
        agentId: '',
        setAgentId: jest.fn(),
        command: '',
        setCommand: jest.fn(),
      } as any);

    act(() => {
      render(renderEditor('session-a'), container);
    });

    const upload = mockMentionInputOnImageUpload!([
      new File(['success'], 'success.png', { type: 'image/png' }),
      new File(['failure'], 'failure.png', { type: 'image/png' }),
    ]);
    act(() => {
      render(renderEditor('session-b'), container);
    });
    await act(async () => {
      success.resolve('data:image/png;base64,old-session');
      failure.reject(new Error('old session failure'));
      await upload;
    });

    expect(ref.current!.getDraft().images).toEqual([]);
    expect(service.error).not.toHaveBeenCalled();
  });

  it('ignores an upload error after the originating editor unmounts', async () => {
    const failure = deferred<string>();
    const service = createMockService();
    service.getImageUploadProvider.mockReturnValue({ imageUpload: jest.fn(() => failure.promise) });
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(service);

    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          onSend: jest.fn(),
          setTheme: jest.fn(),
          agentId: '',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
        }),
        container,
      );
    });

    const upload = mockMentionInputOnImageUpload!([new File(['failure'], 'failure.png', { type: 'image/png' })]);
    act(() => {
      unmountComponentAtNode(container);
    });
    await act(async () => {
      failure.reject(new Error('unmounted failure'));
      await upload;
    });

    expect(service.error).not.toHaveBeenCalled();
  });

  it('ignores an upload completion after the draft is replaced', async () => {
    const uploadResult = deferred<string>();
    const service = createMockService();
    service.getImageUploadProvider.mockReturnValue({ imageUpload: jest.fn(() => uploadResult.promise) });
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(service);
    const ref = React.createRef<AcpTurnEditorHandle>();

    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          ref,
          onSend: jest.fn(),
          setTheme: jest.fn(),
          agentId: '',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
        }),
        container,
      );
    });

    const upload = mockMentionInputOnImageUpload!([new File(['old'], 'old.png', { type: 'image/png' })]);
    act(() => {
      ref.current!.restoreDraft!({ message: 'replacement', images: ['data:image/png;base64,replacement'] });
    });
    await act(async () => {
      uploadResult.resolve('data:image/png;base64,old');
      await upload;
    });

    expect(ref.current!.getDraft()).toEqual({
      message: 'replacement',
      images: ['data:image/png;base64,replacement'],
      agentId: '',
      command: '',
    });
  });

  it('retains all concurrent same-generation upload successes that settle out of order', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const service = createMockService();
    service.getImageUploadProvider.mockReturnValue({
      imageUpload: jest.fn((file: File) => (file.name === 'first.png' ? first.promise : second.promise)),
    });
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(service);
    const ref = React.createRef<AcpTurnEditorHandle>();

    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          ref,
          onSend: jest.fn(),
          setTheme: jest.fn(),
          agentId: '',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
        }),
        container,
      );
    });

    const firstUpload = mockMentionInputOnImageUpload!([new File(['first'], 'first.png', { type: 'image/png' })]);
    const secondUpload = mockMentionInputOnImageUpload!([new File(['second'], 'second.png', { type: 'image/png' })]);

    await act(async () => {
      second.resolve('data:image/png;base64,second');
      await secondUpload;
    });
    await act(async () => {
      first.resolve('data:image/png;base64,first');
      await firstUpload;
    });

    expect(ref.current!.getDraft().images).toHaveLength(2);
    expect(ref.current!.getDraft().images).toEqual(
      expect.arrayContaining(['data:image/png;base64,first', 'data:image/png;base64,second']),
    );
  });

  it('saves an image-only queued draft from the normal Send button', async () => {
    mockUseActualMentionInput = true;
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(createMockService());
    const onSend = jest.fn();

    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          variant: 'queued',
          initialDraft: {
            message: '',
            images: ['data:image/png;base64,queued'],
          },
          onSend,
          onCancelEdit: jest.fn(),
          onImmediateSend: jest.fn(),
          setTheme: jest.fn(),
          agentId: '',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
        }),
        container,
      );
    });

    await act(async () => {
      (container.querySelector('[aria-label="Send"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(onSend).toHaveBeenCalledWith('', ['data:image/png;base64,queued'], '', '', expect.any(Object));
  });

  it('saves a command-only queued draft from the normal Send button', async () => {
    mockUseActualMentionInput = true;
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(createMockService());
    const onSend = jest.fn();

    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          variant: 'queued',
          onSend,
          onCancelEdit: jest.fn(),
          onImmediateSend: jest.fn(),
          setTheme: jest.fn(),
          agentId: 'default-agent',
          setAgentId: jest.fn(),
          command: 'generate',
          setCommand: jest.fn(),
        }),
        container,
      );
    });

    await act(async () => {
      (container.querySelector('[aria-label="Send"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(onSend).toHaveBeenCalledWith('', [], 'default-agent', 'generate', expect.any(Object));
  });

  it('keeps an empty main editor inert when the normal Send button is clicked', async () => {
    mockUseActualMentionInput = true;
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(createMockService());
    const onSend = jest.fn();

    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          onSend,
          setTheme: jest.fn(),
          agentId: '',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
        }),
        container,
      );
    });

    await act(async () => {
      (container.querySelector('[aria-label="Send"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables queued editor Immediate Send while another cancellation is settling', () => {
    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          variant: 'queued',
          onSend: jest.fn(),
          onCancelEdit: jest.fn(),
          onImmediateSend: jest.fn(),
          immediateSendDisabled: true,
          setTheme: jest.fn(),
          agentId: '',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
        } as any),
        container,
      );
    });

    const immediate = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-testid="acp-queued-editor-actions"] button'),
    ).find((button) => button.textContent === 'Immediate Send');
    expect(immediate?.disabled).toBe(true);
  });

  it('preserves the queued edit draft when the Immediate Send shortcut is disabled', async () => {
    mockUseActualMentionInput = true;
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(createMockService());
    const ref = React.createRef<AcpTurnEditorHandle>();
    const onImmediateSend = jest.fn();
    const draft: AcpTurnDraft = {
      message: 'queued draft',
      images: ['data:image/png;base64,queued'],
      agentId: 'queued-agent',
      command: '/queued-review',
    };

    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          ref,
          variant: 'queued',
          initialDraft: draft,
          onSend: jest.fn(),
          onCancelEdit: jest.fn(),
          onImmediateSend,
          immediateSendDisabled: true,
          setTheme: jest.fn(),
          agentId: draft.agentId!,
          setAgentId: jest.fn(),
          command: draft.command!,
          setCommand: jest.fn(),
        }),
        container,
      );
    });

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    await act(async () => {
      editor.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Enter',
          metaKey: true,
          shiftKey: true,
        }),
      );
      await Promise.resolve();
    });

    expect(onImmediateSend).not.toHaveBeenCalled();
    expect(ref.current!.getDraft()).toEqual(draft);
    expect(container.querySelector('[data-testid="acp-queued-editor-actions"]')).not.toBeNull();
  });

  it('preserves the main draft when turn submission is rejected', async () => {
    mockUseActualMentionInput = true;
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(createMockService());
    const ref = React.createRef<AcpTurnEditorHandle>();
    const submit = jest.fn(async () => ({ accepted: false, reason: 'stale-session' as const }));
    const draft: AcpTurnDraft = {
      message: 'main draft',
      images: ['data:image/png;base64,main'],
      agentId: 'main-agent',
      command: '/main-review',
    };

    const Harness = () => {
      const [agentId, setAgentId] = React.useState(draft.agentId!);
      const [command, setCommand] = React.useState(draft.command!);
      return React.createElement(AcpTurnEditor, {
        ref,
        variant: 'main',
        initialDraft: draft,
        onSend: jest.fn(),
        setTheme: jest.fn(),
        agentId,
        setAgentId,
        command,
        setCommand,
        turnActions: {
          submit,
          stop: jest.fn(),
          fastTrack: jest.fn(),
          invalidateFastTrack: jest.fn(),
          takeBackLastQueuedTurn: jest.fn(),
        },
      });
    };

    act(() => {
      render(React.createElement(Harness), container);
    });

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    await act(async () => {
      editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(submit).toHaveBeenCalledWith(draft, 'normal');
    expect(ref.current!.getDraft()).toEqual(draft);
  });

  it('single-flights double Enter while the first contenteditable submission is pending', async () => {
    mockUseActualMentionInput = true;
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(createMockService());
    const submission = deferred<TurnActionResult>();
    const submit = jest.fn(() => submission.promise);

    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          variant: 'main',
          initialDraft: { message: 'pending draft' },
          onSend: jest.fn(),
          setTheme: jest.fn(),
          agentId: '',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
          turnActions: {
            submit,
            stop: jest.fn(),
            fastTrack: jest.fn(),
            invalidateFastTrack: jest.fn(),
            takeBackLastQueuedTurn: jest.fn(),
          },
        }),
        container,
      );
    });

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    act(() => {
      dispatchEditorKey(editor, { key: 'Enter' });
      dispatchEditorKey(editor, { key: 'Enter' });
    });

    expect(submit).toHaveBeenCalledTimes(1);

    await act(async () => {
      submission.resolve({ accepted: true, outcome: 'queued' });
      await submission.promise;
      await Promise.resolve();
    });
  });

  it('preserves text, pasted attachment, agent, and command changes made while submission is pending', async () => {
    mockUseActualMentionInput = true;
    const upload = jest.fn(async () => 'data:image/png;base64,new');
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue({
      ...createMockService(),
      getImageUploadProvider: jest.fn(() => ({ imageUpload: upload })),
    });
    const ref = React.createRef<AcpTurnEditorHandle>();
    const submission = deferred<TurnActionResult>();
    const submit = jest.fn(() => submission.promise);
    let setHarnessAgentId!: React.Dispatch<React.SetStateAction<string>>;
    let setHarnessCommand!: React.Dispatch<React.SetStateAction<string>>;

    const Harness = () => {
      const [agentId, setAgentId] = React.useState('original-agent');
      const [command, setCommand] = React.useState('/original-command');
      setHarnessAgentId = setAgentId;
      setHarnessCommand = setCommand;
      return React.createElement(AcpTurnEditor, {
        ref,
        variant: 'main',
        initialDraft: {
          message: 'original draft',
          images: ['data:image/png;base64,original'],
          agentId: 'original-agent',
          command: '/original-command',
        },
        onSend: jest.fn(),
        setTheme: jest.fn(),
        agentId,
        setAgentId,
        command,
        setCommand,
        turnActions: {
          submit,
          stop: jest.fn(),
          fastTrack: jest.fn(),
          invalidateFastTrack: jest.fn(),
          takeBackLastQueuedTurn: jest.fn(),
        },
      });
    };

    act(() => {
      render(React.createElement(Harness), container);
    });
    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    act(() => {
      dispatchEditorKey(editor, { key: 'Enter' });
    });

    await act(async () => {
      editor.textContent = 'new draft';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      const image = new File(['png'], 'new.png', { type: 'image/png' });
      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          items: [{ kind: 'file', type: image.type, getAsFile: () => image }],
          getData: () => '',
        },
      });
      editor.dispatchEvent(pasteEvent);
      setHarnessAgentId('new-agent');
      setHarnessCommand('/new-command');
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      submission.resolve({ accepted: true, outcome: 'queued' });
      await submission.promise;
      await Promise.resolve();
    });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(ref.current!.getDraft()).toEqual({
      message: 'new draft',
      images: ['data:image/png;base64,original', 'data:image/png;base64,new'],
      agentId: 'new-agent',
      command: '/new-command',
    });
  });

  it('preserves a replacement draft restored while contenteditable submission is pending', async () => {
    mockUseActualMentionInput = true;
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(createMockService());
    const ref = React.createRef<AcpTurnEditorHandle>();
    const submission = deferred<TurnActionResult>();
    const replacement: AcpTurnDraft = {
      message: 'replacement draft',
      images: ['data:image/png;base64,replacement'],
      agentId: 'replacement-agent',
      command: '/replacement-command',
    };

    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          ref,
          variant: 'main',
          initialDraft: { message: 'original draft' },
          onSend: jest.fn(),
          setTheme: jest.fn(),
          agentId: '',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
          turnActions: {
            submit: jest.fn(() => submission.promise),
            stop: jest.fn(),
            fastTrack: jest.fn(),
            invalidateFastTrack: jest.fn(),
            takeBackLastQueuedTurn: jest.fn(),
          },
        }),
        container,
      );
    });

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    act(() => {
      dispatchEditorKey(editor, { key: 'Enter' });
      ref.current!.restoreDraft!(replacement);
    });

    await act(async () => {
      submission.resolve({ accepted: true, outcome: 'queued' });
      await submission.promise;
      await Promise.resolve();
    });

    expect(ref.current!.getDraft()).toEqual(replacement);
  });

  it('does not run accepted cleanup after the pending contenteditable editor unmounts', async () => {
    mockUseActualMentionInput = true;
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(createMockService());
    const submission = deferred<TurnActionResult>();
    const setTheme = jest.fn();
    const setAgentId = jest.fn();
    const setCommand = jest.fn();

    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          variant: 'main',
          initialDraft: { message: 'pending draft', agentId: 'agent', command: '/command' },
          onSend: jest.fn(),
          setTheme,
          agentId: 'agent',
          setAgentId,
          command: '/command',
          setCommand,
          turnActions: {
            submit: jest.fn(() => submission.promise),
            stop: jest.fn(),
            fastTrack: jest.fn(),
            invalidateFastTrack: jest.fn(),
            takeBackLastQueuedTurn: jest.fn(),
          },
        }),
        container,
      );
    });
    setTheme.mockClear();
    setAgentId.mockClear();
    setCommand.mockClear();

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    act(() => {
      dispatchEditorKey(editor, { key: 'Enter' });
      unmountComponentAtNode(container);
    });

    await act(async () => {
      submission.resolve({ accepted: true, outcome: 'queued' });
      await submission.promise;
      await Promise.resolve();
    });

    expect(setTheme).not.toHaveBeenCalled();
    expect(setAgentId).not.toHaveBeenCalled();
    expect(setCommand).not.toHaveBeenCalled();
  });

  it('preserves the queued draft and edit lease when Save is rejected', async () => {
    mockUseActualMentionInput = true;
    jest
      .requireMock('@opensumi/ide-core-browser')
      .useInjectable.mockReturnValue({ ...createMockService(), workspaceDir: '/workspace' });
    const onSave = jest.fn(async () => ({ accepted: false, reason: 'stale-session' as const }));
    const draft = {
      id: 'queued-save',
      message: 'queued save draft',
      images: ['data:image/png;base64,queued-save'],
      agentId: 'queued-save-agent',
      command: '/queued-save',
    };
    let editorHandle: AcpTurnEditorHandle | null = null;

    act(() => {
      render(
        React.createElement(AcpQueuedTurnEditor, {
          turn: draft,
          onSave,
          onCancel: jest.fn(),
          onImmediateSend: jest.fn(),
          onReady: (handle) => {
            editorHandle = handle as AcpTurnEditorHandle | null;
          },
        }),
        container,
      );
    });

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    await act(async () => {
      dispatchEditorKey(editor, { key: 'Enter' });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledWith({
      message: draft.message,
      images: draft.images,
      agentId: draft.agentId,
      command: draft.command,
    });
    expect(editorHandle!.getDraft()).toEqual({
      message: draft.message,
      images: draft.images,
      agentId: draft.agentId,
      command: draft.command,
    });
    expect(container.querySelector('[data-testid="acp-queued-editor-actions"]')).not.toBeNull();
  });

  it('preserves the queued draft and edit lease when a registered slash-command Save is rejected', async () => {
    mockUseActualMentionInput = true;
    const execute = jest.fn(
      async (_value: string, send: (value: string) => void) => void send('slash transformed draft'),
    );
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue({
      ...createMockService(),
      workspaceDir: '/workspace',
      getSlashCommandHandler: jest.fn(() => ({ execute })),
    });
    const onSave = jest.fn(async () => ({ accepted: false, reason: 'stale-session' as const }));
    const draft = {
      id: 'queued-slash-save',
      message: 'queued slash draft',
      images: ['data:image/png;base64,queued-slash-save'],
      agentId: 'queued-slash-agent',
      command: '/queued-slash-save',
    };
    let editorHandle: AcpTurnEditorHandle | null = null;

    act(() => {
      render(
        React.createElement(AcpQueuedTurnEditor, {
          turn: draft,
          onSave,
          onCancel: jest.fn(),
          onImmediateSend: jest.fn(),
          onReady: (handle) => {
            editorHandle = handle as AcpTurnEditorHandle | null;
          },
        }),
        container,
      );
    });

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    await act(async () => {
      dispatchEditorKey(editor, { key: 'Enter' });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      message: 'slash transformed draft',
      images: draft.images,
      agentId: draft.agentId,
      command: draft.command,
    });
    expect(editorHandle!.getDraft()).toEqual({
      message: draft.message,
      images: draft.images,
      agentId: draft.agentId,
      command: draft.command,
    });
    expect(container.querySelector('[data-testid="acp-queued-editor-actions"]')).not.toBeNull();
  });

  it('preserves the queued draft and edit lease when Immediate Send is rejected', async () => {
    mockUseActualMentionInput = true;
    jest
      .requireMock('@opensumi/ide-core-browser')
      .useInjectable.mockReturnValue({ ...createMockService(), workspaceDir: '/workspace' });
    const onImmediateSend = jest.fn(async () => ({ accepted: false, reason: 'start-failed' as const }));
    const draft = {
      id: 'queued-immediate',
      message: 'queued immediate draft',
      images: ['data:image/png;base64,queued-immediate'],
      agentId: 'queued-immediate-agent',
      command: '/queued-immediate',
    };
    let editorHandle: AcpTurnEditorHandle | null = null;

    act(() => {
      render(
        React.createElement(AcpQueuedTurnEditor, {
          turn: draft,
          onSave: jest.fn(),
          onCancel: jest.fn(),
          onImmediateSend,
          onReady: (handle) => {
            editorHandle = handle as AcpTurnEditorHandle | null;
          },
        }),
        container,
      );
    });

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    await act(async () => {
      dispatchEditorKey(editor, { key: 'Enter', metaKey: true, shiftKey: true });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onImmediateSend).toHaveBeenCalledWith({
      message: draft.message,
      images: draft.images,
      agentId: draft.agentId,
      command: draft.command,
    });
    expect(editorHandle!.getDraft()).toEqual({
      message: draft.message,
      images: draft.images,
      agentId: draft.agentId,
      command: draft.command,
    });
    expect(container.querySelector('[data-testid="acp-queued-editor-actions"]')).not.toBeNull();
  });

  it('transfers a start-failed main draft to the queue without leaving a second contenteditable copy', async () => {
    mockUseActualMentionInput = true;
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(createMockService());
    let status: 'idle' | 'generating' = 'idle';
    let startCount = 0;
    const outcome = deferred<AcpTurnOutcome>();
    const port: AcpQueuedTurnPort = {
      getStatus: () => status,
      start: jest.fn(async (sessionId: string | undefined, draft: AcpTurnDraft): Promise<AcpTurnHandle> => {
        startCount += 1;
        if (startCount === 1) {
          throw new Error('start failed');
        }
        status = 'generating';
        return {
          id: `delivery-${startCount}`,
          sessionId: sessionId || 'acp:session-1',
          outcome: outcome.promise,
        };
      }),
      ensureCurrentCancelled: jest.fn(async () => {
        status = 'idle';
      }),
    };
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');

    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          variant: 'main',
          onSend: jest.fn(),
          setTheme: jest.fn(),
          agentId: '',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
          turnActions: {
            submit: (draft: AcpTurnDraft, intent: 'normal' | 'immediate') => turns.submit(draft, intent),
            stop: () => turns.stop(),
            fastTrack: () => turns.fastTrack(),
            invalidateFastTrack: () => turns.invalidateFastTrack(),
            takeBackLastQueuedTurn: () => turns.takeBackLast(),
          },
        }),
        container,
      );
    });

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    act(() => {
      editor.textContent = 'start failure draft';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      dispatchEditorKey(editor, { key: 'Enter' });
      await turns.whenSettled();
    });

    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['start failure draft']);
    expect(turns.snapshot).toMatchObject({ phase: 'paused', pauseReason: 'start-failed' });
    expect(editor.textContent).toBe('');

    await act(async () => {
      await turns.resume();
      await turns.whenSettled();
    });
    expect(port.start).toHaveBeenCalledTimes(2);
    expect(turns.snapshot.entries).toEqual([]);

    await act(async () => {
      dispatchEditorKey(editor, { key: 'Enter' });
      await turns.whenSettled();
    });
    expect(port.start).toHaveBeenCalledTimes(2);
  });

  it.each(['cancel-failed', 'start-failed'] as const)(
    'restores the real queued contenteditable and edit lease after %s Immediate Send',
    async (failure) => {
      mockUseActualMentionInput = true;
      jest
        .requireMock('@opensumi/ide-core-browser')
        .useInjectable.mockReturnValue({ ...createMockService(), workspaceDir: '/workspace' });
      let status: 'idle' | 'generating' = 'idle';
      let startCount = 0;
      const outcome = deferred<AcpTurnOutcome>();
      const port: AcpQueuedTurnPort = {
        getStatus: () => status,
        start: jest.fn(async (sessionId: string | undefined, draft: AcpTurnDraft): Promise<AcpTurnHandle> => {
          startCount += 1;
          if (failure === 'start-failed' && startCount === 2) {
            throw new Error('start failed');
          }
          status = 'generating';
          return {
            id: `delivery-${startCount}`,
            sessionId: sessionId || 'acp:session-1',
            outcome: outcome.promise,
          };
        }),
        ensureCurrentCancelled: jest.fn(async () => {
          status = 'idle';
          if (failure === 'cancel-failed') {
            throw new Error('cancel failed');
          }
        }),
      };
      const turns = new AcpQueuedTurnModule(port);
      turns.activate('acp:session-1');
      await turns.submit({ message: 'running' });
      await turns.submit({
        message: 'selected',
        images: ['data:image/png;base64,selected'],
        agentId: 'selected-agent',
        command: '/selected-command',
      });
      await turns.submit({ message: 'last queued' });
      const originalIds = turns.snapshot.entries.map(({ id }) => id);
      const selectedId = originalIds[0];
      turns.beginEdit(selectedId);

      const Harness = () => {
        const [snapshot, setSnapshot] = React.useState(turns.snapshot);
        React.useEffect(() => {
          const disposable = turns.onDidChange(setSnapshot);
          return () => disposable.dispose();
        }, []);
        return React.createElement(AcpQueuedTurns, {
          snapshot,
          expanded: true,
          capabilities: ['rich-queued-edit'],
          QueuedEditor: AcpQueuedTurnEditor,
          onToggleExpanded: jest.fn(),
          onResume: jest.fn(),
          onClear: jest.fn(),
          onBeginEdit: (id: string) => void turns.beginEdit(id),
          onCommitEdit: (id: string, draft: AcpTurnDraft, immediate: boolean) => turns.commitEdit(id, draft, immediate),
          onCancelEdit: (id: string) => void turns.cancelEdit(id),
          onDelete: (id: string) => void turns.remove(id),
          onImmediateSend: (id: string) => void turns.sendImmediately(id),
          onEditorReady: jest.fn(),
        });
      };

      act(() => {
        render(React.createElement(Harness), container);
      });
      const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
      act(() => {
        editor.textContent = 'edited selected';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      });

      await act(async () => {
        (
          container.querySelector(
            '[data-testid="acp-queued-editor-actions"] button:nth-of-type(2)',
          ) as HTMLButtonElement
        ).click();
        await turns.whenSettled();
      });

      const restoredEditor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
      expect(restoredEditor).not.toBeNull();
      expect(restoredEditor.textContent).toBe('edited selected');
      expect(turns.snapshot.editingTurnId).toBe(selectedId);
      expect(turns.snapshot.entries.map(({ id }) => id)).toEqual(originalIds);
      expect(turns.snapshot.entries[0]).toEqual({
        id: selectedId,
        message: 'edited selected',
        images: ['data:image/png;base64,selected'],
        agentId: 'selected-agent',
        command: '/selected-command',
      });
    },
  );

  it.each(['main', 'queued'] as const)(
    'uses canonical empty markup and full draft payload semantics for Enter in the %s editor',
    async (variant) => {
      mockUseActualMentionInput = true;
      jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(createMockService());
      const emptyMarkupCases = [
        ['empty', ''],
        ['br', '<br>'],
        ['nested br', '<div><span><br></span></div>'],
        ['nbsp and zero-width', '&nbsp;\u200b\u200c\u200d\ufeff'],
      ] as const;
      const payloadCases: Array<[string, AcpTurnDraft]> = [
        ['Mention-only', { message: '{{@file:/workspace/review.ts}}' }],
        ['image-only', { message: '', images: ['data:image/png;base64,payload'] }],
        ['command-only', { message: '', command: '/review' }],
      ];

      for (const [name, markup] of emptyMarkupCases) {
        const ref = React.createRef<AcpTurnEditorHandle>();
        const submit = jest.fn(async () => ({ accepted: true, outcome: 'queued' as const }));
        const fastTrack = jest.fn(async () => ({ accepted: true, outcome: 'started' as const }));
        const onSend = jest.fn();

        act(() => {
          render(
            React.createElement(AcpTurnEditor, {
              ref,
              variant,
              onSend,
              onCancelEdit: jest.fn(),
              onImmediateSend: jest.fn(),
              setTheme: jest.fn(),
              agentId: '',
              setAgentId: jest.fn(),
              command: '',
              setCommand: jest.fn(),
              turnActions:
                variant === 'main'
                  ? {
                      submit,
                      stop: jest.fn(),
                      fastTrack,
                      invalidateFastTrack: jest.fn(),
                      takeBackLastQueuedTurn: jest.fn(),
                    }
                  : undefined,
            }),
            container,
          );
        });

        const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
        editor.innerHTML = markup;
        await act(async () => {
          dispatchEditorKey(editor, { key: 'Enter' });
          await Promise.resolve();
          await Promise.resolve();
        });

        if (variant === 'main') {
          expect(fastTrack).toHaveBeenCalledTimes(1);
          expect(submit).not.toHaveBeenCalled();
        } else {
          expect(onSend).not.toHaveBeenCalled();
        }
        expect(name).toBeTruthy();

        act(() => {
          unmountComponentAtNode(container);
        });
      }

      for (const [name, draft] of payloadCases) {
        const ref = React.createRef<AcpTurnEditorHandle>();
        const submit = jest.fn(async () => ({ accepted: true, outcome: 'queued' as const }));
        const fastTrack = jest.fn(async () => ({ accepted: true, outcome: 'started' as const }));
        const onSend = jest.fn();

        act(() => {
          render(
            React.createElement(AcpTurnEditor, {
              ref,
              variant,
              initialDraft: draft,
              onSend,
              onCancelEdit: jest.fn(),
              onImmediateSend: jest.fn(),
              setTheme: jest.fn(),
              agentId: '',
              setAgentId: jest.fn(),
              command: draft.command || '',
              setCommand: jest.fn(),
              turnActions:
                variant === 'main'
                  ? {
                      submit,
                      stop: jest.fn(),
                      fastTrack,
                      invalidateFastTrack: jest.fn(),
                      takeBackLastQueuedTurn: jest.fn(),
                    }
                  : undefined,
            }),
            container,
          );
        });

        const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
        await act(async () => {
          dispatchEditorKey(editor, { key: 'Enter' });
          await Promise.resolve();
          await Promise.resolve();
        });

        if (variant === 'main') {
          expect(submit).toHaveBeenCalledTimes(1);
          expect(fastTrack).not.toHaveBeenCalled();
        } else {
          expect(onSend).toHaveBeenCalledTimes(1);
        }
        expect(name).toBeTruthy();

        act(() => {
          unmountComponentAtNode(container);
        });
      }
    },
  );

  it('uses the complete main draft before taking back a queued turn on ArrowUp', () => {
    mockUseActualMentionInput = true;
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(createMockService());
    const emptyMarkupCases = ['', '<br>', '<div><span><br></span></div>', '&nbsp;\u200b\u200c\u200d\ufeff'];
    const payloadCases: AcpTurnDraft[] = [
      { message: '{{@file:/workspace/review.ts}}' },
      { message: '', images: ['data:image/png;base64,payload'] },
      { message: '', command: '/review' },
    ];

    for (const markup of emptyMarkupCases) {
      const takeBackLastQueuedTurn = jest.fn(() => ({ id: 'queued-1', message: 'taken back' }));
      act(() => {
        render(
          React.createElement(AcpTurnEditor, {
            variant: 'main',
            onSend: jest.fn(),
            setTheme: jest.fn(),
            agentId: '',
            setAgentId: jest.fn(),
            command: '',
            setCommand: jest.fn(),
            turnActions: {
              submit: jest.fn(),
              stop: jest.fn(),
              fastTrack: jest.fn(),
              invalidateFastTrack: jest.fn(),
              takeBackLastQueuedTurn,
            },
          }),
          container,
        );
      });

      const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
      editor.innerHTML = markup;
      act(() => {
        dispatchEditorKey(editor, { key: 'ArrowUp' });
      });

      expect(takeBackLastQueuedTurn).toHaveBeenCalledTimes(1);
      expect(editor.textContent).toBe('taken back');

      act(() => {
        unmountComponentAtNode(container);
      });
    }

    for (const draft of payloadCases) {
      const ref = React.createRef<AcpTurnEditorHandle>();
      const takeBackLastQueuedTurn = jest.fn(() => ({ id: 'queued-1', message: 'taken back' }));
      act(() => {
        render(
          React.createElement(AcpTurnEditor, {
            ref,
            variant: 'main',
            initialDraft: draft,
            onSend: jest.fn(),
            setTheme: jest.fn(),
            agentId: '',
            setAgentId: jest.fn(),
            command: draft.command || '',
            setCommand: jest.fn(),
            turnActions: {
              submit: jest.fn(),
              stop: jest.fn(),
              fastTrack: jest.fn(),
              invalidateFastTrack: jest.fn(),
              takeBackLastQueuedTurn,
            },
          }),
          container,
        );
      });

      const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
      act(() => {
        dispatchEditorKey(editor, { key: 'ArrowUp' });
      });

      expect(takeBackLastQueuedTurn).not.toHaveBeenCalled();
      expect(ref.current!.getDraft()).toEqual({
        message: draft.message,
        images: draft.images || [],
        agentId: draft.agentId || '',
        command: draft.command || '',
      });

      act(() => {
        unmountComponentAtNode(container);
      });
    }
  });

  it('focuses the restored ArrowUp draft at the end and appends the next character there', () => {
    mockUseActualMentionInput = true;
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(createMockService());
    const ref = React.createRef<AcpTurnEditorHandle>();
    const restoredDraft = {
      id: 'queued-restored',
      message: '{{@file:/workspace/review.ts}} restored draft',
      images: ['data:image/png;base64,restored'],
      agentId: 'restored-agent',
      command: '/restored-command',
    };
    const takeBackLastQueuedTurn = jest.fn(() => restoredDraft);

    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          ref,
          variant: 'main',
          onSend: jest.fn(),
          setTheme: jest.fn(),
          agentId: '',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
          turnActions: {
            submit: jest.fn(),
            stop: jest.fn(),
            fastTrack: jest.fn(),
            invalidateFastTrack: jest.fn(),
            takeBackLastQueuedTurn,
          },
        }),
        container,
      );
    });

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    editor.focus();
    act(() => {
      dispatchEditorKey(editor, { key: 'ArrowUp' });
    });

    expect(document.activeElement).toBe(editor);
    const selection = window.getSelection()!;
    expect(selection.isCollapsed).toBe(true);
    const range = selection.getRangeAt(0);
    expect(range.endContainer).toBe(editor);
    expect(range.endOffset).toBe(editor.childNodes.length);
    expect(ref.current!.getDraft()).toEqual({
      message: restoredDraft.message,
      images: restoredDraft.images,
      agentId: restoredDraft.agentId,
      command: restoredDraft.command,
    });

    act(() => {
      const inserted = document.createTextNode('!');
      range.insertNode(inserted);
      range.setStartAfter(inserted);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(ref.current!.getDraft().message).toBe(`${restoredDraft.message}!`);
  });

  it('uses canonical empty markup and preserves full queued payloads during ArrowUp history navigation', async () => {
    mockUseActualMentionInput = true;
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(createMockService());
    const emptyMarkupCases = ['', '<br>', '<div><span><br></span></div>', '&nbsp;\u200b\u200c\u200d\ufeff'];
    const payloadCases: AcpTurnDraft[] = [
      { message: '{{@file:/workspace/review.ts}}' },
      { message: '', images: ['data:image/png;base64,payload'] },
      { message: '', command: '/review' },
    ];

    for (const target of [
      ...emptyMarkupCases.map((message) => ({ kind: 'empty' as const, draft: { message } })),
      ...payloadCases.map((draft) => ({ kind: 'payload' as const, draft })),
    ]) {
      const ref = React.createRef<AcpTurnEditorHandle>();
      act(() => {
        render(
          React.createElement(AcpTurnEditor, {
            ref,
            variant: 'queued',
            onSend: jest.fn(),
            onCancelEdit: jest.fn(),
            onImmediateSend: jest.fn(),
            setTheme: jest.fn(),
            agentId: '',
            setAgentId: jest.fn(),
            command: '',
            setCommand: jest.fn(),
          }),
          container,
        );
      });

      const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
      editor.textContent = 'history seed';
      await act(async () => {
        dispatchEditorKey(editor, { key: 'Enter' });
        await Promise.resolve();
        await Promise.resolve();
      });
      act(() => {
        ref.current!.restoreDraft!(target.draft);
      });
      if (target.kind === 'empty') {
        editor.innerHTML = target.draft.message;
      }

      act(() => {
        dispatchEditorKey(editor, { key: 'ArrowUp' });
      });

      if (target.kind === 'empty') {
        expect(editor.textContent).toContain('history seed');
      } else {
        expect(ref.current!.getDraft()).toEqual({
          message: target.draft.message,
          images: target.draft.images || [],
          agentId: target.draft.agentId || '',
          command: target.draft.command || '',
        });
      }

      act(() => {
        unmountComponentAtNode(container);
      });
    }
  });

  it('hides queued Mode controls when there are no config options', () => {
    act(() => {
      render(
        React.createElement(AcpTurnEditor, {
          variant: 'queued',
          onSend: jest.fn(),
          onCancelEdit: jest.fn(),
          onImmediateSend: jest.fn(),
          setTheme: jest.fn(),
          agentId: '',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
          agentModes: [
            { id: 'mode-1', name: 'Mode 1' },
            { id: 'mode-2', name: 'Mode 2' },
          ],
        }),
        container,
      );
    });

    const input = container.querySelector('[data-testid="acp-mention-input"]') as HTMLTextAreaElement;
    expect(input.dataset.modeOptionCount).toBe('0');
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

  it('does not forward whitespace-only contenteditable submits', async () => {
    const onSend = jest.fn();

    act(() => {
      render(
        React.createElement(AcpChatMentionInput, {
          onSend,
          setTheme: jest.fn(),
          agentId: '',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
        } as any),
        container,
      );
    });

    await act(async () => {
      (container.querySelector('[data-testid="acp-mention-send-whitespace"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not forward contenteditable blank markup submits', async () => {
    const onSend = jest.fn();

    act(() => {
      render(
        React.createElement(AcpChatMentionInput, {
          onSend,
          setTheme: jest.fn(),
          agentId: '',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
        } as any),
        container,
      );
    });

    await act(async () => {
      (container.querySelector('[data-testid="acp-mention-send-empty-html"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('keeps command-only contenteditable submits valid', async () => {
    const onSend = jest.fn();

    act(() => {
      render(
        React.createElement(AcpChatMentionInput, {
          onSend,
          setTheme: jest.fn(),
          agentId: 'default-agent',
          setAgentId: jest.fn(),
          command: 'generate',
          setCommand: jest.fn(),
        } as any),
        container,
      );
    });

    await act(async () => {
      (container.querySelector('[data-testid="acp-mention-send-whitespace"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(onSend).toHaveBeenCalledWith('   \n\t  ', [], 'default-agent', 'generate', { model: 'mock-model' });
  });

  it('returns the parent send promise to the contenteditable MentionInput', async () => {
    let resolveSend!: () => void;
    const sendResult = new Promise<void>((resolve) => {
      resolveSend = resolve;
    });
    const onSend = jest.fn(() => sendResult);

    act(() => {
      render(
        React.createElement(AcpChatMentionInput, {
          onSend,
          setTheme: jest.fn(),
          agentId: 'default-agent',
          setAgentId: jest.fn(),
          command: '',
          setCommand: jest.fn(),
        } as any),
        container,
      );
    });

    let wrapperSendSettled = false;
    const wrapperSendResult = mockMentionInputOnSend?.('hello', { model: 'mock-model' }) as Promise<void>;
    void wrapperSendResult.then(() => {
      wrapperSendSettled = true;
    });

    await Promise.resolve();

    expect(onSend).toHaveBeenCalledWith('hello', [], 'default-agent', '', { model: 'mock-model' });
    expect(wrapperSendSettled).toBe(false);

    resolveSend();
    await wrapperSendResult;

    expect(wrapperSendSettled).toBe(true);
  });
});

describe('MentionInput serialized content handle', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue(createMockService());
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
  });

  it('restores only recognized mention tokens as safe DOM nodes', () => {
    const ref = React.createRef<MentionInputHandle>();
    const maliciousPath = '/workspace/<img src=x onerror=alert(1)>.js';
    const serialized = [
      `{{@file:${maliciousPath}}}`,
      '{{@folder:/workspace/src}}',
      '{{@code:/workspace/editor.js#L1-L2}}',
      '{{@rule:/workspace/project.mdc}}',
    ].join(' ');

    act(() => {
      root.render(
        React.createElement(ActualMentionInput, {
          ref,
          footerConfig: { buttons: [], showModelSelector: false },
        } as any),
      );
    });

    act(() => {
      ref.current!.restoreSerializedContent(serialized);
    });

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    const mentionTags = Array.from(editor.querySelectorAll('[data-context-id]')) as HTMLSpanElement[];
    expect(mentionTags.map((tag) => tag.dataset.type)).toEqual(['file', 'folder', 'code', 'rule']);
    expect(mentionTags[0].dataset.contextId).toBe(maliciousPath);
    expect(mentionTags[0].textContent).toBe(maliciousPath);
    expect(editor.querySelector('img')).toBeNull();
  });

  it('keeps unrecognized serialized tokens as plain text', () => {
    const ref = React.createRef<MentionInputHandle>();
    const serialized = 'before {{@agent:<img src=x onerror=alert(1)>}} after';

    act(() => {
      root.render(
        React.createElement(ActualMentionInput, {
          ref,
          footerConfig: { buttons: [], showModelSelector: false },
        } as any),
      );
    });

    act(() => {
      ref.current!.restoreSerializedContent(serialized);
    });

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    expect(editor.querySelector('[data-context-id]')).toBeNull();
    expect(editor.querySelector('img')).toBeNull();
    expect(editor.textContent).toBe(serialized);
  });

  it('serializes raw text without HTML escaping and preserves mixed text-token order', () => {
    const ref = React.createRef<MentionInputHandle>();
    const serialized = 'before <img onerror=x> & {{@file:/workspace/editor.js}} after';

    act(() => {
      root.render(
        React.createElement(ActualMentionInput, {
          ref,
          footerConfig: { buttons: [], showModelSelector: false },
        } as any),
      );
    });

    act(() => {
      ref.current!.restoreSerializedContent(serialized);
    });

    expect(ref.current!.getSerializedContent()).toBe(serialized);
  });

  it('restores multiline plain text with a visible BR and round-trips exactly', () => {
    const ref = React.createRef<MentionInputHandle>();
    const serialized = 'first\nsecond';

    act(() => {
      root.render(
        React.createElement(ActualMentionInput, {
          ref,
          footerConfig: { buttons: [], showModelSelector: false },
        } as any),
      );
    });

    act(() => {
      ref.current!.restoreSerializedContent(serialized);
    });

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    expect(editor.childNodes).toHaveLength(3);
    expect(editor.childNodes[0]).toBeInstanceOf(Text);
    expect(editor.childNodes[0].textContent).toBe('first');
    expect(editor.childNodes[1]).toBeInstanceOf(HTMLBRElement);
    expect((editor.childNodes[1] as HTMLBRElement).tagName).toBe('BR');
    expect(editor.childNodes[2]).toBeInstanceOf(Text);
    expect(editor.childNodes[2].textContent).toBe('second');
    expect(ref.current!.getSerializedContent()).toBe(serialized);
  });

  it('preserves raw leading and trailing whitespace through serialize and restore', () => {
    const ref = React.createRef<MentionInputHandle>();
    const serialized = '  first\nsecond  ';

    act(() => {
      root.render(
        React.createElement(ActualMentionInput, {
          ref,
          footerConfig: { buttons: [], showModelSelector: false },
        } as any),
      );
    });

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    editor.replaceChildren(
      document.createTextNode('  first'),
      document.createElement('br'),
      document.createTextNode('second  '),
    );

    expect(ref.current!.getSerializedContent()).toBe(serialized);

    act(() => {
      ref.current!.restoreSerializedContent(serialized);
    });

    expect(ref.current!.getSerializedContent()).toBe(serialized);
  });

  it('serializes unsupported or incomplete mention tags as visible plain text', () => {
    const ref = React.createRef<MentionInputHandle>();

    act(() => {
      root.render(
        React.createElement(ActualMentionInput, {
          ref,
          footerConfig: { buttons: [], showModelSelector: false },
        } as any),
      );
    });

    act(() => {
      ref.current!.restoreSerializedContent('{{@file:/workspace/template}}');
    });

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    const mentionClassName = (editor.firstElementChild as HTMLSpanElement).className;
    const unknownMention = document.createElement('span');
    unknownMention.className = mentionClassName;
    unknownMention.dataset.type = 'unknown';
    unknownMention.dataset.contextId = '/workspace/hidden';
    unknownMention.textContent = 'visible unknown';
    const missingContextMention = document.createElement('span');
    missingContextMention.className = mentionClassName;
    missingContextMention.dataset.type = 'file';
    missingContextMention.textContent = 'visible file';
    editor.replaceChildren(
      document.createTextNode('before '),
      unknownMention,
      document.createTextNode(' between '),
      missingContextMention,
      document.createTextNode(' after'),
    );

    expect(ref.current!.getSerializedContent()).toBe('before visible unknown between visible file after');
  });

  it('keeps a malformed mention prefix as text while restoring a later valid token', () => {
    const ref = React.createRef<MentionInputHandle>();
    const serialized = '{{@file:broken {{@folder:/ok}}';

    act(() => {
      root.render(
        React.createElement(ActualMentionInput, {
          ref,
          footerConfig: { buttons: [], showModelSelector: false },
        } as any),
      );
    });

    act(() => {
      ref.current!.restoreSerializedContent(serialized);
    });

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    const mentionTags = Array.from(editor.querySelectorAll('[data-context-id]')) as HTMLSpanElement[];
    expect(mentionTags.map((tag) => [tag.dataset.type, tag.dataset.contextId])).toEqual([['folder', '/ok']]);
    expect(ref.current!.getSerializedContent()).toBe(serialized);
  });

  it('rejects empty or brace-nested context ids while preserving colons in valid ids', () => {
    const ref = React.createRef<MentionInputHandle>();
    const serialized = '{{@file:}} {{@code:/bad{nested}}} {{@rule:/workspace/config:section.mdc}}';

    act(() => {
      root.render(
        React.createElement(ActualMentionInput, {
          ref,
          footerConfig: { buttons: [], showModelSelector: false },
        } as any),
      );
    });

    act(() => {
      ref.current!.restoreSerializedContent(serialized);
    });

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
    const mentionTags = Array.from(editor.querySelectorAll('[data-context-id]')) as HTMLSpanElement[];
    expect(mentionTags.map((tag) => [tag.dataset.type, tag.dataset.contextId])).toEqual([
      ['rule', '/workspace/config:section.mdc'],
    ]);
    expect(ref.current!.getSerializedContent()).toBe(serialized);
  });
});

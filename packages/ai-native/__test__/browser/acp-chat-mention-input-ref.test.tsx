import * as React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

let mockMentionInputOnSend: ((content: string, option?: { model: string }) => unknown) | undefined;
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
        onSend,
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
        onSend?: (content: string, option?: { model: string }) => unknown;
      },
      ref: React.ForwardedRef<unknown>,
    ) => {
      const React = require('react') as typeof import('react');
      const editorRef = React.useRef<HTMLDivElement>(null);
      const [value, setValue] = React.useState(defaultInput || '');
      mockMentionInputOnSend = onSend;

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

import { AcpChatMentionInput } from '../../src/browser/acp/components/AcpChatMentionInput';
import { AcpTurnEditor } from '../../src/browser/acp/components/AcpTurnEditor';

import type { AcpTurnDraft } from '../../src/browser/chat/acp-chat-queued-turns';
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
        } as any),
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

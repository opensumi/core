import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

jest.mock('@opensumi/ide-core-browser', () => ({
  getSymbolIcon: jest.fn(() => 'symbol-icon'),
  localize: (key: string) => key,
  useInjectable: jest.fn(),
}));

jest.mock('@opensumi/ide-core-browser/lib/components', () => ({
  Icon: ({ className }: { className?: string }) => require('react').createElement('span', { className }),
  Popover: ({ children }: { children: React.ReactNode }) => require('react').createElement('div', null, children),
  PopoverPosition: { top: 'top' },
  getIcon: (name: string) => `icon-${name}`,
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
  MentionPanel: () => require('react').createElement('div', { 'data-testid': 'mention-panel' }),
}));

jest.mock('../../src/browser/components/mention-input/mention-select', () => ({
  MentionSelect: () => require('react').createElement('select'),
}));

import { MentionInput } from '../../src/browser/components/acp/MentionInput';
import { MentionInputProps } from '../../src/browser/components/mention-input/types';

type FutureMentionInputProps = Partial<MentionInputProps> & {
  onSendImmediately?: (content: string, config?: { model: string; [key: string]: any }) => void;
  onEscape?: () => void;
  onEmptyArrowUp?: () => boolean;
  onEmptySubmit?: () => void;
  onToggleExpanded?: () => void;
  onUserInput?: () => void;
};

let container: HTMLDivElement;
let root: Root;

function renderMentionInput(props: FutureMentionInputProps = {}): HTMLDivElement {
  act(() => {
    root.render(<MentionInput footerConfig={{ buttons: [], showModelSelector: false }} mentionItems={[]} {...props} />);
  });
  return container.querySelector('[contenteditable="true"]') as HTMLDivElement;
}

function keydown(editor: HTMLElement, init: KeyboardEventInit & { isComposing?: boolean }): KeyboardEvent {
  const { isComposing = false, ...eventInit } = init;
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...eventInit });
  Object.defineProperty(event, 'isComposing', { configurable: true, value: isComposing });
  act(() => editor.dispatchEvent(event));
  return event;
}

function input(editor: HTMLElement) {
  act(() => editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' })));
}

function dispatchPaste(
  editor: HTMLElement,
  data: {
    items: Array<{ kind: string; type: string; getAsFile(): File | null }>;
    text: string;
  },
) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    configurable: true,
    value: {
      items: data.items,
      getData: (type: string) => (type === 'text/plain' ? data.text : ''),
    },
  });
  act(() => editor.dispatchEvent(event));
}

async function paste(
  editor: HTMLElement,
  data: {
    items: Array<{ kind: string; type: string; getAsFile(): File | null }>;
    text: string;
  },
) {
  await act(async () => dispatchPaste(editor, data));
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function setCaret(editor: HTMLElement, offset: number) {
  const node = editor.firstChild || editor.appendChild(document.createTextNode(''));
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
}

function caretOffset(editor: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection?.rangeCount) {
    return -1;
  }
  const range = selection.getRangeAt(0);
  const beforeCaret = range.cloneRange();
  beforeCaret.selectNodeContents(editor);
  beforeCaret.setEnd(range.endContainer, range.endOffset);
  return beforeCaret.toString().length;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  jest.requireMock('@opensumi/ide-core-browser').useInjectable.mockReturnValue({
    getItems: jest.fn(() => []),
    onDidChange: jest.fn(() => ({ dispose: jest.fn() })),
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.getSelection()?.removeAllRanges();
  jest.clearAllMocks();
});

it('orders Immediate Send, normal submit, native newline, and IME submit handling', () => {
  const onSend = jest.fn();
  const onSendImmediately = jest.fn();
  const editor = renderMentionInput({ onSend, onSendImmediately });

  editor.textContent = 'immediate draft';
  const immediateEvent = keydown(editor, { key: 'Enter', metaKey: true, shiftKey: true });
  expect(immediateEvent.defaultPrevented).toBe(true);
  expect(onSendImmediately).toHaveBeenCalledTimes(1);
  expect(onSend).not.toHaveBeenCalled();

  editor.textContent = 'normal draft';
  keydown(editor, { key: 'Enter' });
  expect(onSend).toHaveBeenCalledTimes(1);

  editor.textContent = 'line break';
  const newlineEvent = keydown(editor, { key: 'Enter', shiftKey: true });
  expect(newlineEvent.defaultPrevented).toBe(false);
  expect(onSend).toHaveBeenCalledTimes(1);
  expect(onSendImmediately).toHaveBeenCalledTimes(1);

  editor.textContent = 'composing normal';
  const composingNormal = keydown(editor, { key: 'Enter', isComposing: true });
  editor.textContent = 'composing immediate';
  const composingImmediate = keydown(editor, {
    key: 'Enter',
    ctrlKey: true,
    shiftKey: true,
    isComposing: true,
  });
  expect(composingNormal.defaultPrevented).toBe(false);
  expect(composingImmediate.defaultPrevented).toBe(false);
  expect(onSend).toHaveBeenCalledTimes(1);
  expect(onSendImmediately).toHaveBeenCalledTimes(1);
});

it('gives the expansion shortcut priority over transient and delegated Escape handling', () => {
  const onEscape = jest.fn();
  const onToggleExpanded = jest.fn();
  const editor = renderMentionInput({ onEscape, onToggleExpanded });

  keydown(editor, { key: '@' });
  expect(container.querySelector('[data-testid="mention-panel"]')).not.toBeNull();
  keydown(editor, { key: 'Escape', shiftKey: true, altKey: true });
  expect(onToggleExpanded).toHaveBeenCalledTimes(1);
  expect(onEscape).not.toHaveBeenCalled();
  expect(container.querySelector('[data-testid="mention-panel"]')).not.toBeNull();
});

it('closes transient UI before delegating regular Escape', () => {
  const onEscape = jest.fn();
  const editor = renderMentionInput({ onEscape });

  keydown(editor, { key: '@' });
  keydown(editor, { key: 'Escape' });
  expect(onEscape).not.toHaveBeenCalled();
  expect(container.querySelector('[data-testid="mention-panel"]')).toBeNull();

  keydown(editor, { key: 'Escape' });
  expect(onEscape).toHaveBeenCalledTimes(1);
});

it('uses empty ArrowUp take-back before history', () => {
  const onEmptyArrowUp = jest.fn(() => true);
  const editor = renderMentionInput({ onEmptyArrowUp });

  const event = keydown(editor, { key: 'ArrowUp' });
  expect(event.defaultPrevented).toBe(true);
  expect(onEmptyArrowUp).toHaveBeenCalledTimes(1);
  expect(editor.textContent).toBe('');
});

it('falls back to existing history when no Queued Turn is available', () => {
  const onEmptyArrowUp = jest.fn(() => false);
  const editor = renderMentionInput({ onEmptyArrowUp, onSend: jest.fn() });

  editor.textContent = 'history value';
  keydown(editor, { key: 'Enter' });
  keydown(editor, { key: 'ArrowUp' });
  expect(onEmptyArrowUp).toHaveBeenCalledTimes(1);
  expect(editor.textContent).toContain('history value');
});

it('uses empty Enter for the one-shot fast track', () => {
  const onEmptySubmit = jest.fn();
  const onSend = jest.fn();
  const editor = renderMentionInput({ allowEmptySubmit: true, onEmptySubmit, onSend });

  keydown(editor, { key: 'Enter' });
  expect(onEmptySubmit).toHaveBeenCalledTimes(1);
  expect(onSend).not.toHaveBeenCalled();
});

it('invalidates one-shot fast track only for a real user input event', () => {
  const onSend = jest.fn();
  const onUserInput = jest.fn();
  const editor = renderMentionInput({ onSend, onUserInput });

  editor.textContent = 'draft';
  keydown(editor, { key: 'Enter' });
  expect(onSend).toHaveBeenCalledTimes(1);
  expect(editor.textContent).toBe('');
  expect(onUserInput).not.toHaveBeenCalled();

  editor.textContent = 'edited';
  input(editor);
  expect(onUserInput).toHaveBeenCalledTimes(1);
});

it('uploads pasted images and inserts text at the current caret', async () => {
  const onImageUpload = jest.fn(async () => undefined);
  const editor = renderMentionInput({ onImageUpload });
  const image = new File(['png'], 'queued.png', { type: 'image/png' });
  editor.textContent = 'before after';
  setCaret(editor, 7);

  await paste(editor, {
    items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }],
    text: 'pasted',
  });

  expect(onImageUpload).toHaveBeenCalledWith([image]);
  expect(editor.textContent).toBe('before pastedafter');
  expect(window.getSelection()?.isCollapsed).toBe(true);
  expect(caretOffset(editor)).toBe('before pasted'.length);
});

it('inserts mixed-paste text synchronously at the originating range before a deferred upload settles', async () => {
  const upload = deferred<void>();
  const onImageUpload = jest.fn(() => upload.promise);
  const editor = renderMentionInput({ onImageUpload });
  const image = new File(['png'], 'queued.png', { type: 'image/png' });
  editor.textContent = 'before after';
  editor.focus();
  setCaret(editor, 7);

  dispatchPaste(editor, {
    items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }],
    text: 'pasted',
  });

  expect(onImageUpload).toHaveBeenCalledWith([image]);
  expect(editor.textContent).toBe('before pastedafter');
  expect(caretOffset(editor)).toBe('before pasted'.length);

  const otherEditor = document.createElement('div');
  otherEditor.contentEditable = 'true';
  otherEditor.textContent = 'other editor';
  document.body.appendChild(otherEditor);
  otherEditor.focus();
  setCaret(otherEditor, 5);

  await act(async () => {
    upload.resolve();
    await upload.promise;
    await Promise.resolve();
  });

  expect(editor.textContent).toBe('before pastedafter');
  expect(otherEditor.textContent).toBe('other editor');
  otherEditor.remove();
});

it('does not apply deferred mixed-paste text to a live selection after the originating editor unmounts', async () => {
  const upload = deferred<void>();
  const onImageUpload = jest.fn(() => upload.promise);
  const editor = renderMentionInput({ onImageUpload });
  const image = new File(['png'], 'queued.png', { type: 'image/png' });
  editor.textContent = 'origin';
  editor.focus();
  setCaret(editor, 'origin'.length);

  dispatchPaste(editor, {
    items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }],
    text: ' pasted',
  });
  expect(editor.textContent).toBe('origin\u00a0pasted');

  act(() => {
    root.render(<div data-testid='replacement' />);
  });
  const liveEditor = document.createElement('div');
  liveEditor.contentEditable = 'true';
  liveEditor.textContent = 'live editor';
  document.body.appendChild(liveEditor);
  liveEditor.focus();
  setCaret(liveEditor, 4);

  await act(async () => {
    upload.resolve();
    await upload.promise;
    await Promise.resolve();
  });

  expect(editor.textContent).toBe('origin\u00a0pasted');
  expect(liveEditor.textContent).toBe('live editor');
  liveEditor.remove();
});

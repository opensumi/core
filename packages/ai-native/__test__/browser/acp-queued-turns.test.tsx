import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { AcpQueuedTurns } from '../../src/browser/chat/AcpQueuedTurns';

import type { AcpQueuedTurnSnapshot } from '../../src/browser/chat/acp-chat-queued-turns';
import type { ChatInputCapability, QueuedTurnEditorProps } from '../../src/browser/chat/chat.input.registry';

let container: HTMLDivElement;
let root: Root;
const onResume = jest.fn();

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.clearAllMocks();
});

const baseSnapshot: AcpQueuedTurnSnapshot = {
  activeSessionId: 'acp:session-1',
  phase: 'generating',
  entries: [{ id: 'turn-1', message: 'first' }],
  canResume: false,
  canFastTrack: false,
};

const query = (selector: string) => container.querySelector(selector);
const click = (selector: string) =>
  act(() => (query(selector) as HTMLButtonElement).dispatchEvent(new MouseEvent('click', { bubbles: true })));

const QueuedEditor = ({ turn, onSave, onCancel, onImmediateSend, onReady }: QueuedTurnEditorProps) => {
  React.useEffect(() => {
    onReady?.({ focus: jest.fn() });
    return () => onReady?.(null);
  }, [onReady]);

  return (
    <div data-testid='queued-editor'>
      <span>{turn.message}</span>
      <button onClick={() => onSave({ ...turn, message: 'edited' })}>save</button>
      <button onClick={onCancel}>cancel</button>
      <button onClick={() => onImmediateSend({ ...turn, message: 'edited immediate' })}>immediate</button>
    </div>
  );
};

function renderQueue(
  overrides: Partial<AcpQueuedTurnSnapshot> & {
    capabilities?: ChatInputCapability[];
    QueuedEditor?: React.ComponentType<QueuedTurnEditorProps>;
    onToggleExpanded?: jest.Mock;
    onClear?: jest.Mock;
    onBeginEdit?: jest.Mock;
    onCommitEdit?: jest.Mock;
    onCancelEdit?: jest.Mock;
    onDelete?: jest.Mock;
    onImmediateSend?: jest.Mock;
    onEditorReady?: jest.Mock;
  } = {},
) {
  const snapshot = { ...baseSnapshot, ...overrides };
  const Editor = Object.prototype.hasOwnProperty.call(overrides, 'QueuedEditor')
    ? overrides.QueuedEditor
    : QueuedEditor;
  const handlers = {
    onToggleExpanded: overrides.onToggleExpanded || jest.fn(),
    onClear: overrides.onClear || jest.fn(),
    onBeginEdit: overrides.onBeginEdit || jest.fn(),
    onCommitEdit: overrides.onCommitEdit || jest.fn(),
    onCancelEdit: overrides.onCancelEdit || jest.fn(),
    onDelete: overrides.onDelete || jest.fn(),
    onImmediateSend: overrides.onImmediateSend || jest.fn(),
    onEditorReady: overrides.onEditorReady || jest.fn(),
  };
  act(() => {
    root.render(
      <AcpQueuedTurns
        snapshot={snapshot}
        expanded
        capabilities={overrides.capabilities || ['rich-queued-edit']}
        QueuedEditor={Editor}
        onToggleExpanded={handlers.onToggleExpanded}
        onResume={onResume}
        onClear={handlers.onClear}
        onBeginEdit={handlers.onBeginEdit}
        onCommitEdit={handlers.onCommitEdit}
        onCancelEdit={handlers.onCancelEdit}
        onDelete={handlers.onDelete}
        onImmediateSend={handlers.onImmediateSend}
        onEditorReady={handlers.onEditorReady}
      />,
    );
  });
  return handlers;
}

it('renders paused state and resumes', () => {
  renderQueue({ phase: 'paused', pauseReason: 'manual-stop', canResume: true });
  expect(query('[data-testid="acp-queued-turn-status"]')?.textContent).toContain('Paused');
  expect(query('[data-testid="acp-queued-turn-status"]')?.textContent).toContain('Stopped');
  click('[data-testid="acp-queued-turn-resume"]');
  expect(onResume).toHaveBeenCalledTimes(1);
});

it('keeps one inline editor and disables collapse while editing', () => {
  renderQueue({
    entries: [
      { id: 'turn-1', message: 'first' },
      { id: 'turn-2', message: 'second' },
    ],
    editingTurnId: 'turn-1',
    QueuedEditor,
  });
  expect(container.querySelectorAll('[data-testid="queued-editor"]')).toHaveLength(1);
  expect((query('[data-testid="acp-queued-turns-summary"]') as HTMLButtonElement).disabled).toBe(true);
  expect(query('[data-testid="acp-queued-turn-editor"]')).not.toBeNull();
});

it('hides rich edit unless the active input declares it and supplies its own editor', () => {
  renderQueue({ capabilities: ['focus'], QueuedEditor: undefined });
  expect(query('[aria-label="Edit queued turn"]')).toBeNull();
});

it('does not expose edit from capability alone without a queued editor', () => {
  renderQueue({ capabilities: ['rich-queued-edit'], QueuedEditor: undefined });
  expect(query('[aria-label="Edit queued turn"]')).toBeNull();
});

it('commits serialized Mention content and images without changing the turn id', () => {
  const onCommitEdit = jest.fn();
  const MentionEditor = ({ onSave }: QueuedTurnEditorProps) => (
    <button
      data-testid='save-mention-edit'
      onClick={() =>
        onSave({
          message: '{{@file:/workspace/editor.js}} review this',
          images: ['data:image/png;base64,queued'],
        })
      }
    >
      save mention
    </button>
  );
  renderQueue({ QueuedEditor: MentionEditor, editingTurnId: 'turn-1', onCommitEdit });
  click('[data-testid="save-mention-edit"]');
  expect(onCommitEdit).toHaveBeenCalledWith(
    'turn-1',
    {
      message: '{{@file:/workspace/editor.js}} review this',
      images: ['data:image/png;base64,queued'],
    },
    false,
  );
});

it('routes editor cancel and Immediate Send through the editing turn id', () => {
  const handlers = renderQueue({ editingTurnId: 'turn-1' });
  click('[data-testid="queued-editor"] button:nth-of-type(2)');
  expect(handlers.onCancelEdit).toHaveBeenCalledWith('turn-1');

  const immediateHandlers = renderQueue({ editingTurnId: 'turn-1' });
  click('[data-testid="queued-editor"] button:nth-of-type(3)');
  expect(immediateHandlers.onCommitEdit).toHaveBeenCalledWith(
    'turn-1',
    expect.objectContaining({ message: 'edited immediate' }),
    true,
  );
});

it('exposes stable turn actions and routes edit, delete, Immediate Send, and Clear All', () => {
  const handlers = renderQueue();
  expect(query('[data-testid="acp-queued-turn"]')).not.toBeNull();
  expect(query('[data-testid="acp-queued-turn-preview"]')?.textContent).toContain('first');

  click('[data-testid="acp-queued-turn-edit"]');
  click('[data-testid="acp-queued-turn-delete"]');
  click('[data-testid="acp-queued-turn-immediate"]');
  click('[aria-label="Clear queued turns"]');

  expect(handlers.onBeginEdit).toHaveBeenCalledWith('turn-1');
  expect(handlers.onDelete).toHaveBeenCalledWith('turn-1');
  expect(handlers.onImmediateSend).toHaveBeenCalledWith('turn-1');
  expect(handlers.onClear).toHaveBeenCalledTimes(1);
});

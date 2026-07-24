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
  initialStartPending: false,
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
    disabled?: boolean;
    onToggleExpanded?: jest.Mock;
    onClear?: jest.Mock;
    onBeginEdit?: jest.Mock;
    onCommitEdit?: jest.Mock;
    onCancelEdit?: jest.Mock;
    onDelete?: jest.Mock;
    onImmediateSend?: jest.Mock;
    onEditorReady?: jest.Mock;
    onOpenCapacitySettings?: jest.Mock;
    onCancelInitialStart?: jest.Mock;
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
        disabled={overrides.disabled}
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
        onOpenCapacitySettings={overrides.onOpenCapacitySettings}
        onCancelInitialStart={overrides.onCancelInitialStart}
      />,
    );
  });
  return handlers;
}

it('shows cancellable first-launch progress at the 300ms and 8s thresholds', () => {
  jest.useFakeTimers();
  const onCancelInitialStart = jest.fn();
  renderQueue({
    activeSessionId: undefined,
    entries: [],
    initialStartPending: true,
    onCancelInitialStart,
  });

  expect(query('[data-testid="acp-task-launch-status"]')?.textContent).toContain('Preparing task');
  expect(query('[data-testid="acp-task-launch-status"]')?.textContent).not.toContain('Starting task');
  click('[data-testid="acp-task-launch-cancel"]');
  expect(onCancelInitialStart).toHaveBeenCalledTimes(1);

  act(() => jest.advanceTimersByTime(300));
  expect(query('[data-testid="acp-task-launch-status"]')?.textContent).toContain('Starting task');

  act(() => jest.advanceTimersByTime(7700));
  expect(query('[data-testid="acp-task-launch-status"]')?.textContent).toContain('taking longer than usual');
  jest.useRealTimers();
});

it('renders paused state and resumes', () => {
  renderQueue({ phase: 'paused', pauseReason: 'manual-stop', canResume: true });
  expect(query('[data-testid="acp-queued-turn-status"]')?.textContent).toContain('Paused');
  expect(query('[data-testid="acp-queued-turn-status"]')?.textContent).toContain('Stopped');
  click('[data-testid="acp-queued-turn-resume"]');
  expect(onResume).toHaveBeenCalledTimes(1);
});

it('renders capacity exhaustion as a persistent actionable alert', () => {
  const onOpenCapacitySettings = jest.fn();
  renderQueue({
    phase: 'paused',
    pauseReason: 'start-failed',
    pauseError: {
      name: 'ACP_THREAD_POOL_SATURATED',
      message: 'ACP concurrent tasks have reached the configured limit of 2.',
      limit: 2,
    },
    canResume: true,
    onOpenCapacitySettings,
  });

  expect(query('[data-testid="acp-capacity-error"]')?.getAttribute('role')).toBe('alert');
  expect(query('[data-testid="acp-capacity-error"]')?.textContent).toContain('capacity limit (2) has been reached');
  expect(query('[data-testid="acp-capacity-error"]')?.textContent).toContain(
    'Your task draft and unsent content have been preserved',
  );
  click('[data-testid="acp-capacity-retry"]');
  click('[data-testid="acp-capacity-open-settings"]');
  expect(onResume).toHaveBeenCalledTimes(1);
  expect(onOpenCapacitySettings).toHaveBeenCalledTimes(1);
});

it.each([
  [0, '0 Queued Turns'],
  [1, '1 Queued Turn'],
  [2, '2 Queued Turns'],
  [3, '3 Queued Turns'],
])('renders the queued turn count for %i entries without an unresolved placeholder', (count, expectedTitle) => {
  renderQueue({
    entries: Array.from({ length: count }, (_, index) => ({ id: `turn-${index}`, message: `message-${index}` })),
    phase: count === 0 ? 'paused' : 'generating',
  });

  const summary = query('[data-testid="acp-queued-turns-summary"]');
  expect(summary?.textContent).toContain(expectedTitle);
  expect(summary?.textContent).not.toContain('{0}');
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

it('disables retained Immediate Send actions while an Immediate Send cancellation is settling', () => {
  const onImmediateSend = jest.fn();
  renderQueue({
    phase: 'cancelling-for-immediate',
    entries: [{ id: 'turn-2', message: 'retained' }],
    onImmediateSend,
  });

  const immediate = query('[data-testid="acp-queued-turn-immediate"]') as HTMLButtonElement;
  expect(immediate.disabled).toBe(true);
  click('[data-testid="acp-queued-turn-immediate"]');
  expect(onImmediateSend).not.toHaveBeenCalled();
});

it('disables the inline editor Immediate Send action while another cancellation is settling', () => {
  const onCommitEdit = jest.fn();
  const CancellingEditor = (props: QueuedTurnEditorProps) => (
    <button
      data-testid='queued-editor-immediate-disabled'
      disabled={props.immediateSendDisabled}
      onClick={() => props.onImmediateSend({ ...props.turn, message: 'replacement draft' })}
    >
      immediate
    </button>
  );
  renderQueue({
    phase: 'cancelling-for-immediate',
    editingTurnId: 'turn-1',
    QueuedEditor: CancellingEditor,
    onCommitEdit,
  });

  const immediate = query('[data-testid="queued-editor-immediate-disabled"]') as HTMLButtonElement;
  expect(immediate.disabled).toBe(true);
  click('[data-testid="queued-editor-immediate-disabled"]');
  expect(onCommitEdit).not.toHaveBeenCalled();
});

it('disables every queued-turn action while its session is loading', () => {
  const handlers = renderQueue({
    disabled: true,
    phase: 'paused',
    canResume: true,
  });

  const selectors = [
    '[data-testid="acp-queued-turns-summary"]',
    '[data-testid="acp-queued-turn-resume"]',
    '[aria-label="Clear queued turns"]',
    '[data-testid="acp-queued-turn-edit"]',
    '[data-testid="acp-queued-turn-delete"]',
    '[data-testid="acp-queued-turn-immediate"]',
  ];
  for (const selector of selectors) {
    expect((query(selector) as HTMLButtonElement).disabled).toBe(true);
    click(selector);
  }

  expect(onResume).not.toHaveBeenCalled();
  expect(handlers.onToggleExpanded).not.toHaveBeenCalled();
  expect(handlers.onClear).not.toHaveBeenCalled();
  expect(handlers.onBeginEdit).not.toHaveBeenCalled();
  expect(handlers.onDelete).not.toHaveBeenCalled();
  expect(handlers.onImmediateSend).not.toHaveBeenCalled();
});

it('disables queued editor mutations while its session is loading', () => {
  const DisabledAwareEditor = (props: QueuedTurnEditorProps) => (
    <>
      <button
        data-testid='queued-editor-save-disabled'
        disabled={props.disabled}
        onClick={() => props.onSave(props.turn)}
      >
        save
      </button>
      <button data-testid='queued-editor-cancel-disabled' disabled={props.disabled} onClick={props.onCancel}>
        cancel
      </button>
      <button
        data-testid='queued-editor-immediate-loading-disabled'
        disabled={props.disabled || props.immediateSendDisabled}
        onClick={() => props.onImmediateSend(props.turn)}
      >
        immediate
      </button>
    </>
  );
  const handlers = renderQueue({
    disabled: true,
    editingTurnId: 'turn-1',
    QueuedEditor: DisabledAwareEditor,
  });

  const selectors = [
    '[data-testid="queued-editor-save-disabled"]',
    '[data-testid="queued-editor-cancel-disabled"]',
    '[data-testid="queued-editor-immediate-loading-disabled"]',
  ];
  for (const selector of selectors) {
    expect((query(selector) as HTMLButtonElement).disabled).toBe(true);
    click(selector);
  }

  expect(handlers.onCommitEdit).not.toHaveBeenCalled();
  expect(handlers.onCancelEdit).not.toHaveBeenCalled();
});

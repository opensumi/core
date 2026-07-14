import * as React from 'react';

import { getIcon, localize } from '@opensumi/ide-core-browser';
import { Icon } from '@opensumi/ide-core-browser/lib/components';

import { cleanAttachedTextWrapper } from '../../common/utils';

import styles from './chat.module.less';

import type { AcpQueuedTurnSnapshot, AcpTurnDraft } from './acp-chat-queued-turns';
import type { ChatInputCapability, ChatInputHandle, QueuedTurnEditorProps } from './chat.input.registry';

export interface AcpQueuedTurnsProps {
  snapshot: AcpQueuedTurnSnapshot;
  expanded: boolean;
  capabilities: readonly ChatInputCapability[];
  QueuedEditor?: React.ComponentType<QueuedTurnEditorProps>;
  onToggleExpanded(): void;
  onResume(): void;
  onClear(): void;
  onBeginEdit(id: string): void;
  onCommitEdit(id: string, draft: AcpTurnDraft, immediate: boolean): void;
  onCancelEdit(id: string): void;
  onDelete(id: string): void;
  onImmediateSend(id: string): void;
  onEditorReady(handle: ChatInputHandle | null): void;
}

export function getAcpQueuedTurnPreview(message: string): string {
  const preview = cleanAttachedTextWrapper(message)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(div|p|li|section)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

  return preview || localize('aiNative.chat.queue.emptyPreview', 'Empty message');
}

function getPauseReasonLabel(reason: AcpQueuedTurnSnapshot['pauseReason']): string | undefined {
  switch (reason) {
    case 'manual-stop':
      return localize('aiNative.chat.queue.pauseReason.manualStop', 'Stopped');
    case 'agent-error':
      return localize('aiNative.chat.queue.pauseReason.agentError', 'Agent error');
    case 'start-failed':
      return localize('aiNative.chat.queue.pauseReason.startFailed', 'Could not start');
    case 'cancel-failed':
      return localize('aiNative.chat.queue.pauseReason.cancelFailed', 'Could not stop');
    default:
      return undefined;
  }
}

export const AcpQueuedTurns = ({
  snapshot,
  expanded,
  capabilities,
  QueuedEditor,
  onToggleExpanded,
  onResume,
  onClear,
  onBeginEdit,
  onCommitEdit,
  onCancelEdit,
  onDelete,
  onImmediateSend,
  onEditorReady,
}: AcpQueuedTurnsProps) => {
  if (snapshot.entries.length === 0 && snapshot.phase !== 'paused') {
    return null;
  }

  const canRichEdit = capabilities.includes('rich-queued-edit') && Boolean(QueuedEditor);
  const isEditing = Boolean(snapshot.editingTurnId);
  const title =
    snapshot.entries.length === 1
      ? localize('aiNative.chat.queue.one', '1 Queued Turn')
      : localize('aiNative.chat.queue.many', '{0} Queued Turns', String(snapshot.entries.length));
  const pauseReason = getPauseReasonLabel(snapshot.pauseReason);

  return (
    <section className={styles.queued_turns} aria-label={localize('aiNative.chat.queue.ariaLabel', 'Queued turns')}>
      <div className={styles.queued_turns_header}>
        <button
          aria-expanded={expanded}
          aria-label={localize('aiNative.chat.queue.toggleAriaLabel', 'Toggle queued turns')}
          className={styles.queued_turns_summary}
          data-testid='acp-queued-turns-summary'
          disabled={isEditing}
          onClick={onToggleExpanded}
          title={
            isEditing
              ? localize('aiNative.chat.queue.finishEditBeforeCollapse', 'Finish editing before collapsing')
              : undefined
          }
          type='button'
        >
          <Icon
            className={styles.queued_turns_disclosure}
            iconClass={getIcon(expanded ? 'arrow-down' : 'arrow-right')}
          />
          <span>{title}</span>
        </button>
        <div className={styles.queued_turns_header_actions}>
          {snapshot.phase === 'paused' && (
            <div className={styles.queued_turns_status} data-testid='acp-queued-turn-status' role='status'>
              <span>{localize('aiNative.chat.queue.paused', 'Paused')}</span>
              {pauseReason && <span className={styles.queued_turns_pause_reason}>{pauseReason}</span>}
              {snapshot.canResume && (
                <button
                  aria-label={localize('aiNative.chat.queue.resumeAriaLabel', 'Resume queued turns')}
                  className={styles.queued_turns_resume}
                  data-testid='acp-queued-turn-resume'
                  onClick={onResume}
                  type='button'
                >
                  {localize('aiNative.chat.queue.resume', 'Resume Queue')}
                </button>
              )}
            </div>
          )}
          {snapshot.entries.length > 0 && (
            <button
              aria-label={localize('aiNative.chat.queue.clearAriaLabel', 'Clear queued turns')}
              className={styles.queued_turns_clear}
              onClick={onClear}
              type='button'
            >
              {localize('aiNative.chat.queue.clearAll', 'Clear All')}
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className={styles.queued_turns_list}>
          {snapshot.entries.map((turn, index) => {
            const editing = canRichEdit && snapshot.editingTurnId === turn.id;
            return (
              <div
                className={editing ? styles.queued_turn_editing : styles.queued_turn}
                data-testid='acp-queued-turn'
                key={turn.id}
              >
                {editing && QueuedEditor ? (
                  <div className={styles.queued_turn_editor} data-testid='acp-queued-turn-editor'>
                    <QueuedEditor
                      turn={turn}
                      onSave={(draft) => onCommitEdit(turn.id, draft, false)}
                      onCancel={() => onCancelEdit(turn.id)}
                      onImmediateSend={(draft) => onCommitEdit(turn.id, draft, true)}
                      onReady={onEditorReady}
                      immediateSendDisabled={snapshot.phase === 'cancelling-for-immediate'}
                    />
                  </div>
                ) : (
                  <>
                    <div className={styles.queued_turn_index}>{index + 1}</div>
                    <div className={styles.queued_turn_preview} data-testid='acp-queued-turn-preview'>
                      {getAcpQueuedTurnPreview(turn.message)}
                    </div>
                    <div className={styles.queued_turn_actions}>
                      {canRichEdit && (
                        <button
                          aria-label={localize('aiNative.chat.queue.editAriaLabel', 'Edit queued turn')}
                          data-testid='acp-queued-turn-edit'
                          onClick={() => onBeginEdit(turn.id)}
                          type='button'
                        >
                          {localize('aiNative.chat.queue.edit', 'Edit')}
                        </button>
                      )}
                      <button
                        aria-label={localize('aiNative.chat.queue.deleteAriaLabel', 'Delete queued turn')}
                        data-testid='acp-queued-turn-delete'
                        onClick={() => onDelete(turn.id)}
                        type='button'
                      >
                        {localize('aiNative.chat.queue.delete', 'Delete')}
                      </button>
                      <button
                        aria-label={localize('aiNative.chat.queue.immediateAriaLabel', 'Send queued turn immediately')}
                        data-testid='acp-queued-turn-immediate'
                        disabled={snapshot.phase === 'cancelling-for-immediate'}
                        onClick={() => onImmediateSend(turn.id)}
                        type='button'
                      >
                        {localize('aiNative.chat.queue.immediate', 'Immediate Send')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

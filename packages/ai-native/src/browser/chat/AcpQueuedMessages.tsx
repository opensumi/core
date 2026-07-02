import * as React from 'react';

import { localize } from '@opensumi/ide-core-common';

import { cleanAttachedTextWrapper } from '../../common/utils';

import styles from './chat.module.less';

import type { AcpQueuedMessage } from './acp-chat-queued-messages';

export interface AcpQueuedMessagesProps {
  entries: AcpQueuedMessage[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onClear: () => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onSendNow: (id: string) => void;
}

export function getAcpQueuedMessagePreview(message: string): string {
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

export const AcpQueuedMessages = ({
  entries,
  expanded,
  onToggleExpanded,
  onClear,
  onDelete,
  onEdit,
  onSendNow,
}: AcpQueuedMessagesProps) => {
  if (entries.length === 0) {
    return null;
  }

  const title =
    entries.length === 1
      ? localize('aiNative.chat.queue.one', '1 Queued Message')
      : localize('aiNative.chat.queue.many', '{0} Queued Messages', String(entries.length));

  return (
    <div className={styles.queued_messages}>
      <div className={styles.queued_messages_header}>
        <button
          className={styles.queued_messages_summary}
          data-testid='acp-queued-messages-summary'
          onClick={onToggleExpanded}
          type='button'
        >
          <span className={styles.queued_messages_disclosure}>{expanded ? 'v' : '>'}</span>
          <span>{title}</span>
        </button>
        <button className={styles.queued_messages_clear} onClick={onClear} type='button'>
          {localize('aiNative.chat.queue.clearAll', 'Clear All')}
        </button>
      </div>
      {expanded && (
        <div className={styles.queued_messages_list}>
          {entries.map((entry, index) => (
            <div className={styles.queued_message_item} data-testid='acp-queued-message' key={entry.id}>
              <div className={styles.queued_message_index}>{index + 1}</div>
              <div className={styles.queued_message_preview} data-testid='acp-queued-message-preview'>
                {getAcpQueuedMessagePreview(entry.message)}
              </div>
              <div className={styles.queued_message_actions}>
                <button onClick={() => onEdit(entry.id)} type='button'>
                  {localize('aiNative.chat.queue.edit', 'Edit')}
                </button>
                <button onClick={() => onDelete(entry.id)} type='button'>
                  {localize('aiNative.chat.queue.delete', 'Delete')}
                </button>
                <button onClick={() => onSendNow(entry.id)} type='button'>
                  {localize('aiNative.chat.queue.sendNow', 'Send Now')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

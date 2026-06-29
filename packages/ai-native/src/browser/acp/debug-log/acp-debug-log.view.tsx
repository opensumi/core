import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { AIBackSerivcePath, AcpDebugLogEntry, IAIBackService, IClipboardService } from '@opensumi/ide-core-common';
import { IMessageService } from '@opensumi/ide-overlay';

import styles from './acp-debug-log.module.less';

function formatEntry(entry: AcpDebugLogEntry): string {
  const timestamp = new Date(entry.timestamp).toISOString();
  const session = entry.sessionId ? ` session=${entry.sessionId}` : '';
  const payload = entry.payload ? `\n${JSON.stringify(entry.payload, null, 2)}` : '';
  return `[${timestamp}] [${entry.direction}] agent=${entry.agentId} thread=${entry.threadId}${session}\n${entry.raw}${payload}`;
}

export const AcpDebugLogView: React.FC = () => {
  const aiBackService = useInjectable<IAIBackService>(AIBackSerivcePath);
  const clipboardService = useInjectable<IClipboardService>(IClipboardService);
  const messageService = useInjectable<IMessageService>(IMessageService);
  const [entries, setEntries] = useState<AcpDebugLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!aiBackService.getAcpDebugLog) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      setEntries(await aiBackService.getAcpDebugLog());
    } catch (error) {
      messageService.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [aiBackService, messageService]);

  const handleClear = useCallback(async () => {
    if (!aiBackService.clearAcpDebugLog) {
      return;
    }
    await aiBackService.clearAcpDebugLog();
    setEntries([]);
  }, [aiBackService]);

  const renderedLog = useMemo(() => entries.map(formatEntry).join('\n\n'), [entries]);

  const handleCopyAll = useCallback(async () => {
    await clipboardService.writeText(renderedLog);
  }, [clipboardService, renderedLog]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>ACP Debug Log</h2>
          <p className={styles.description}>Recent ACP protocol messages and stderr output.</p>
        </div>
        <div className={styles.actions}>
          <button type='button' onClick={refresh} disabled={loading}>
            Refresh
          </button>
          <button type='button' onClick={handleClear}>
            Clear
          </button>
          <button type='button' onClick={handleCopyAll} disabled={!entries.length}>
            Copy All
          </button>
        </div>
      </div>
      {entries.length === 0 ? (
        <div className={styles.empty}>No ACP debug log entries yet.</div>
      ) : (
        <pre className={styles.log}>{renderedLog}</pre>
      )}
    </div>
  );
};

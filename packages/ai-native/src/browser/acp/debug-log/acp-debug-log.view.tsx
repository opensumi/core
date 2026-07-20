import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { AIBackSerivcePath, AcpDebugLogEntry, IAIBackService, IClipboardService } from '@opensumi/ide-core-common';
import { IMessageService } from '@opensumi/ide-overlay';

import styles from './acp-debug-log.module.less';

const REDACTED_VALUE = '<redacted>';
const SENSITIVE_FIELD =
  /^(?:authorization|proxyAuthorization|api[-_]?key|access[-_]?token|refresh[-_]?token|token|secret|password|prompt|content|text|rawInput|rawOutput|permission(?:Request|Prompt|Content|Body)?|relayDigest|digest(?:Body|Content|Text|Payload))$/i;

function redactString(value: string): string {
  return value
    .replace(/\/mcp\/[a-f0-9]{16,}/gi, '/mcp/<redacted>')
    .replace(/([?&](?:clientId|token|access_token)=)[^&#\s"']+/gi, `$1${REDACTED_VALUE}`)
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, `Bearer ${REDACTED_VALUE}`)
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, REDACTED_VALUE)
    .replace(
      /\b(api[-_]?key|access[-_]?token|refresh[-_]?token|token|secret|password|prompt|content|text|rawInput|rawOutput|permission|relayDigest|digest(?:Body|Content|Text|Payload))\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,}]+)/gi,
      `$1=${REDACTED_VALUE}`,
    );
}

function redactValue(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_FIELD.test(key)) {
    return REDACTED_VALUE;
  }
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const redactParams =
      typeof source.method === 'string' &&
      /(?:request_permission|permission_request|post_prepared_relay|prepare_session_digest)/i.test(source.method);
    return Object.fromEntries(
      Object.entries(source).map(([entryKey, entryValue]) => [
        entryKey,
        redactParams && entryKey === 'params' ? REDACTED_VALUE : redactValue(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

function redactRaw(raw: string): string {
  try {
    return JSON.stringify(redactValue(JSON.parse(raw)));
  } catch (_error) {
    return redactString(raw);
  }
}

function formatEntry(entry: AcpDebugLogEntry): string {
  const timestamp = new Date(entry.timestamp).toISOString();
  const session = entry.sessionId ? ` session=${entry.sessionId}` : '';
  const payload = entry.payload ? `\n${JSON.stringify(redactValue(entry.payload), null, 2)}` : '';
  return `[${timestamp}] [${entry.direction}] agent=${entry.agentId} thread=${entry.threadId}${session}\n${redactRaw(
    entry.raw,
  )}${payload}`;
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
          <p className={styles.description}>
            Recent ACP protocol messages and stderr output. Sensitive content is redacted.
          </p>
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

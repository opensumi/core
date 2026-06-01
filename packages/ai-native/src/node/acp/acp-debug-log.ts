import type { AcpDebugLogDirection, AcpDebugLogEntry } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

const MAX_ACP_DEBUG_LOG_ENTRIES = 2000;

export interface AcpDebugLogRecordInput {
  direction: AcpDebugLogDirection;
  agentId: string;
  threadId: string;
  sessionId?: string;
  raw: string;
  payload?: unknown;
}

export class AcpDebugLogStore {
  private entries: AcpDebugLogEntry[] = [];
  private nextId = 1;
  private threadSessionIds = new Map<string, string>();

  record(input: AcpDebugLogRecordInput): AcpDebugLogEntry {
    const raw = input.raw.trimEnd();
    const entry: AcpDebugLogEntry = {
      id: this.nextId++,
      timestamp: Date.now(),
      direction: input.direction,
      agentId: input.agentId,
      threadId: input.threadId,
      sessionId: input.sessionId ?? this.threadSessionIds.get(input.threadId),
      raw,
      payload: input.payload !== undefined ? input.payload : this.tryParsePayload(raw),
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_ACP_DEBUG_LOG_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ACP_DEBUG_LOG_ENTRIES);
    }
    return this.clone(entry);
  }

  createLineRecorder(context: Omit<AcpDebugLogRecordInput, 'raw'>): (chunk: Uint8Array | Buffer | string) => void {
    let buffer = '';
    return (chunk) => {
      buffer += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.length === 0) {
          continue;
        }
        this.record({ ...context, raw: line });
      }
    };
  }

  setThreadSessionId(threadId: string, sessionId: string): void {
    this.threadSessionIds.set(threadId, sessionId);
    for (const entry of this.entries) {
      if (entry.threadId === threadId && !entry.sessionId) {
        entry.sessionId = sessionId;
      }
    }
  }

  getEntries(): AcpDebugLogEntry[] {
    return this.entries.map((entry) => this.clone(entry));
  }

  clear(): void {
    this.entries = [];
    this.nextId = 1;
  }

  private tryParsePayload(raw: string): unknown | undefined {
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  private clone(entry: AcpDebugLogEntry): AcpDebugLogEntry {
    return JSON.parse(JSON.stringify(entry));
  }
}

export const acpDebugLogStore = new AcpDebugLogStore();

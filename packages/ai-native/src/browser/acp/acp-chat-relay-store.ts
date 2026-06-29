import { Injectable } from '@opensumi/di';
import { uuid } from '@opensumi/ide-core-common';

export interface AcpChatRelayRecord {
  digestId: string;
  sourceSessionId: string;
  sourceTitle: string;
  digestSource: 'memory_summary' | 'background_summary' | 'empty';
  digest: string;
  sourceChars: number;
  digestChars: number;
  sourceTruncated: boolean;
  createdAt: number;
  expiresAt: number;
}

export interface AcpChatRelayPutOptions {
  sourceSessionId: string;
  sourceTitle: string;
  digestSource: AcpChatRelayRecord['digestSource'];
  digest: string;
  sourceChars: number;
  digestChars: number;
  sourceTruncated: boolean;
  ttlMs?: number;
}

const DEFAULT_RELAY_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AcpChatRelayStore {
  private readonly records = new Map<string, AcpChatRelayRecord>();

  put(options: AcpChatRelayPutOptions): AcpChatRelayRecord {
    this.cleanup();
    const now = Date.now();
    const record: AcpChatRelayRecord = {
      digestId: uuid(12),
      sourceSessionId: options.sourceSessionId,
      sourceTitle: options.sourceTitle,
      digestSource: options.digestSource,
      digest: options.digest,
      sourceChars: options.sourceChars,
      digestChars: options.digestChars,
      sourceTruncated: options.sourceTruncated,
      createdAt: now,
      expiresAt: now + (options.ttlMs ?? DEFAULT_RELAY_TTL_MS),
    };
    this.records.set(record.digestId, record);
    return record;
  }

  get(digestId: string): AcpChatRelayRecord | undefined {
    this.cleanup();
    return this.records.get(digestId);
  }

  delete(digestId: string): void {
    this.records.delete(digestId);
  }

  private cleanup(now = Date.now()): void {
    for (const [digestId, record] of this.records) {
      if (record.expiresAt <= now) {
        this.records.delete(digestId);
      }
    }
  }
}

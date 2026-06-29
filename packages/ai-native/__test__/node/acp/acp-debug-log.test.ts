import { AcpDebugLogStore } from '../../../src/node/acp/acp-debug-log';

describe('AcpDebugLogStore', () => {
  it('records outgoing, incoming, and stderr lines with parsed payloads', () => {
    const store = new AcpDebugLogStore();
    const outgoing = store.createLineRecorder({ direction: 'outgoing', agentId: 'agent', threadId: 'thread' });
    const incoming = store.createLineRecorder({ direction: 'incoming', agentId: 'agent', threadId: 'thread' });
    const stderr = store.createLineRecorder({ direction: 'stderr', agentId: 'agent', threadId: 'thread' });

    outgoing(Buffer.from('{"method":"initialize"}\n'));
    incoming(Buffer.from('{"result":{"ok":true}}\n'));
    stderr(Buffer.from('warning\n'));

    const entries = store.getEntries();
    expect(entries.map((entry) => entry.direction)).toEqual(['outgoing', 'incoming', 'stderr']);
    expect(entries[0].payload).toEqual({ method: 'initialize' });
    expect(entries[1].payload).toEqual({ result: { ok: true } });
    expect(entries[2].raw).toBe('warning');
  });

  it('keeps the latest 2000 entries', () => {
    const store = new AcpDebugLogStore();
    for (let i = 0; i < 2005; i++) {
      store.record({
        direction: 'system',
        agentId: 'agent',
        threadId: 'thread',
        raw: `line-${i}`,
      });
    }

    const entries = store.getEntries();
    expect(entries).toHaveLength(2000);
    expect(entries[0].raw).toBe('line-5');
    expect(entries[1999].raw).toBe('line-2004');
  });

  it('clears entries and can backfill session ids for existing thread entries', () => {
    const store = new AcpDebugLogStore();
    store.record({ direction: 'system', agentId: 'agent', threadId: 'thread', raw: 'before session' });
    store.setThreadSessionId('thread', 'sess-1');
    store.record({ direction: 'system', agentId: 'agent', threadId: 'thread', raw: 'after session' });

    expect(store.getEntries().map((entry) => entry.sessionId)).toEqual(['sess-1', 'sess-1']);

    store.clear();
    expect(store.getEntries()).toEqual([]);

    store.record({ direction: 'system', agentId: 'agent', threadId: 'thread', raw: 'after clear' });
    expect(store.getEntries()[0].sessionId).toBe('sess-1');
  });
});

import { Deferred } from '@opensumi/ide-core-common';

import {
  AcpQueuedTurnModule,
  AcpQueuedTurnPort,
  AcpTurnDraft,
  AcpTurnHandle,
  AcpTurnOutcome,
} from '../../../src/browser/chat/acp-chat-queued-turns';

class ControlledTurnPort implements AcpQueuedTurnPort {
  readonly starts: Array<{ sessionId?: string; draft: AcpTurnDraft; completion: Deferred<AcpTurnOutcome> }> = [];
  status: 'idle' | 'generating' = 'idle';

  getStatus() {
    return this.status;
  }

  async start(sessionId: string | undefined, draft: AcpTurnDraft): Promise<AcpTurnHandle> {
    const completion = new Deferred<AcpTurnOutcome>();
    this.status = 'generating';
    const id = `delivery-${this.starts.length + 1}`;
    this.starts.push({ sessionId, draft, completion });
    return { id, sessionId: sessionId || 'acp:created-session', outcome: completion.promise };
  }

  async cancelCurrent(): Promise<void> {
    this.status = 'idle';
  }

  complete(index: number, outcome: AcpTurnOutcome = 'completed') {
    this.status = 'idle';
    this.starts[index].completion.resolve(outcome);
  }
}

class ControlledStartTurnPort extends ControlledTurnPort {
  readonly startRequested = new Deferred<void>();
  readonly releaseStart = new Deferred<void>();

  override async start(sessionId: string | undefined, draft: AcpTurnDraft): Promise<AcpTurnHandle> {
    this.startRequested.resolve();
    await this.releaseStart.promise;
    return super.start(sessionId, draft);
  }
}

describe('AcpQueuedTurnModule', () => {
  it('rejects a draft without a sendable ACP payload', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);

    await expect(turns.submit({ message: '  \n\t ' })).resolves.toEqual({
      accepted: false,
      reason: 'empty-content',
    });
    expect(port.starts).toEqual([]);
  });

  it('starts an idle draft and queues later drafts in FIFO order', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');

    await turns.submit({ message: 'first' });
    await turns.submit({ message: 'second' });
    await turns.submit({ message: 'third' });

    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['first']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['second', 'third']);

    port.complete(0);
    await turns.whenSettled();

    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['first', 'second']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['third']);
  });

  it('clears queued work and ignores an old completion after Active Session changes', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'old queued' });

    turns.activate('acp:session-2');
    port.complete(0);
    await turns.whenSettled();

    expect(turns.snapshot.activeSessionId).toBe('acp:session-2');
    expect(turns.snapshot.entries).toEqual([]);
    expect(port.starts).toHaveLength(1);
  });

  it('adopts the session id returned by the first draft send without treating it as a switch', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate(undefined);
    await turns.submit({ message: 'create the session' });
    expect(turns.snapshot.activeSessionId).toBe('acp:created-session');
  });

  it('treats a matching activation during the first start as draft session promotion', async () => {
    const port = new ControlledStartTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate(undefined);

    const submitResult = turns.submit({ message: 'create the session' });
    await port.startRequested.promise;
    turns.activate('acp:created-session');
    port.releaseStart.resolve();

    await expect(submitResult).resolves.toEqual({ accepted: true, outcome: 'started' });
    expect(turns.snapshot.activeSessionId).toBe('acp:created-session');
  });

  it('rejects the first start when a different session activates before it returns', async () => {
    const port = new ControlledStartTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate(undefined);

    const submitResult = turns.submit({ message: 'create the session' });
    await port.startRequested.promise;
    turns.activate('acp:other-session');
    port.releaseStart.resolve();

    await expect(submitResult).resolves.toEqual({ accepted: false, reason: 'stale-session' });
    expect(turns.snapshot.activeSessionId).toBe('acp:other-session');
    expect(turns.snapshot.entries).toEqual([]);
  });
});

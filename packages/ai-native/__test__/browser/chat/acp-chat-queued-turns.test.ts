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

  reject(index: number, error: Error = new Error('turn failed')) {
    this.status = 'idle';
    this.starts[index].completion.reject(error);
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

class RejectingStartTurnPort extends ControlledTurnPort {
  readonly attempts: Array<{ sessionId?: string; draft: AcpTurnDraft }> = [];

  override async start(sessionId: string | undefined, draft: AcpTurnDraft): Promise<AcpTurnHandle> {
    this.attempts.push({ sessionId, draft });
    throw new Error('start failed');
  }
}

describe('AcpQueuedTurnModule', () => {
  it('rejects an Active Session turn without a sendable ACP payload', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);

    await expect(turns.submit({ message: '  \n\t ' })).resolves.toEqual({
      accepted: false,
      reason: 'empty-content',
    });
    expect(port.starts).toEqual([]);
  });

  it('starts an idle Active Session turn and queues later Queued Turns in FIFO order', async () => {
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

  it('clears Queued Turns and ignores an old completion after Active Session changes', async () => {
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

  it('adopts the Active Session ID returned by the first turn without treating it as a switch', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate(undefined);
    await turns.submit({ message: 'create the session' });
    expect(turns.snapshot.activeSessionId).toBe('acp:created-session');
  });

  it('treats a matching activation during the first start as Active Session promotion', async () => {
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

  it('rejects the first start when a different Active Session activates before it returns', async () => {
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

  it('rejects the first start when a pending Active Session promotion is cleared before start returns', async () => {
    const port = new ControlledStartTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate(undefined);

    const submitResult = turns.submit({ message: 'create the session' });
    await port.startRequested.promise;
    turns.activate('acp:created-session');
    turns.activate(undefined);
    port.releaseStart.resolve();

    await expect(submitResult).resolves.toEqual({ accepted: false, reason: 'stale-session' });
    expect(turns.snapshot.activeSessionId).toBeUndefined();
    expect(turns.snapshot.entries).toEqual([]);
  });

  it('preserves start-failed pause state and appends submissions behind the failed Queued Turn', async () => {
    const port = new RejectingStartTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');

    await expect(turns.submit({ message: 'failed first' })).resolves.toEqual({
      accepted: false,
      reason: 'start-failed',
    });
    expect(turns.snapshot).toMatchObject({
      phase: 'paused',
      pauseReason: 'start-failed',
      canResume: true,
    });

    await expect(turns.submit({ message: 'queued later' })).resolves.toEqual({ accepted: true, outcome: 'queued' });

    expect(port.attempts.map(({ draft }) => draft.message)).toEqual(['failed first']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['failed first', 'queued later']);
    expect(turns.snapshot.phase).toBe('paused');
    expect(turns.snapshot.pauseReason).toBe('start-failed');
  });

  it('keeps manual-stop paused and appends new Queued Turns in FIFO order', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'already queued' });

    port.complete(0, 'manual-stop');
    await turns.whenSettled();
    await expect(turns.submit({ message: 'queued while paused' })).resolves.toEqual({
      accepted: true,
      outcome: 'queued',
    });

    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['already queued', 'queued while paused']);
    expect(turns.snapshot.phase).toBe('paused');
    expect(turns.snapshot.pauseReason).toBe('manual-stop');
  });

  it('pauses Queued Turns after an agent-error outcome', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'queued' });

    port.complete(0, 'agent-error');
    await turns.whenSettled();

    expect(port.starts).toHaveLength(1);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['queued']);
    expect(turns.snapshot).toMatchObject({ phase: 'paused', pauseReason: 'agent-error', canResume: true });
  });

  it('treats a rejected outcome promise as an agent error and keeps Queued Turns paused', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'queued' });

    port.reject(0);
    await turns.whenSettled();

    expect(port.starts).toHaveLength(1);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['queued']);
    expect(turns.snapshot).toMatchObject({ phase: 'paused', pauseReason: 'agent-error', canResume: true });
  });
});

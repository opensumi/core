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
  readonly cancellations: Array<string | undefined> = [];
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

  async cancelCurrent(sessionId: string | undefined): Promise<void> {
    this.cancellations.push(sessionId);
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

class RejectingNextStartTurnPort extends ControlledTurnPort {
  readonly failedStarts: AcpTurnDraft[] = [];
  failNextStart = false;

  override async start(sessionId: string | undefined, draft: AcpTurnDraft): Promise<AcpTurnHandle> {
    if (this.failNextStart) {
      this.failNextStart = false;
      this.failedStarts.push(draft);
      throw new Error('start failed');
    }
    return super.start(sessionId, draft);
  }
}

class DeferredFirstCancelTurnPort extends ControlledTurnPort {
  readonly cancelRequested = new Deferred<void>();
  readonly releaseCancel = new Deferred<void>();
  private shouldDeferCancel = true;

  override async cancelCurrent(sessionId: string | undefined): Promise<void> {
    this.cancellations.push(sessionId);
    if (this.shouldDeferCancel) {
      this.shouldDeferCancel = false;
      this.cancelRequested.resolve();
      await this.releaseCancel.promise;
    }
    this.status = 'idle';
  }
}

class DeferredNextStartTurnPort extends ControlledTurnPort {
  readonly startRequested = new Deferred<void>();
  readonly releaseStart = new Deferred<void>();
  deferNextStart = false;

  override async start(sessionId: string | undefined, draft: AcpTurnDraft): Promise<AcpTurnHandle> {
    if (this.deferNextStart) {
      this.deferNextStart = false;
      this.startRequested.resolve();
      await this.releaseStart.promise;
    }
    return super.start(sessionId, draft);
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

  it('rejects a serialized submit that migrated to a different Active Session before execution', async () => {
    const port = new ControlledStartTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');

    const first = turns.submit({ message: 'starting in session 1' });
    await port.startRequested.promise;
    const serialized = turns.submit({ message: 'must stay in session 1' });
    turns.activate('acp:session-2');
    port.releaseStart.resolve();

    await expect(first).resolves.toEqual({ accepted: false, reason: 'stale-session' });
    await expect(serialized).resolves.toEqual({ accepted: false, reason: 'stale-session' });
    expect(port.starts.map(({ sessionId, draft }) => ({ sessionId, message: draft.message }))).toEqual([
      { sessionId: 'acp:session-1', message: 'starting in session 1' },
    ]);
    expect(turns.snapshot).toMatchObject({ activeSessionId: 'acp:session-2', entries: [] });
  });

  it('uses a new draft to recover from start-failed and returns it to the head if its start also fails', async () => {
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

    await expect(turns.submit({ message: 'corrective draft' })).resolves.toEqual({
      accepted: false,
      reason: 'start-failed',
    });

    expect(port.attempts.map(({ draft }) => draft.message)).toEqual(['failed first', 'corrective draft']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['corrective draft', 'failed first']);
    expect(turns.snapshot.phase).toBe('paused');
    expect(turns.snapshot.pauseReason).toBe('start-failed');
  });

  it.each(['manual-stop', 'agent-error'] as const)('pauses remaining FIFO after %s', async (outcome) => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'keep queued' });

    port.complete(0, outcome);
    await turns.whenSettled();

    expect(turns.snapshot.phase).toBe('paused');
    expect(turns.snapshot.pauseReason).toBe(outcome);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['keep queued']);
  });

  it('resumes the paused Queued Turn FIFO from its head', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'first queued' });
    await turns.submit({ message: 'last queued' });

    port.complete(0, 'manual-stop');
    await turns.whenSettled();
    await expect(turns.resume()).resolves.toEqual({ accepted: true, outcome: 'resumed' });

    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'first queued']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['last queued']);
    expect(turns.snapshot).toMatchObject({ phase: 'generating', pauseReason: undefined, canResume: false });
  });

  it('sends a corrective new draft while paused before restoring the older FIFO', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'first queued' });
    await turns.submit({ message: 'last queued' });

    port.complete(0, 'agent-error');
    await turns.whenSettled();

    await expect(turns.submit({ message: 'corrective draft' })).resolves.toEqual({
      accepted: true,
      outcome: 'started',
    });
    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'corrective draft']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['first queued', 'last queued']);

    port.complete(1);
    await turns.whenSettled();

    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'corrective draft', 'first queued']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['last queued']);
  });

  it('ignores a duplicate completion for the same delivery', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'first queued' });
    await turns.submit({ message: 'last queued' });

    port.complete(0);
    port.complete(0);
    await turns.whenSettled();

    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'first queued']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['last queued']);
  });

  it('blocks an edited head until save', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'head' });

    const headId = turns.snapshot.entries[0].id;
    turns.beginEdit(headId);
    port.complete(0);
    await turns.whenSettled();
    expect(port.starts).toHaveLength(1);
    expect(turns.snapshot.canFastTrack).toBe(false);

    await turns.commitEdit(headId, { message: 'edited head' });
    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'edited head']);
  });

  it('rejects a second edit while another Queued Turn is being edited', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'first queued' });
    await turns.submit({ message: 'last queued' });

    expect(turns.beginEdit(turns.snapshot.entries[0].id)).toEqual({ accepted: true, outcome: 'updated' });
    expect(turns.beginEdit(turns.snapshot.entries[1].id)).toEqual({
      accepted: false,
      reason: 'another-turn-is-editing',
    });
  });

  it('edits a non-head Queued Turn without blocking earlier FIFO work', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'first queued' });
    await turns.submit({ message: 'edited later' });

    turns.beginEdit(turns.snapshot.entries[1].id);
    port.complete(0);
    await turns.whenSettled();

    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'first queued']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['edited later']);
  });

  it('preserves a non-head Queued Turn ID and FIFO position after edit commit', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'first queued' });
    await turns.submit({ message: 'selected' });
    await turns.submit({ message: 'last queued' });
    const originalIds = turns.snapshot.entries.map(({ id }) => id);
    const selectedId = originalIds[1];

    turns.beginEdit(selectedId);
    await turns.commitEdit(selectedId, { message: 'edited selected' });

    expect(turns.snapshot.entries.map(({ id }) => id)).toEqual(originalIds);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual([
      'first queued',
      'edited selected',
      'last queued',
    ]);
  });

  it('cancels an edited head and dispatches its original draft', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'original head' });

    const headId = turns.snapshot.entries[0].id;
    turns.beginEdit(headId);
    port.complete(0);
    await turns.whenSettled();

    await expect(turns.cancelEdit(headId)).resolves.toEqual({ accepted: true, outcome: 'updated' });
    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'original head']);
    expect(turns.snapshot.editingTurnId).toBeUndefined();
  });

  it('deletes an edited head and dispatches the next Queued Turn', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'edited head' });
    await turns.submit({ message: 'next queued' });

    const headId = turns.snapshot.entries[0].id;
    turns.beginEdit(headId);
    port.complete(0);
    await turns.whenSettled();

    await expect(turns.remove(headId)).resolves.toEqual({ accepted: true, outcome: 'removed' });
    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'next queued']);
    expect(turns.snapshot.editingTurnId).toBeUndefined();
  });

  it('waits for cancellation before Immediate Send and preserves the remaining order', async () => {
    const cancel = new Deferred<void>();
    const port = new ControlledTurnPort();
    port.cancelCurrent = jest.fn(() => cancel.promise);
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'first queued' });
    await turns.submit({ message: 'selected' });
    await turns.submit({ message: 'last queued' });

    const immediate = turns.sendImmediately(turns.snapshot.entries[1].id);
    expect(turns.snapshot.phase).toBe('cancelling-for-immediate');
    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running']);

    cancel.resolve();
    await expect(immediate).resolves.toEqual({ accepted: true, outcome: 'started' });

    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'selected']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['first queued', 'last queued']);

    port.complete(0);
    await turns.whenSettled();
    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'selected']);

    port.complete(1);
    await turns.whenSettled();
    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'selected', 'first queued']);
  });

  it('restores an Immediate Send reservation to its original FIFO position when cancellation fails', async () => {
    const port = new ControlledTurnPort();
    port.cancelCurrent = jest.fn(() => Promise.reject(new Error('cancel failed')));
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'first queued' });
    await turns.submit({ message: 'selected' });
    await turns.submit({ message: 'last queued' });
    const originalIds = turns.snapshot.entries.map(({ id }) => id);

    await expect(turns.sendImmediately(originalIds[1])).resolves.toEqual({ accepted: false, reason: 'cancel-failed' });

    expect(turns.snapshot.entries.map(({ id }) => id)).toEqual(originalIds);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['first queued', 'selected', 'last queued']);
    expect(turns.snapshot).toMatchObject({ phase: 'paused', pauseReason: 'cancel-failed' });
    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running']);
  });

  it('rejects a repeated Immediate Send for the same reserved Queued Turn without double cancellation or start', async () => {
    const cancel = new Deferred<void>();
    const port = new ControlledTurnPort();
    port.cancelCurrent = jest.fn(() => cancel.promise);
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'selected' });
    const selectedId = turns.snapshot.entries[0].id;

    const first = turns.sendImmediately(selectedId);
    const repeated = turns.sendImmediately(selectedId);
    cancel.resolve();

    await expect(first).resolves.toEqual({ accepted: true, outcome: 'started' });
    await expect(repeated).resolves.toEqual({ accepted: false, reason: 'turn-not-found' });
    expect(port.cancelCurrent).toHaveBeenCalledTimes(1);
    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'selected']);
  });

  it('commits an inline edit and Immediately Sends the same Queued Turn', async () => {
    const cancel = new Deferred<void>();
    const port = new ControlledTurnPort();
    port.cancelCurrent = jest.fn(() => cancel.promise);
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'selected' });
    await turns.submit({ message: 'last queued' });
    const selectedId = turns.snapshot.entries[0].id;
    turns.beginEdit(selectedId);

    const commit = turns.commitEdit(selectedId, { message: 'edited selected' }, true);
    expect(turns.snapshot.phase).toBe('cancelling-for-immediate');
    cancel.resolve();

    await expect(commit).resolves.toEqual({ accepted: true, outcome: 'started' });
    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'edited selected']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['last queued']);
    expect(turns.snapshot.editingTurnId).toBeUndefined();
  });

  it('rejects direct Immediate Send for an editing turn and preserves the lease for commit', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'selected' });
    const selectedId = turns.snapshot.entries[0].id;
    turns.beginEdit(selectedId);

    await expect(turns.sendImmediately(selectedId)).resolves.toEqual({
      accepted: false,
      reason: 'another-turn-is-editing',
    });
    expect(turns.snapshot.editingTurnId).toBe(selectedId);
    expect(turns.snapshot.entries.map(({ id, message }) => ({ id, message }))).toEqual([
      { id: selectedId, message: 'selected' },
    ]);

    await expect(turns.commitEdit(selectedId, { message: 'edited selected' }, true)).resolves.toEqual({
      accepted: true,
      outcome: 'started',
    });
    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'edited selected']);
    expect(turns.snapshot.editingTurnId).toBeUndefined();
  });

  it('returns an Immediate Send target to the queue head when its start fails after cancellation', async () => {
    const port = new RejectingNextStartTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'first queued' });
    await turns.submit({ message: 'selected' });
    await turns.submit({ message: 'last queued' });
    port.failNextStart = true;

    await expect(turns.sendImmediately(turns.snapshot.entries[1].id)).resolves.toEqual({
      accepted: false,
      reason: 'start-failed',
    });

    expect(port.failedStarts.map(({ message }) => message)).toEqual(['selected']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['selected', 'first queued', 'last queued']);
    expect(turns.snapshot).toMatchObject({ phase: 'paused', pauseReason: 'start-failed' });
  });

  it('enters paused before stop cancellation completes and absorbs the stopped delivery completion', async () => {
    const cancel = new Deferred<void>();
    const port = new ControlledTurnPort();
    port.cancelCurrent = jest.fn(() => cancel.promise);
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'queued' });

    const stop = turns.stop();
    expect(turns.snapshot).toMatchObject({ phase: 'paused', pauseReason: 'manual-stop' });
    cancel.resolve();
    await expect(stop).resolves.toEqual({ accepted: true, outcome: 'stopped' });

    port.complete(0);
    await turns.whenSettled();
    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['queued']);
  });

  it('does not cancel a newly activated session when stop was serialized behind an older start', async () => {
    const port = new ControlledStartTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');

    const submit = turns.submit({ message: 'starting in session 1' });
    await port.startRequested.promise;
    const stop = turns.stop();
    turns.activate('acp:session-2');
    port.releaseStart.resolve();

    await expect(submit).resolves.toEqual({ accepted: false, reason: 'stale-session' });
    await expect(stop).resolves.toEqual({ accepted: false, reason: 'stale-session' });
    expect(port.cancellations).toEqual([]);
    expect(turns.snapshot.activeSessionId).toBe('acp:session-2');
  });

  it('does not cancel a newly activated session when Immediate Send was serialized behind an older cancel', async () => {
    const port = new DeferredFirstCancelTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'selected' });

    const stop = turns.stop();
    await port.cancelRequested.promise;
    const immediate = turns.sendImmediately(turns.snapshot.entries[0].id);
    turns.activate('acp:session-2');
    port.releaseCancel.resolve();

    await expect(stop).resolves.toEqual({ accepted: false, reason: 'stale-session' });
    await expect(immediate).resolves.toEqual({ accepted: false, reason: 'stale-session' });
    expect(port.cancellations).toEqual(['acp:session-1']);
    expect(turns.snapshot.activeSessionId).toBe('acp:session-2');
  });

  it('keeps a later stop intent after a deferred normal start acknowledges', async () => {
    const port = new ControlledStartTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');

    const submit = turns.submit({ message: 'deferred start' });
    await port.startRequested.promise;
    const stop = turns.stop();
    port.releaseStart.resolve();

    await expect(submit).resolves.toEqual({ accepted: true, outcome: 'started' });
    await expect(stop).resolves.toEqual({ accepted: true, outcome: 'stopped' });
    expect(turns.snapshot).toMatchObject({ phase: 'paused', pauseReason: 'manual-stop' });
  });

  it('keeps a later stop intent after a deferred Immediate Send start acknowledges', async () => {
    const port = new DeferredNextStartTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'selected' });
    port.deferNextStart = true;

    const immediate = turns.sendImmediately(turns.snapshot.entries[0].id);
    await port.startRequested.promise;
    const stop = turns.stop();
    port.releaseStart.resolve();

    await expect(immediate).resolves.toEqual({ accepted: true, outcome: 'started' });
    await expect(stop).resolves.toEqual({ accepted: true, outcome: 'stopped' });
    expect(turns.snapshot).toMatchObject({ phase: 'paused', pauseReason: 'manual-stop' });
  });

  it('stays paused without retrying when stop cancellation fails', async () => {
    const port = new ControlledTurnPort();
    port.cancelCurrent = jest.fn(() => Promise.reject(new Error('cancel failed')));
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'queued' });

    await expect(turns.stop()).resolves.toEqual({ accepted: false, reason: 'cancel-failed' });

    expect(turns.snapshot).toMatchObject({ phase: 'paused', pauseReason: 'cancel-failed' });
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['queued']);
    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running']);
  });

  it('retries cancellation to Immediately Send a corrective draft after cancel-failed', async () => {
    const port = new ControlledTurnPort();
    port.cancelCurrent = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('cancel failed'))
      .mockResolvedValueOnce();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'old queued' });
    await turns.stop();

    await expect(turns.submit({ message: 'corrective draft' })).resolves.toEqual({
      accepted: true,
      outcome: 'started',
    });

    expect(port.cancelCurrent).toHaveBeenCalledTimes(2);
    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'corrective draft']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['old queued']);
  });

  it('resumes the remaining FIFO after removing a Queued Turn while paused', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'head' });
    await turns.submit({ message: 'removed tail' });
    const tailId = turns.snapshot.entries[1].id;
    port.complete(0, 'agent-error');
    await turns.whenSettled();

    await turns.remove(tailId);

    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'head']);
    expect(turns.snapshot.entries).toEqual([]);
  });

  it('takes back only the tail Queued Turn and releases its edit lease', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'first queued' });
    await turns.submit({ message: 'tail', images: ['tail.png'] });
    const tail = turns.snapshot.entries[1];
    turns.beginEdit(tail.id);

    expect(turns.takeBackLast()).toEqual(tail);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['first queued']);
    expect(turns.snapshot.editingTurnId).toBeUndefined();
  });

  it('uses fast-track once to Immediately Send the FIFO head', async () => {
    const port = new ControlledTurnPort();
    port.cancelCurrent = jest.fn(() => Promise.resolve());
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'head' });
    await turns.submit({ message: 'last queued' });

    expect(turns.snapshot.canFastTrack).toBe(true);
    await expect(turns.fastTrack()).resolves.toEqual({ accepted: true, outcome: 'started' });
    await expect(turns.fastTrack()).resolves.toEqual({ accepted: false, reason: 'turn-not-found' });

    expect(port.cancelCurrent).toHaveBeenCalledTimes(1);
    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'head']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['last queued']);
    expect(turns.snapshot.canFastTrack).toBe(false);
  });

  it('invalidates one-shot fast-track after a user draft change', async () => {
    const port = new ControlledTurnPort();
    port.cancelCurrent = jest.fn(() => Promise.resolve());
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'head' });
    expect(turns.snapshot.canFastTrack).toBe(true);

    turns.invalidateFastTrack();
    await expect(turns.fastTrack()).resolves.toEqual({ accepted: false, reason: 'turn-not-found' });

    expect(port.cancelCurrent).not.toHaveBeenCalled();
    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['head']);
  });

  it('clears Queued Turns, editing, pause, and fast-track state', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'queued' });
    turns.beginEdit(turns.snapshot.entries[0].id);
    port.complete(0, 'manual-stop');
    await turns.whenSettled();

    turns.clear();

    expect(turns.snapshot).toMatchObject({
      phase: 'idle',
      entries: [],
      editingTurnId: undefined,
      pauseReason: undefined,
      canResume: false,
      canFastTrack: false,
    });
  });

  it('keeps the confirmed Active Delivery across Clear All and advances newly queued work after completion', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'cleared queued' });

    turns.clear();
    expect(turns.snapshot).toMatchObject({ phase: 'generating', entries: [] });

    await expect(turns.submit({ message: 'queued after clear' })).resolves.toEqual({
      accepted: true,
      outcome: 'queued',
    });
    port.complete(0);
    await turns.whenSettled();

    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'queued after clear']);
    expect(turns.snapshot.entries).toEqual([]);
  });

  it('clears an Immediate Send reservation before cancellation can start it', async () => {
    const cancel = new Deferred<void>();
    const port = new ControlledTurnPort();
    port.cancelCurrent = jest.fn(() => cancel.promise);
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'selected' });

    const immediate = turns.sendImmediately(turns.snapshot.entries[0].id);
    turns.clear();
    cancel.resolve();

    await expect(immediate).resolves.toEqual({ accepted: false, reason: 'turn-not-found' });
    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running']);
    expect(turns.snapshot.entries).toEqual([]);
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

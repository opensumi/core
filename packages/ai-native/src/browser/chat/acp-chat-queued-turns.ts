import { Emitter, Event, IDisposable } from '@opensumi/ide-core-common';

import { hasAcpChatSendPayload } from '../components/acp/chat-input-validation';

export interface AcpTurnDraft {
  message: string;
  images?: readonly string[];
  agentId?: string;
  command?: string;
}

export interface QueuedTurn extends AcpTurnDraft {
  id: string;
}

export type AcpTurnOutcome = 'completed' | 'manual-stop' | 'agent-error';

export interface AcpTurnHandle {
  id: string;
  sessionId: string;
  outcome: Promise<AcpTurnOutcome>;
}

export interface AcpQueuedTurnPort {
  getStatus(sessionId: string | undefined): 'idle' | 'generating';
  start(sessionId: string | undefined, draft: AcpTurnDraft): Promise<AcpTurnHandle>;
  cancelCurrent(sessionId: string | undefined): Promise<void>;
}

export type QueuePauseReason = 'manual-stop' | 'agent-error' | 'start-failed' | 'cancel-failed';

export interface AcpQueuedTurnSnapshot {
  activeSessionId?: string;
  phase: 'idle' | 'generating' | 'paused' | 'cancelling-for-immediate';
  entries: readonly QueuedTurn[];
  editingTurnId?: string;
  pauseReason?: QueuePauseReason;
  canResume: boolean;
  canFastTrack: boolean;
}

export type TurnActionResult =
  | { accepted: true; outcome: 'started' | 'queued' | 'updated' | 'removed' | 'resumed' | 'stopped' }
  | {
      accepted: false;
      reason:
        | 'empty-content'
        | 'turn-not-found'
        | 'another-turn-is-editing'
        | 'stale-session'
        | 'unsupported-capability'
        | 'start-failed'
        | 'cancel-failed';
    };

interface ActiveDelivery {
  epoch: number;
  id: string;
}

export class AcpQueuedTurnModule implements IDisposable {
  private activeSessionId: string | undefined;
  private phase: AcpQueuedTurnSnapshot['phase'] = 'idle';
  private entries: QueuedTurn[] = [];
  private editingTurnId: string | undefined;
  private pauseReason: QueuePauseReason | undefined;
  private reservedTurn: QueuedTurn | undefined;
  private nextTurnId = 1;
  private sessionEpoch = 0;
  private activeDelivery: ActiveDelivery | undefined;
  private pendingInitialStart = false;
  private hasPendingActivation = false;
  private pendingActivationId: string | undefined;

  private operationTail = Promise.resolve();

  private readonly onDidChangeEmitter = new Emitter<AcpQueuedTurnSnapshot>();
  readonly onDidChange: Event<AcpQueuedTurnSnapshot> = this.onDidChangeEmitter.event;

  constructor(private readonly port: AcpQueuedTurnPort) {}

  get snapshot(): AcpQueuedTurnSnapshot {
    return {
      activeSessionId: this.activeSessionId,
      phase: this.phase,
      entries: [...this.entries],
      editingTurnId: this.editingTurnId,
      pauseReason: this.pauseReason,
      canResume: this.phase === 'paused' && this.entries.length > 0,
      canFastTrack: this.phase === 'generating' && this.entries.length > 0,
    };
  }

  activate(sessionId: string | undefined): void {
    const effectiveActiveSessionId = this.hasPendingActivation ? this.pendingActivationId : this.activeSessionId;
    if (sessionId === effectiveActiveSessionId) {
      return;
    }

    if (this.pendingInitialStart) {
      this.pendingActivationId = sessionId;
      this.hasPendingActivation = true;
      return;
    }

    this.applyActivation(sessionId);
  }

  submit(draft: AcpTurnDraft): Promise<TurnActionResult> {
    return this.serialize(async () => {
      if (!hasAcpChatSendPayload(draft)) {
        return { accepted: false, reason: 'empty-content' };
      }

      const submittedDraft = this.copyDraft(draft);
      if (
        this.phase === 'paused' ||
        this.entries.length > 0 ||
        this.port.getStatus(this.activeSessionId) === 'generating' ||
        this.activeDelivery
      ) {
        this.entries.push(this.createQueuedTurn(submittedDraft));
        if (this.phase !== 'paused') {
          this.phase = 'generating';
          this.pauseReason = undefined;
        }
        this.fireDidChange();
        return { accepted: true, outcome: 'queued' };
      }

      return this.startDraft(submittedDraft, this.sessionEpoch);
    });
  }

  private serialize<T>(operation: () => Promise<T> | T): Promise<T> {
    const result = this.operationTail.then(operation, operation);
    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  whenSettled(): Promise<void> {
    return this.operationTail.then(() => this.operationTail);
  }

  dispose(): void {
    this.onDidChangeEmitter.dispose();
  }

  private applyActivation(sessionId: string | undefined): void {
    this.sessionEpoch += 1;
    this.activeSessionId = sessionId;
    this.entries = [];
    this.editingTurnId = undefined;
    this.reservedTurn = undefined;
    this.activeDelivery = undefined;
    this.pauseReason = undefined;
    this.phase = this.port.getStatus(sessionId);
    this.hasPendingActivation = false;
    this.pendingActivationId = undefined;
    this.fireDidChange();
  }

  private async startDraft(draft: AcpTurnDraft, epoch: number, queuedTurn?: QueuedTurn): Promise<TurnActionResult> {
    const sessionId = this.activeSessionId;
    this.reservedTurn = queuedTurn || this.createQueuedTurn(draft);
    this.phase = 'generating';
    this.pauseReason = undefined;
    this.pendingInitialStart = sessionId === undefined;
    this.fireDidChange();

    let handle: AcpTurnHandle;
    try {
      handle = await this.port.start(sessionId, draft);
    } catch {
      const pendingActivationId = this.takePendingActivation();
      this.pendingInitialStart = false;

      if (epoch !== this.sessionEpoch) {
        return { accepted: false, reason: 'stale-session' };
      }

      if (pendingActivationId.pending) {
        this.applyActivation(pendingActivationId.sessionId);
        return { accepted: false, reason: 'stale-session' };
      }

      if (this.reservedTurn) {
        this.entries.unshift(this.reservedTurn);
      }
      this.reservedTurn = undefined;
      this.phase = 'paused';
      this.pauseReason = 'start-failed';
      this.fireDidChange();
      return { accepted: false, reason: 'start-failed' };
    }

    this.pendingInitialStart = false;
    const pendingActivation = this.takePendingActivation();
    this.watchOutcome(epoch, handle);

    if (epoch !== this.sessionEpoch) {
      return { accepted: false, reason: 'stale-session' };
    }

    if (pendingActivation.pending && pendingActivation.sessionId !== handle.sessionId) {
      this.applyActivation(pendingActivation.sessionId);
      return { accepted: false, reason: 'stale-session' };
    }

    if (sessionId === undefined) {
      this.activeSessionId = handle.sessionId;
    } else if (handle.sessionId !== sessionId) {
      this.reservedTurn = undefined;
      return { accepted: false, reason: 'stale-session' };
    }

    this.reservedTurn = undefined;
    this.activeDelivery = { epoch, id: handle.id };
    this.phase = 'generating';
    this.fireDidChange();
    return { accepted: true, outcome: 'started' };
  }

  private watchOutcome(epoch: number, handle: AcpTurnHandle): void {
    handle.outcome.then(
      (outcome) => {
        void this.serialize(() => this.handleOutcome(epoch, handle.id, outcome));
      },
      () => {
        void this.serialize(() => this.handleOutcome(epoch, handle.id, 'agent-error'));
      },
    );
  }

  private async handleOutcome(epoch: number, deliveryId: string, outcome: AcpTurnOutcome): Promise<void> {
    if (epoch !== this.sessionEpoch || this.activeDelivery?.epoch !== epoch || this.activeDelivery.id !== deliveryId) {
      return;
    }

    this.activeDelivery = undefined;
    if (outcome !== 'completed') {
      this.phase = 'paused';
      this.pauseReason = outcome;
      this.fireDidChange();
      return;
    }

    this.phase = 'idle';
    this.pauseReason = undefined;
    const nextTurn = this.entries.shift();
    if (!nextTurn) {
      this.fireDidChange();
      return;
    }

    const { id: _id, ...draft } = nextTurn;
    await this.startDraft(draft, epoch, nextTurn);
  }

  private createQueuedTurn(draft: AcpTurnDraft): QueuedTurn {
    return {
      ...this.copyDraft(draft),
      id: `queued-turn-${this.nextTurnId++}`,
    };
  }

  private copyDraft(draft: AcpTurnDraft): AcpTurnDraft {
    return {
      ...draft,
      images: draft.images ? [...draft.images] : undefined,
    };
  }

  private takePendingActivation(): { pending: boolean; sessionId: string | undefined } {
    const pending = this.hasPendingActivation;
    const sessionId = this.pendingActivationId;
    this.hasPendingActivation = false;
    this.pendingActivationId = undefined;
    return { pending, sessionId };
  }

  private fireDidChange(): void {
    this.onDidChangeEmitter.fire(this.snapshot);
  }
}

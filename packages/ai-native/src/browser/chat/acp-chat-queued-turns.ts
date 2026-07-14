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
  private processing: 'auto' | 'paused' | 'absorbing-cancel' = 'auto';
  private entries: QueuedTurn[] = [];
  private editingTurnId: string | undefined;
  private pauseReason: QueuePauseReason | undefined;
  private reservedTurn: QueuedTurn | undefined;
  private immediateReservation: QueuedTurn | undefined;
  private immediateReservationIndex: number | undefined;
  private canFastTrack = false;
  private nextTurnId = 1;
  private sessionEpoch = 0;
  private intentVersion = 0;
  private activeDelivery: ActiveDelivery | undefined;
  private pendingInitialStart = false;
  private hasPendingActivation = false;
  private pendingActivationId: string | undefined;

  private operationTail = Promise.resolve();

  private readonly onDidChangeEmitter = new Emitter<AcpQueuedTurnSnapshot>();
  readonly onDidChange: Event<AcpQueuedTurnSnapshot> = this.onDidChangeEmitter.event;

  constructor(private readonly port: AcpQueuedTurnPort) {}

  get snapshot(): AcpQueuedTurnSnapshot {
    const phase = this.getPhase();
    return {
      activeSessionId: this.activeSessionId,
      phase,
      entries: [...this.entries],
      editingTurnId: this.editingTurnId,
      pauseReason: this.pauseReason,
      canResume: phase === 'paused' && this.entries.length > 0,
      canFastTrack:
        this.canFastTrack &&
        phase === 'generating' &&
        this.entries.length > 0 &&
        this.entries[0].id !== this.editingTurnId,
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

  deactivate(): void {
    this.sessionEpoch += 1;
    this.intentVersion += 1;
    this.activeSessionId = undefined;
    this.processing = 'auto';
    this.entries = [];
    this.editingTurnId = undefined;
    this.reservedTurn = undefined;
    this.immediateReservation = undefined;
    this.immediateReservationIndex = undefined;
    this.activeDelivery = undefined;
    this.pauseReason = undefined;
    this.canFastTrack = false;
    this.pendingInitialStart = false;
    this.hasPendingActivation = false;
    this.pendingActivationId = undefined;
  }

  submit(draft: AcpTurnDraft, intent: 'normal' | 'immediate' = 'normal'): Promise<TurnActionResult> {
    if (!hasAcpChatSendPayload(draft)) {
      return Promise.resolve({ accepted: false, reason: 'empty-content' });
    }

    const epoch = this.sessionEpoch;
    const sessionId = this.activeSessionId;
    const submittedDraft = this.copyDraft(draft);
    if (intent === 'immediate') {
      const immediateTurn = this.createQueuedTurn(submittedDraft);
      this.entries.push(immediateTurn);
      this.fireDidChange();
      return this.sendImmediately(immediateTurn.id);
    }
    if (this.processing === 'paused' && this.activeDelivery) {
      const correctiveTurn = this.createQueuedTurn(submittedDraft);
      this.entries.unshift(correctiveTurn);
      return this.sendImmediately(correctiveTurn.id);
    }

    return this.serialize(async () => {
      if (!this.isCapturedSessionActive(epoch, sessionId)) {
        return { accepted: false, reason: 'stale-session' };
      }
      if (this.processing === 'paused' && !this.activeDelivery) {
        return this.startReservedTurn(this.createQueuedTurn(submittedDraft), true);
      }

      if (
        this.entries.length > 0 ||
        this.port.getStatus(this.activeSessionId) === 'generating' ||
        this.activeDelivery
      ) {
        this.entries.push(this.createQueuedTurn(submittedDraft));
        this.canFastTrack = this.processing === 'auto';
        if (this.processing !== 'paused') {
          this.pauseReason = undefined;
        }
        this.fireDidChange();
        return { accepted: true, outcome: 'queued' };
      }

      return this.startReservedTurn(this.createQueuedTurn(submittedDraft), true);
    });
  }

  resume(): Promise<TurnActionResult> {
    const intentVersion = this.intentVersion;
    return this.serialize(async () => {
      if (this.processing !== 'paused' || (!this.activeDelivery && this.entries.length === 0)) {
        return { accepted: false, reason: 'turn-not-found' };
      }
      if (intentVersion !== this.intentVersion) {
        return { accepted: false, reason: 'turn-not-found' };
      }

      this.processing = 'auto';
      this.pauseReason = undefined;
      this.fireDidChange();
      if (this.activeDelivery) {
        return { accepted: true, outcome: 'resumed' };
      }
      if (intentVersion !== this.intentVersion) {
        return { accepted: true, outcome: 'resumed' };
      }

      const result = await this.startNextQueuedTurnIfReady();
      return result.accepted ? { accepted: true, outcome: 'resumed' } : result;
    });
  }

  stop(): Promise<TurnActionResult> {
    const epoch = this.sessionEpoch;
    const sessionId = this.activeSessionId;
    const intentVersion = ++this.intentVersion;
    this.processing = 'paused';
    this.pauseReason = 'manual-stop';
    this.canFastTrack = false;
    this.fireDidChange();

    return this.serialize(async () => {
      if (!this.isCapturedSessionActive(epoch, sessionId)) {
        return { accepted: false, reason: 'stale-session' };
      }
      const cancellationSessionId = sessionId ?? this.activeSessionId;
      try {
        await this.port.cancelCurrent(cancellationSessionId);
      } catch {
        if (!this.isResolvedSessionActive(epoch, cancellationSessionId)) {
          return { accepted: false, reason: 'stale-session' };
        }
        if (intentVersion === this.intentVersion) {
          this.processing = 'paused';
          this.pauseReason = 'cancel-failed';
          this.fireDidChange();
        }
        return { accepted: false, reason: 'cancel-failed' };
      }

      if (!this.isResolvedSessionActive(epoch, cancellationSessionId)) {
        return { accepted: false, reason: 'stale-session' };
      }
      this.activeDelivery = undefined;
      if (intentVersion === this.intentVersion) {
        this.processing = 'paused';
        this.pauseReason = 'manual-stop';
        this.canFastTrack = false;
      }
      this.fireDidChange();
      return { accepted: true, outcome: 'stopped' };
    });
  }

  sendImmediately(turnId: string): Promise<TurnActionResult> {
    const epoch = this.sessionEpoch;
    const sessionId = this.activeSessionId;
    if (this.editingTurnId === turnId) {
      return Promise.resolve({ accepted: false, reason: 'another-turn-is-editing' });
    }
    if (this.processing === 'absorbing-cancel' || this.immediateReservation) {
      return Promise.resolve({ accepted: false, reason: 'turn-not-found' });
    }

    const index = this.entries.findIndex(({ id }) => id === turnId);
    if (index === -1) {
      return Promise.resolve({ accepted: false, reason: 'turn-not-found' });
    }

    const [turn] = this.entries.splice(index, 1);
    const intentVersion = ++this.intentVersion;
    this.immediateReservation = turn;
    this.immediateReservationIndex = index;
    this.processing = 'absorbing-cancel';
    this.pauseReason = undefined;
    this.canFastTrack = false;
    this.fireDidChange();

    return this.serialize(() => this.cancelForImmediateAndStart(turn, index, epoch, sessionId, intentVersion));
  }

  beginEdit(turnId: string): TurnActionResult {
    if (!this.entries.some(({ id }) => id === turnId)) {
      return { accepted: false, reason: 'turn-not-found' };
    }
    if (this.editingTurnId && this.editingTurnId !== turnId) {
      return { accepted: false, reason: 'another-turn-is-editing' };
    }

    this.editingTurnId = turnId;
    this.fireDidChange();
    return { accepted: true, outcome: 'updated' };
  }

  commitEdit(turnId: string, draft: AcpTurnDraft, immediate = false): Promise<TurnActionResult> {
    if (immediate) {
      if (this.processing === 'absorbing-cancel' || this.immediateReservation) {
        return Promise.resolve({ accepted: false, reason: 'turn-not-found' });
      }
      if (!hasAcpChatSendPayload(draft)) {
        return Promise.resolve({ accepted: false, reason: 'empty-content' });
      }
      const index = this.entries.findIndex(({ id }) => id === turnId);
      if (index === -1 || this.editingTurnId !== turnId) {
        return Promise.resolve({ accepted: false, reason: 'turn-not-found' });
      }
      this.entries[index] = { ...this.copyDraft(draft), id: turnId };
      this.editingTurnId = undefined;
      this.fireDidChange();
      return this.sendImmediately(turnId);
    }

    const intentVersion = this.intentVersion;
    return this.serialize(async () => {
      if (!hasAcpChatSendPayload(draft)) {
        return { accepted: false, reason: 'empty-content' };
      }

      const index = this.entries.findIndex(({ id }) => id === turnId);
      if (index === -1 || this.editingTurnId !== turnId) {
        return { accepted: false, reason: 'turn-not-found' };
      }

      this.entries[index] = { ...this.copyDraft(draft), id: turnId };
      this.editingTurnId = undefined;
      if (intentVersion === this.intentVersion && this.processing === 'paused') {
        this.processing = 'auto';
        this.pauseReason = undefined;
      }
      this.fireDidChange();

      if (intentVersion === this.intentVersion) {
        await this.startNextQueuedTurnIfReady();
      }
      return { accepted: true, outcome: 'updated' };
    });
  }

  cancelEdit(turnId: string): Promise<TurnActionResult> {
    const intentVersion = this.intentVersion;
    return this.serialize(async () => {
      if (this.editingTurnId !== turnId || !this.entries.some(({ id }) => id === turnId)) {
        return { accepted: false, reason: 'turn-not-found' };
      }

      this.editingTurnId = undefined;
      if (intentVersion === this.intentVersion && this.processing === 'paused') {
        this.processing = 'auto';
        this.pauseReason = undefined;
      }
      this.fireDidChange();
      if (intentVersion === this.intentVersion) {
        await this.startNextQueuedTurnIfReady();
      }
      return { accepted: true, outcome: 'updated' };
    });
  }

  remove(turnId: string): Promise<TurnActionResult> {
    const intentVersion = this.intentVersion;
    return this.serialize(async () => {
      const index = this.entries.findIndex(({ id }) => id === turnId);
      if (index === -1) {
        return { accepted: false, reason: 'turn-not-found' };
      }

      this.entries.splice(index, 1);
      if (this.editingTurnId === turnId) {
        this.editingTurnId = undefined;
      }
      if (intentVersion === this.intentVersion && this.processing === 'paused') {
        this.processing = 'auto';
        this.pauseReason = undefined;
      }
      this.fireDidChange();

      if (intentVersion === this.intentVersion) {
        await this.startNextQueuedTurnIfReady();
      }
      return { accepted: true, outcome: 'removed' };
    });
  }

  takeBackLast(): QueuedTurn | undefined {
    const turn = this.entries.pop();
    if (!turn) {
      return undefined;
    }
    if (this.editingTurnId === turn.id) {
      this.editingTurnId = undefined;
    }
    this.canFastTrack = false;
    this.fireDidChange();
    return turn;
  }

  fastTrack(): Promise<TurnActionResult> {
    const head = this.entries[0];
    if (!this.canFastTrack || !head || head.id === this.editingTurnId) {
      return Promise.resolve({ accepted: false, reason: 'turn-not-found' });
    }
    this.canFastTrack = false;
    return this.sendImmediately(head.id);
  }

  invalidateFastTrack(): void {
    if (!this.canFastTrack) {
      return;
    }
    this.canFastTrack = false;
    this.fireDidChange();
  }

  clear(): void {
    this.intentVersion += 1;
    this.entries = [];
    this.editingTurnId = undefined;
    this.reservedTurn = undefined;
    this.immediateReservation = undefined;
    this.immediateReservationIndex = undefined;
    this.processing = 'auto';
    this.pauseReason = undefined;
    this.canFastTrack = false;
    this.fireDidChange();
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
    this.intentVersion += 1;
    this.activeSessionId = sessionId;
    this.processing = 'auto';
    this.entries = [];
    this.editingTurnId = undefined;
    this.reservedTurn = undefined;
    this.immediateReservation = undefined;
    this.immediateReservationIndex = undefined;
    this.activeDelivery = undefined;
    this.pauseReason = undefined;
    this.canFastTrack = false;
    this.hasPendingActivation = false;
    this.pendingActivationId = undefined;
    this.fireDidChange();
  }

  private async startReservedTurn(turn: QueuedTurn, returnToHeadOnFailure: boolean): Promise<TurnActionResult> {
    const epoch = this.sessionEpoch;
    const sessionId = this.activeSessionId;
    const intentVersion = this.intentVersion;
    const { id: _id, ...draft } = turn;
    this.reservedTurn = turn;
    this.processing = 'auto';
    this.pauseReason = undefined;
    this.canFastTrack = false;
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

      if (this.reservedTurn === turn && returnToHeadOnFailure) {
        this.entries.unshift(turn);
      }
      this.reservedTurn = undefined;
      if (intentVersion === this.intentVersion) {
        this.processing = 'paused';
        this.pauseReason = 'start-failed';
      }
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
    if (intentVersion === this.intentVersion) {
      this.processing = 'auto';
    }
    this.fireDidChange();
    return { accepted: true, outcome: 'started' };
  }

  private async cancelForImmediateAndStart(
    turn: QueuedTurn,
    originalIndex: number,
    epoch: number,
    sessionId: string | undefined,
    intentVersion: number,
  ): Promise<TurnActionResult> {
    if (!this.isCapturedSessionActive(epoch, sessionId)) {
      return { accepted: false, reason: 'stale-session' };
    }
    const cancellationSessionId = sessionId ?? this.activeSessionId;
    if (intentVersion !== this.intentVersion) {
      if (this.immediateReservation === turn) {
        this.entries.splice(Math.min(originalIndex, this.entries.length), 0, turn);
        this.immediateReservation = undefined;
        this.immediateReservationIndex = undefined;
        this.fireDidChange();
      }
      return { accepted: false, reason: 'turn-not-found' };
    }
    try {
      await this.port.cancelCurrent(cancellationSessionId);
    } catch {
      if (!this.isResolvedSessionActive(epoch, cancellationSessionId)) {
        return { accepted: false, reason: 'stale-session' };
      }
      if (this.immediateReservation !== turn) {
        return { accepted: false, reason: 'turn-not-found' };
      }
      const reservationIndex = this.immediateReservationIndex ?? originalIndex;
      this.entries.splice(Math.min(reservationIndex, this.entries.length), 0, turn);
      this.immediateReservation = undefined;
      this.immediateReservationIndex = undefined;
      this.processing = 'paused';
      this.pauseReason = 'cancel-failed';
      this.fireDidChange();
      return { accepted: false, reason: 'cancel-failed' };
    }

    if (!this.isResolvedSessionActive(epoch, cancellationSessionId)) {
      return { accepted: false, reason: 'stale-session' };
    }

    this.activeDelivery = undefined;
    if (intentVersion !== this.intentVersion) {
      if (this.immediateReservation === turn) {
        this.entries.splice(Math.min(originalIndex, this.entries.length), 0, turn);
        this.immediateReservation = undefined;
        this.immediateReservationIndex = undefined;
      }
      this.fireDidChange();
      return { accepted: false, reason: 'turn-not-found' };
    }
    if (this.immediateReservation !== turn) {
      this.fireDidChange();
      return { accepted: false, reason: 'turn-not-found' };
    }
    this.immediateReservation = undefined;
    this.immediateReservationIndex = undefined;
    this.processing = 'auto';
    this.pauseReason = undefined;
    return this.startReservedTurn(turn, true);
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
    if (this.processing === 'paused') {
      this.fireDidChange();
      return;
    }

    if (outcome !== 'completed') {
      this.processing = 'paused';
      this.pauseReason = outcome;
      this.canFastTrack = false;
      this.fireDidChange();
      return;
    }

    this.pauseReason = undefined;
    if (this.entries[0]?.id === this.editingTurnId) {
      this.fireDidChange();
      return;
    }

    await this.startNextQueuedTurnIfReady();
  }

  private async startNextQueuedTurnIfReady(): Promise<TurnActionResult> {
    if (
      this.activeDelivery ||
      this.reservedTurn ||
      this.processing !== 'auto' ||
      this.entries[0]?.id === this.editingTurnId
    ) {
      return { accepted: true, outcome: 'updated' };
    }

    const nextTurn = this.entries.shift();
    if (!nextTurn) {
      this.fireDidChange();
      return { accepted: true, outcome: 'updated' };
    }

    return this.startReservedTurn(nextTurn, true);
  }

  private getPhase(): AcpQueuedTurnSnapshot['phase'] {
    if (this.processing === 'absorbing-cancel') {
      return 'cancelling-for-immediate';
    }
    if (this.processing === 'paused') {
      return 'paused';
    }
    if (this.activeDelivery || this.reservedTurn || this.port.getStatus(this.activeSessionId) === 'generating') {
      return 'generating';
    }
    return 'idle';
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

  private isCapturedSessionActive(epoch: number, capturedSessionId: string | undefined): boolean {
    return (
      epoch === this.sessionEpoch && (capturedSessionId === undefined || capturedSessionId === this.activeSessionId)
    );
  }

  private isResolvedSessionActive(epoch: number, resolvedSessionId: string | undefined): boolean {
    return epoch === this.sessionEpoch && resolvedSessionId === this.activeSessionId;
  }

  private fireDidChange(): void {
    this.onDidChangeEmitter.fire(this.snapshot);
  }
}

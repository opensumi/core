import { Autowired, Injectable } from '@opensumi/di';
import { Emitter, Event, ILogger } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { PermissionDialogProps } from './permission-dialog.view';
import { PermissionDecision } from './permission.handler';

import type { PermissionOption, PermissionOptionKind } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

export interface ShowPermissionDialogParams {
  requestId: string;
  sessionId: string;
  title: string;
  kind?: string;
  content?: string;
  locations?: Array<{ path: string; line?: number }>;
  command?: string;
  options: PermissionOption[];
  timeout: number;
}

@Injectable()
export class AcpPermissionBridgeService {
  @Autowired(ILogger)
  private logger: ILogger;

  @Autowired(IMainLayoutService)
  private mainLayoutService: IMainLayoutService;

  private activeDialogs = new Map<string, PermissionDialogProps>();
  private pendingDecisions = new Map<
    string,
    {
      resolve: (decision: PermissionDecision) => void;
      timeout: NodeJS.Timeout | undefined;
    }
  >();

  private readonly onPermissionRequest = new Emitter<ShowPermissionDialogParams>();
  readonly onDidRequestPermission: Event<ShowPermissionDialogParams> = this.onPermissionRequest.event;

  private readonly onPermissionResult = new Emitter<{
    requestId: string;
    decision: PermissionDecision;
  }>();
  readonly onDidReceivePermissionResult: Event<{
    requestId: string;
    decision: PermissionDecision;
  }> = this.onPermissionResult.event;

  // ---------------------------------------------------------------------------
  // Active session tracking
  // ---------------------------------------------------------------------------

  private activeSessionId: string | undefined;

  private readonly onActiveSessionChangeEmitter = new Emitter<string | undefined>();
  readonly onActiveSessionChange: Event<string | undefined> = this.onActiveSessionChangeEmitter.event;

  // ---------------------------------------------------------------------------
  // Pending permission index (session-scoped)
  // ---------------------------------------------------------------------------

  private pendingBySessionId = new Map<string, Set<string>>();

  private readonly onPendingCountChangeEmitter = new Emitter<void>();
  readonly onPendingCountChange: Event<void> = this.onPendingCountChangeEmitter.event;

  /**
   * Maps requestId → sessionId so we can clean up the pending index
   * when handleUserDecision/handleDialogClose fires.
   */
  private requestIdToSessionId = new Map<string, string>();

  /**
   * Set the currently active session.
   * Fires event to notify UI to re-render session-scoped dialogs.
   */
  setActiveSession(sessionId: string | undefined): void {
    if (this.activeSessionId === sessionId) {
      return;
    }
    this.activeSessionId = sessionId;
    this.onActiveSessionChangeEmitter.fire(sessionId);
  }

  /**
   * Get the currently active session ID.
   */
  getActiveSession(): string | undefined {
    return this.activeSessionId;
  }

  /**
   * Show permission dialog and wait for user response
   */
  async showPermissionDialog(params: ShowPermissionDialogParams): Promise<PermissionDecision> {
    const requestId = params.requestId;

    // Check if dialog already exists for this request
    if (this.activeDialogs.has(requestId)) {
      return { type: 'cancelled' };
    }

    // Create dialog props
    const dialogProps: PermissionDialogProps = {
      visible: true,
      requestId,
      title: params.title,
      kind: params.kind,
      content: params.content,
      locations: params.locations,
      command: params.command,
      options: params.options,
      timeout: params.timeout,
      onSelect: this.handleUserDecision.bind(this),
      onClose: this.handleDialogClose.bind(this),
    };

    this.activeDialogs.set(requestId, dialogProps);

    // Register in pending index
    this.requestIdToSessionId.set(requestId, params.sessionId);
    let pendingSet = this.pendingBySessionId.get(params.sessionId);
    if (!pendingSet) {
      pendingSet = new Set();
      this.pendingBySessionId.set(params.sessionId, pendingSet);
    }
    pendingSet.add(requestId);
    this.onPendingCountChangeEmitter.fire();

    // Emit event to show dialog
    this.onPermissionRequest.fire(params);

    // Wait for decision (no auto-timeout)
    return new Promise((resolve) => {
      this.pendingDecisions.set(requestId, {
        resolve,
        timeout: undefined,
      });
    });
  }

  /**
   * Handle user decision on permission request
   */
  handleUserDecision(requestId: string, optionId: string, optionKind: PermissionOptionKind): void {
    const pending = this.pendingDecisions.get(requestId);
    if (!pending) {
      return;
    }

    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }
    this.pendingDecisions.delete(requestId);

    const always = optionKind === 'allow_always' || optionKind === 'reject_always';
    const allow = optionKind === 'allow_once' || optionKind === 'allow_always';

    const decision: PermissionDecision = {
      type: allow ? 'allow' : 'reject',
      optionId,
      always,
    };

    // Clean up pending index
    const sessionId = this.requestIdToSessionId.get(requestId);
    if (sessionId) {
      const sessionSet = this.pendingBySessionId.get(sessionId);
      if (sessionSet) {
        sessionSet.delete(requestId);
        if (sessionSet.size === 0) {
          this.pendingBySessionId.delete(sessionId);
        }
      }
      this.requestIdToSessionId.delete(requestId);
      this.onPendingCountChangeEmitter.fire();
    }

    this.activeDialogs.delete(requestId);
    this.onPermissionResult.fire({ requestId, decision });
    pending.resolve(decision);
  }

  /**
   * Handle dialog close/timeout
   */
  handleDialogClose(requestId: string): void {
    const pending = this.pendingDecisions.get(requestId);
    if (!pending) {
      return;
    }

    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }
    this.pendingDecisions.delete(requestId);

    const decision: PermissionDecision = { type: 'timeout' };

    // Clean up pending index
    const sessionId = this.requestIdToSessionId.get(requestId);
    if (sessionId) {
      const sessionSet = this.pendingBySessionId.get(sessionId);
      if (sessionSet) {
        sessionSet.delete(requestId);
        if (sessionSet.size === 0) {
          this.pendingBySessionId.delete(sessionId);
        }
      }
      this.requestIdToSessionId.delete(requestId);
      this.onPendingCountChangeEmitter.fire();
    }

    this.activeDialogs.delete(requestId);
    this.onPermissionResult.fire({ requestId, decision });
    pending.resolve(decision);
  }

  /**
   * Cancel a pending permission request
   */
  cancelRequest(requestId: string): void {
    this.handleDialogClose(requestId);
  }

  /**
   * Get active dialog count
   */
  getActiveDialogCount(): number {
    return this.activeDialogs.size;
  }

  /**
   * Get active dialogs (for debugging)
   */
  getActiveDialogs(): PermissionDialogProps[] {
    return Array.from(this.activeDialogs.values());
  }

  /**
   * Clear all dialogs and pending decisions for a given session.
   * Called when a session is permanently deleted (clearSessionModel).
   */
  clearSessionDialogs(sessionId: string): void {
    const prefix = `${sessionId}:`;
    // Clear active dialogs
    for (const [requestId, dialog] of this.activeDialogs.entries()) {
      if (requestId === sessionId || requestId.startsWith(prefix)) {
        this.activeDialogs.delete(requestId);
      }
    }
    // Clear pending decisions (resolve as cancelled)
    for (const [requestId, pending] of this.pendingDecisions.entries()) {
      if (requestId === sessionId || requestId.startsWith(prefix)) {
        if (pending.timeout) {
          clearTimeout(pending.timeout);
        }
        this.pendingDecisions.delete(requestId);
        const decision: PermissionDecision = { type: 'cancelled' };
        this.onPermissionResult.fire({ requestId, decision });
        pending.resolve(decision);
      }
    }
    // Drop pending index entry for this session
    if (this.pendingBySessionId.delete(sessionId)) {
      this.onPendingCountChangeEmitter.fire();
    }
    // Also clean up the requestIdToSessionId map for this session's requests
    for (const [rid, sid] of this.requestIdToSessionId.entries()) {
      if (sid === sessionId) {
        this.requestIdToSessionId.delete(rid);
      }
    }
  }

  /**
   * Count of pending permission requests across all sessions EXCEPT the active one.
   */
  getPendingCountExcludingActive(): number {
    let count = 0;
    for (const [sid, set] of this.pendingBySessionId) {
      if (sid !== this.activeSessionId) {
        count += set.size;
      }
    }
    return count;
  }

  /**
   * Whether a specific session has any pending permission requests.
   */
  hasPendingForSession(sessionId: string): boolean {
    return (this.pendingBySessionId.get(sessionId)?.size ?? 0) > 0;
  }
}

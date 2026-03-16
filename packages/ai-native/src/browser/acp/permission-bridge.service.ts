import { Autowired, Injectable } from '@opensumi/di';
import { Emitter, Event, ILogger } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { PermissionDialogProps } from './permission-dialog.view';
import { PermissionDecision } from './permission.handler';

import type { PermissionOption, PermissionOptionKind } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

export interface ShowPermissionDialogParams {
  requestId: string;
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
      timeout: NodeJS.Timeout;
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

    // Emit event to show dialog
    this.onPermissionRequest.fire(params);

    // Set up timeout
    const timeout = setTimeout(() => {
      this.handleDialogClose(requestId);
    }, params.timeout);

    // Wait for decision
    return new Promise((resolve) => {
      this.pendingDecisions.set(requestId, {
        resolve,
        timeout,
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

    clearTimeout(pending.timeout);
    this.pendingDecisions.delete(requestId);

    const always = optionKind === 'allow_always' || optionKind === 'reject_always';
    const allow = optionKind === 'allow_once' || optionKind === 'allow_always';

    const decision: PermissionDecision = {
      type: allow ? 'allow' : 'reject',
      optionId,
      always,
    };

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

    clearTimeout(pending.timeout);
    this.pendingDecisions.delete(requestId);

    const decision: PermissionDecision = { type: 'timeout' };

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
}

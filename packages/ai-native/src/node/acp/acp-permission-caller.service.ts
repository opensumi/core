import { Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';

import type {
  AcpPermissionDecision,
  AcpPermissionDialogParams,
  IAcpPermissionService,
  PermissionOption,
  PermissionOptionKind,
  RequestPermissionRequest,
  RequestPermissionResponse,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

export const AcpPermissionCallerServiceToken = Symbol('AcpPermissionCallerServiceToken');

/**
 * ACP Permission Caller Service
 *
 * Node-side singleton that calls the browser-side permission dialog via RPC.
 *
 * IMPORTANT: This service exists in BOTH the parent injector (providers) AND the
 * child injector per connection (backServices). The child instance gets rpcClient
 * set by bindModuleBackService, but the parent instance does not. To bridge this,
 * the child instance stores its RPC stub in staticRpcClient so all instances
 * can use it.
 *
 * Each call to requestPermission() independently invokes
 * this.client or the shared static RPC stub — no global lock,
 * concurrent requests run independently.
 */
@Injectable()
export class AcpPermissionCallerService extends RPCService<IAcpPermissionService> {
  /**
   * Shared RPC stub for the current browser connection.
   * Populated by setStaticRpcClient() after bindModuleBackService
   * assigns serviceInstance.rpcClient = [stub].
   * This allows parent-injector consumers (e.g. PermissionRoutingService)
   * to reach the browser-side dialog via static access.
   */
  static staticRpcClient: IAcpPermissionService | undefined;

  /**
   * Set the shared static RPC client.
   * Called by bindModuleBackService (or equivalent) after setting rpcClient
   * on the child-injector instance, so that parent-injector consumers
   * can also reach the browser-side permission dialog.
   */
  static setStaticRpcClient(client: IAcpPermissionService | undefined): void {
    AcpPermissionCallerService.staticRpcClient = client;
  }

  /**
   * Get the RPC client from the shared static set by
   * bindModuleBackService on the child-injector instance.
   */
  private getRpcClient(): IAcpPermissionService | undefined {
    return this.client ?? AcpPermissionCallerService.staticRpcClient;
  }

  /**
   * Request permission from the user via browser dialog.
   *
   * @param params - The SDK RequestPermissionRequest from the agent.
   * @param sessionId - The session that owns this request.
   * @returns RequestPermissionResponse with the user's decision.
   */
  async requestPermission(params: RequestPermissionRequest, sessionId: string): Promise<RequestPermissionResponse> {
    // Check environment variable to skip permission confirmation
    if (process.env.SKIP_PERMISSION_CHECK === 'true') {
      const allowOptionId = this.findAllowOptionId(params.options);
      return {
        outcome: {
          outcome: 'selected' as const,
          optionId: allowOptionId,
        },
      };
    }

    const rpcClient = this.getRpcClient();
    if (!rpcClient) {
      throw new Error('[ACP Permission Caller] No active RPC client available');
    }

    const dialogParams: AcpPermissionDialogParams = {
      requestId: `${sessionId}:${params.toolCall.toolCallId}`,
      sessionId,
      title: params.toolCall.title ?? 'Permission Request',
      kind: params.toolCall.kind ?? undefined,
      content: this.buildPermissionContent(params),
      locations: params.toolCall.locations?.map((loc) => ({
        path: loc.path,
        line: loc.line ?? undefined,
      })),
      options: this.sortOptionsByKind(params.options),
      timeout: 60000,
    };

    const decision = await rpcClient.$showPermissionDialog(dialogParams);

    return this.buildPermissionResponse(decision, params.options);
  }

  /**
   * Cancel a pending permission request
   */
  async cancelRequest(requestId: string): Promise<void> {
    try {
      const rpcClient = this.getRpcClient();
      if (rpcClient) {
        await rpcClient.$cancelRequest(requestId);
      }
    } catch {
      // Silently ignore cancellation errors
    }
  }

  /**
   * Find the first "allow" option from the options list
   */
  private findAllowOptionId(options: PermissionOption[]): string {
    const allowOnce = options.find((o) => o.kind === 'allow_once');
    if (allowOnce) {
      return allowOnce.optionId;
    }
    const allowAlways = options.find((o) => o.kind === 'allow_always');
    if (allowAlways) {
      return allowAlways.optionId;
    }
    return options[0]?.optionId || '';
  }

  private buildPermissionContent(request: RequestPermissionRequest): string {
    const parts: string[] = [];

    if (request.toolCall.title) {
      parts.push(`${request.toolCall.title}`);
    }

    if (request.toolCall.locations?.length) {
      const files = request.toolCall.locations.map((loc) => loc.path).join(', ');
      parts.push(`Affected files: ${files}`);
    }

    const command = (request.toolCall.rawInput as Record<string, unknown>)?.command;
    if (command) {
      parts.push(`Command: \`${command}\``);
    }

    return parts.join('\n\n');
  }

  private buildPermissionResponse(
    decision: AcpPermissionDecision,
    options: PermissionOption[],
  ): RequestPermissionResponse {
    switch (decision.type) {
      case 'allow':
      case 'reject': {
        const optionId = decision.optionId ?? this.findOptionId(decision.type, options);
        return {
          outcome: {
            outcome: 'selected' as const,
            optionId,
          },
        };
      }
      case 'timeout':
      case 'cancelled':
        return {
          outcome: {
            outcome: 'cancelled' as const,
          },
        };
      default:
        return {
          outcome: {
            outcome: 'cancelled' as const,
          },
        };
    }
  }

  private findOptionId(decisionType: 'allow' | 'reject', options: PermissionOption[]): string {
    const kinds = decisionType === 'allow' ? ['allow_once', 'allow_always'] : ['reject_once', 'reject_always'];

    for (const kind of kinds) {
      const option = options.find((o) => o.kind === kind);
      if (option) {
        return option.optionId;
      }
    }

    const prefix = decisionType === 'allow' ? 'allow' : 'reject';
    const anyMatching = options.find((o) => o.kind.startsWith(prefix));
    if (anyMatching) {
      return anyMatching.optionId;
    }

    return options[0]?.optionId || '';
  }

  /**
   * Sort permission options by kind to ensure consistent display order.
   * Order: allow_always > allow_once > reject_always > reject_once
   */
  private sortOptionsByKind(options: PermissionOption[]): PermissionOption[] {
    const kindOrder: Record<PermissionOptionKind, number> = {
      allow_always: 0,
      allow_once: 1,
      reject_always: 2,
      reject_once: 3,
    };

    return [...options].sort((a, b) => {
      const orderA = kindOrder[a.kind] ?? Number.MAX_SAFE_INTEGER;
      const orderB = kindOrder[b.kind] ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });
  }
}

// ---------------------------------------------------------------------------
// Backward compatibility alias — existing code referencing
// AcpPermissionCallerManager / AcpPermissionCallerManagerToken continues to work.
// ---------------------------------------------------------------------------
/** @deprecated Use AcpPermissionCallerService instead */
export const AcpPermissionCallerManagerToken = AcpPermissionCallerServiceToken;

/** @deprecated Use AcpPermissionCallerService instead */
export type AcpPermissionCallerManager = AcpPermissionCallerService;

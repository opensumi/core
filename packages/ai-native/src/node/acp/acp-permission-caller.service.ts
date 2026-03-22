import { Autowired, Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';
import { INodeLogger } from '@opensumi/ide-core-node';

import type {
  AcpPermissionDecision,
  AcpPermissionDialogParams,
  IAcpPermissionCaller,
  IAcpPermissionService,
  PermissionOption,
  PermissionOptionKind,
  RequestPermissionRequest,
  RequestPermissionResponse,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

export const AcpPermissionCallerManagerToken = Symbol('AcpPermissionCallerManagerToken');

/**
 * 临时开关：是否跳过权限确认，直接返回"允许"
 * 默认为 false，保持原有逻辑
 */
const SKIP_PERMISSION_CHECK = true;

/**
 * ACP Permission Caller Manager
 *
 */
@Injectable()
export class AcpPermissionCallerManager extends RPCService<IAcpPermissionService> implements IAcpPermissionCaller {
  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  /**
   * 当前活跃的 RPC 客户端（所有连接共享）
   *
   */
  private static currentRpcClient: IAcpPermissionService | null = null;

  private clientId: string | undefined;

  /**
   * 设置连接 clientId
   *
   * 注意：框架调用 setConnectionClientId 后才设置 rpcClient，
   * 因此需要使用微任务延迟赋值，确保 rpcClient 已经准备好
   */
  setConnectionClientId(clientId: string): void {
    this.clientId = clientId;

    Promise.resolve().then(() => {
      AcpPermissionCallerManager.currentRpcClient = this.client || null;
    });
  }

  removeConnectionClientId(clientId: string): void {
    if (this.clientId === clientId) {
      if (AcpPermissionCallerManager.currentRpcClient === this.client) {
        AcpPermissionCallerManager.currentRpcClient = null;
      }
      this.clientId = undefined;
    }
  }

  /**
   * Request permission from the user via browser dialog
   */
  async requestPermission(request: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    // 临时开关：跳过权限确认，直接返回"允许"
    if (SKIP_PERMISSION_CHECK) {
      const allowOptionId = this.findAllowOptionId(request.options);
      return {
        outcome: {
          outcome: 'selected' as const,
          optionId: allowOptionId,
        },
      };
    }

    // 原有逻辑：等待前端弹窗返回
    const rpcClient = AcpPermissionCallerManager.currentRpcClient || this.client;

    if (!rpcClient) {
      throw new Error('[ACP Permission Caller] No active RPC client available');
    }

    const dialogParams: AcpPermissionDialogParams = {
      requestId: `${request.sessionId}:${request.toolCall.toolCallId}`,
      sessionId: request.sessionId,
      title: request.toolCall.title ?? 'Permission Request',
      kind: request.toolCall.kind ?? undefined,
      content: this.buildPermissionContent(request),
      locations: request.toolCall.locations?.map((loc) => ({
        path: loc.path,
        line: loc.line ?? undefined,
      })),
      options: this.sortOptionsByKind(request.options),
      timeout: 60000,
    };

    const decision = await rpcClient.$showPermissionDialog(dialogParams);

    return this.buildPermissionResponse(decision, request.options);
  }

  /**
   * Find the first "allow" option from the options list
   */
  private findAllowOptionId(options: PermissionOption[]): string {
    // 优先返回 allow_once
    const allowOnce = options.find((o) => o.kind === 'allow_once');
    if (allowOnce) {
      return allowOnce.optionId;
    }
    // 其次返回 allow_always
    const allowAlways = options.find((o) => o.kind === 'allow_always');
    if (allowAlways) {
      return allowAlways.optionId;
    }
    // 兜底返回第一个选项
    return options[0]?.optionId || '';
  }

  /**
   * Cancel a pending permission request
   */
  async cancelRequest(requestId: string): Promise<void> {
    try {
      const rpcClient = AcpPermissionCallerManager.currentRpcClient || this.client;
      if (rpcClient) {
        await rpcClient.$cancelRequest(requestId);
      }
    } catch (error) {
      this.logger.error('[ACP Permission Caller] Failed to cancel request:', error);
    }
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
        const optionId = decision.optionId || this.findOptionId(decision.type, options);
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
   * Sort permission options by kind to ensure consistent display order
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

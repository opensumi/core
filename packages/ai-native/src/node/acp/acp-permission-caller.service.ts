/**
 * ACP 权限请求服务（Node 端）
 *
 * 通过 RPC 向浏览器端发起权限确认请求，在用户当前活跃的 Browser Tab 中弹出权限对话框：
 * - 作为 BackService 在每个 RPC 连接（childInjector）中创建实例
 * - 使用静态变量 currentRpcClient 共享最新活跃连接的 rpcClient，
 *   解决主 Injector 中单例服务（AcpAgentRequestHandler）无法直接访问 childInjector 实例的问题
 * - 将 ACP RequestPermissionRequest 转换为前端 AcpPermissionDialogParams，并将用户决策映射回 RequestPermissionResponse
 * - 支持取消待处理的权限请求（cancelRequest）
 */
import { Autowired, Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';
import { INodeLogger } from '@opensumi/ide-core-node';

import { AcpPermissionDecision, AcpPermissionDialogParams, IAcpPermissionService } from '../../common';

import type {
  IAcpPermissionCaller,
  PermissionOption,
  RequestPermissionRequest,
  RequestPermissionResponse,
} from '../../common/acp-types';

export const AcpPermissionCallerManagerToken = Symbol('AcpPermissionCallerManagerToken');

/**
 * Node-side service for calling browser's ACP Permission RPC service
 *
 * ## 设计说明
 *
 * ### Injector 层级问题
 *
 * OpenSumi 使用两层 Injector 结构：
 * - **主 Injector**: 应用启动时创建，存放全局单例服务
 * - **Child Injector**: 每个 RPC 连接建立时创建，存放与特定连接相关的服务（backService）
 *
 * ### 问题
 *
 * - `AcpAgentRequestHandler` 作为单例在**主 Injector** 中创建
 * - `AcpPermissionCallerManager` 作为 backService，在**每个 childInjector** 中创建独立实例
 * - 当 `AcpAgentRequestHandler` 通过 `@Autowired` 注入 `AcpPermissionCallerManager` 时，
 *   会得到一个**新的、未初始化的实例**，而不是 childInjector 中与 RPC 连接关联的实例
 * - 结果：主 Injector 中的实例 `this.rpcClient` 永远是 `undefined`
 *
 * ### 解决方案
 *
 * 使用静态变量 `currentRpcClient` 共享 RPC client：
 * - 每个 childInjector 中的实例在连接建立时，将自身的 rpcClient 赋值给静态变量
 * - 调用 permission 相关方法时，优先使用静态变量中的 rpcClient
 * - 这样确保权限对话框在用户当前活跃的 Browser Tab 中显示
 *
 * ### 为什么这是合理的设计
 *
 * 1. **业务场景匹配**: 权限请求需要在用户当前活跃的 Browser Tab 中显示，
 *    最后一个建立 RPC 连接的 Tab 通常就是用户正在使用的 Tab
 * 2. **框架限制**: `AcpAgentRequestHandler` 处理的是 CLI Agent 的请求，与特定 RPC 连接无关，
 *    必须在主 Injector 中作为单例存在，无法使用 SessionDataStore 等需要 clientId 的机制
 * 3. **简单性**: 静态变量方案最简单，代码容易理解，没有额外的复杂机制
 *
 * @see {@link /docs/ai-native/architecture/injector-hierarchy.md} 详细设计文档
 */
@Injectable()
export class AcpPermissionCallerManager extends RPCService<IAcpPermissionService> implements IAcpPermissionCaller {
  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  /**
   * 当前活跃的 RPC 客户端（所有连接共享，使用最后一个建立连接的实例的 rpcClient）
   *
   * 静态变量，供单例服务（如 AcpAgentRequestHandler）注入的实例使用
   * 解决 Injector 层级问题：主 Injector 中的单例无法访问 childInjector 中的实例
   */
  private static currentRpcClient: IAcpPermissionService[] | null = null;

  /**
   * 当前实例对应的 clientId（Browser Tab ID）
   */
  private clientId: string | undefined;

  /**
   * 设置连接 clientId
   *
   * 在 RPC 连接建立时由框架自动调用
   *
   * 注意：框架调用 setConnectionClientId 后才设置 rpcClient，
   * 因此需要使用微任务延迟赋值，确保 rpcClient 已经准备好
   *
   * @param clientId - Browser Tab ID
   */
  setConnectionClientId(clientId: string): void {
    this.clientId = clientId;

    // 使用微任务延迟赋值，确保框架已经设置好 rpcClient
    Promise.resolve().then(() => {
      // 将当前实例的 rpcClient 复制到静态变量，供单例服务使用
      AcpPermissionCallerManager.currentRpcClient = this.rpcClient!;
    });
  }

  /**
   * 移除连接 clientId
   */
  removeConnectionClientId(clientId: string): void {
    if (this.clientId === clientId) {
      // 只有当当前实例的 rpcClient 是活跃的时才清除
      if (AcpPermissionCallerManager.currentRpcClient === this.rpcClient) {
        AcpPermissionCallerManager.currentRpcClient = null;
      }
      this.clientId = undefined;
    }
  }

  /**
   * Request permission from the user via browser dialog
   *
   * 使用静态 rpcClient（所有实例共享，当前活跃的 RPC 连接）
   *
   * 设计说明：
   * - 调用者（如 AcpAgentRequestHandler）是主 Injector 中的单例
   * - 它注入的 AcpPermissionCallerManager 不是 childInjector 中与 RPC 连接关联的实例
   * - 使用静态变量确保权限对话框在用户当前活跃的 Browser Tab 中显示
   */
  async requestPermission(request: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    // 使用静态 rpcClient，因为调用者（如 AcpAgentRequestHandler）是主 Injector 中的单例
    // 它注入的 AcpPermissionCallerManager 不是 childInjector 中与 RPC 连接关联的实例
    const rpcClient = AcpPermissionCallerManager.currentRpcClient || this.rpcClient;

    if (!rpcClient || rpcClient.length === 0) {
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
      options: request.options,
      timeout: 60000,
    };

    // Call browser-side RPC service via client proxy
    const decision = await rpcClient[0].$showPermissionDialog(dialogParams);

    // Build response based on user decision
    return this.buildPermissionResponse(decision, request.options);
  }

  /**
   * Cancel a pending permission request
   *
   * 使用静态 rpcClient（所有实例共享，当前活跃的 RPC 连接）
   */
  async cancelRequest(requestId: string): Promise<void> {
    try {
      const rpcClient = AcpPermissionCallerManager.currentRpcClient || this.rpcClient;
      if (rpcClient && rpcClient.length > 0) {
        await rpcClient[0].$cancelRequest(requestId);
      }
    } catch (error) {
      this.logger.error('[ACP Permission Caller] Failed to cancel request:', error);
    }
  }

  /**
   * Build content string from permission request
   */
  private buildPermissionContent(request: RequestPermissionRequest): string {
    const parts: string[] = [];

    if (request.toolCall.title) {
      parts.push(`**${request.toolCall.title}**`);
    }

    if (request.toolCall.locations && request.toolCall.locations.length > 0) {
      const files = request.toolCall.locations.map((loc) => loc.path).join(', ');
      parts.push(`Affected files: ${files}`);
    }

    if (request.toolCall.rawInput) {
      const input = request.toolCall.rawInput as Record<string, unknown>;
      if (input.command) {
        parts.push(`Command: \`${input.command}\``);
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Build permission response from user decision
   */
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

  /**
   * Find option ID by decision type (fallback)
   */
  private findOptionId(decisionType: 'allow' | 'reject', options: PermissionOption[]): string {
    const preferredKind = decisionType === 'allow' ? 'allow_once' : 'reject_once';
    const fallbackKind = decisionType === 'allow' ? 'allow_always' : 'reject_always';

    const preferred = options.find((o) => o.kind === preferredKind);
    if (preferred) {
      return preferred.optionId;
    }

    const fallback = options.find((o) => o.kind === fallbackKind);
    if (fallback) {
      return fallback.optionId;
    }

    const prefix = decisionType === 'allow' ? 'allow' : 'reject';
    const anyMatching = options.find((o) => o.kind.startsWith(prefix));
    if (anyMatching) {
      return anyMatching.optionId;
    }

    return options[0]?.optionId || '';
  }
}

export const AcpPermissionCallerManagerPath = 'AcpPermissionCallerManagerPath';
export const AcpPermissionServicePath = 'AcpPermissionServicePath';

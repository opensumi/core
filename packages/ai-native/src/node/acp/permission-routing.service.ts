import { Autowired, Injectable } from '@opensumi/di';
import { INodeLogger } from '@opensumi/ide-core-node';

import { AcpPermissionCallerService } from './acp-permission-caller.service';

import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

export const PermissionRoutingServiceToken = Symbol('PermissionRoutingServiceToken');

export interface IPermissionRoutingService {
  /** Register a session so it can receive permission requests */
  registerSession(sessionId: string): void;
  /** Unregister a session */
  unregisterSession(sessionId: string): void;
  /** Route a permission request to the appropriate session */
  routePermissionRequest(params: RequestPermissionRequest, sessionId: string): Promise<RequestPermissionResponse>;
}

/**
 * Permission Routing Service (Node, singleton)
 *
 * Routes permission requests from AcpThread instances to the browser
 * via AcpPermissionCallerService. Supports multi-session by validating
 * the sessionId is in registered sessions, returning 'cancelled' if not.
 *
 * Each call to routePermissionRequest() independently executes
 * this.permissionCallerService.requestPermission(params) — no global lock,
 * concurrent requests run independently, each session's result is
 * independently returned with no cross-contamination.
 */
@Injectable()
export class PermissionRoutingService implements IPermissionRoutingService {
  @Autowired(AcpPermissionCallerService)
  private readonly permissionCallerService: AcpPermissionCallerService;

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  private readonly registeredSessions = new Set<string>();

  registerSession(sessionId: string): void {
    this.registeredSessions.add(sessionId);
    this.logger.debug(`[PermissionRouting] Registered session: ${sessionId}`);
  }

  unregisterSession(sessionId: string): void {
    this.registeredSessions.delete(sessionId);
    this.logger.debug(`[PermissionRouting] Unregistered session: ${sessionId}`);
  }

  async routePermissionRequest(
    params: RequestPermissionRequest,
    sessionId: string,
  ): Promise<RequestPermissionResponse> {
    if (!this.registeredSessions.has(sessionId)) {
      this.logger.warn(
        '[PermissionRouting] No registered session for request, returning cancelled. ' +
          `Requested sessionId: ${sessionId}`,
      );
      return {
        outcome: {
          outcome: 'cancelled' as const,
        },
      };
    }

    this.logger.debug(
      `[PermissionRouting] Routing permission request to session: ${sessionId}, ` +
        `toolCall: ${params.toolCall.toolCallId}`,
    );

    return this.permissionCallerService.requestPermission(params, sessionId);
  }
}

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
  /** Set the active (fallback) session */
  setActiveSession(sessionId: string): void;
  /** Route a permission request to the appropriate session */
  routePermissionRequest(params: RequestPermissionRequest, sessionId: string): Promise<RequestPermissionResponse>;
}

/**
 * Permission Routing Service (Node, singleton)
 *
 * Routes permission requests from AcpThread instances to the browser
 * via AcpPermissionCallerService. Supports multi-session by:
 *
 * 1. Validating the sessionId is in registered sessions
 * 2. Falling back to the active session if no match
 * 3. Returning 'cancelled' if no session is available at all
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
  private activeSessionId: string | undefined;

  registerSession(sessionId: string): void {
    this.registeredSessions.add(sessionId);
    this.logger.debug(`[PermissionRouting] Registered session: ${sessionId}`);
  }

  unregisterSession(sessionId: string): void {
    this.registeredSessions.delete(sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = undefined;
    }
    this.logger.debug(`[PermissionRouting] Unregistered session: ${sessionId}`);
  }

  setActiveSession(sessionId: string): void {
    this.activeSessionId = sessionId;
    this.logger.debug(`[PermissionRouting] Active session set to: ${sessionId}`);
  }

  async routePermissionRequest(
    params: RequestPermissionRequest,
    sessionId: string,
  ): Promise<RequestPermissionResponse> {
    // Determine which session to route to
    const targetSession = this.resolveSession(sessionId);

    if (!targetSession) {
      this.logger.warn(
        '[PermissionRouting] No session available for request, returning cancelled. ' +
          `Requested sessionId: ${sessionId}`,
      );
      return {
        outcome: {
          outcome: 'cancelled' as const,
        },
      };
    }

    // Each call independently executes — no global lock.
    // Concurrent requests run independently with their own target session.
    this.logger.debug(
      `[PermissionRouting] Routing permission request to session: ${targetSession}, ` +
        `toolCall: ${params.toolCall.toolCallId}`,
    );

    return this.permissionCallerService.requestPermission(params, targetSession);
  }

  /**
   * Resolve the target session for a permission request.
   *
   * Priority:
   * 1. If sessionId is registered, use it (carries sessionId in permission request)
   * 2. If no match but active session exists, use active session as fallback
   * 3. If neither, return undefined (caller returns 'cancelled')
   */
  private resolveSession(sessionId: string): string | undefined {
    // Try the provided sessionId first
    if (this.registeredSessions.has(sessionId)) {
      return sessionId;
    }

    // Fall back to active session
    if (this.activeSessionId && this.registeredSessions.has(this.activeSessionId)) {
      return this.activeSessionId;
    }

    // As a last resort, if activeSessionId is set but not in registeredSessions,
    // still try to use it (it may have been registered after setActiveSession was called)
    if (this.activeSessionId) {
      return this.activeSessionId;
    }

    return undefined;
  }
}

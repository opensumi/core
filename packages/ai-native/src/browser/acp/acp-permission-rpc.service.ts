import { Autowired, Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection/lib/common/rpc-service';
import { ILogger } from '@opensumi/ide-core-common';

import { AcpPermissionDecision, AcpPermissionDialogParams, IAcpPermissionService } from '../../common';

import { AcpPermissionBridgeService } from './permission-bridge.service';

/**
 * Browser-side RPC service for ACP permission requests.
 * This service is called from the Node layer to show permission dialogs in the browser.
 *
 * @description
 * This RPC service bridges the Node.js ACP agent process with the browser UI.
 * When the agent needs user permission for a tool call (file write, command execution, etc.),
 * it calls this service which shows a dialog in the browser and returns the user's decision.
 */
@Injectable()
export class AcpPermissionRpcService extends RPCService implements IAcpPermissionService {
  @Autowired(AcpPermissionBridgeService)
  private permissionBridgeService: AcpPermissionBridgeService;

  @Autowired(ILogger)
  private logger: ILogger;

  constructor() {
    super();
  }

  /**
   * Show permission dialog and wait for user response
   * Called from Node layer via RPC
   */
  async $showPermissionDialog(params: AcpPermissionDialogParams): Promise<AcpPermissionDecision> {
    try {
      // Call the browser-side permission bridge service
      const decision = await this.permissionBridgeService.showPermissionDialog({
        requestId: params.requestId,
        title: params.title,
        kind: params.kind,
        content: params.content,
        locations: params.locations,
        command: params.command,
        options: params.options,
        timeout: params.timeout,
      });

      return decision;
    } catch (error) {
      return { type: 'cancelled' };
    }
  }

  /**
   * Cancel a pending permission request
   * Called from Node layer via RPC
   */
  async $cancelRequest(requestId: string): Promise<void> {
    this.permissionBridgeService.cancelRequest(requestId);
  }
}

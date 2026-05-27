import { Autowired, Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection/lib/common/rpc-service';
import { IAcpThreadStatusService } from '@opensumi/ide-core-common';

import { IChatManagerService } from '../../common';
import { ChatModel } from '../chat/chat-model';

/**
 * Browser-side RPC service for receiving thread status notifications from Node.
 * Called from the Node layer via RPC to push status updates to the browser.
 */
@Injectable()
export class AcpThreadStatusRpcService extends RPCService implements IAcpThreadStatusService {
  @Autowired(IChatManagerService)
  private chatManagerService: any;

  async $onThreadStatusChange(sessionId: string, status: string): Promise<void> {
    const lookupKey = sessionId.startsWith('acp:') ? sessionId : `acp:${sessionId}`;
    const model = this.chatManagerService.getSession?.(lookupKey) as ChatModel | undefined;
    if (model && typeof model.setThreadStatus === 'function') {
      model.setThreadStatus(status as any);
    }
  }
}

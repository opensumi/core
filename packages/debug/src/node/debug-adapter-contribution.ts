import { Autowired } from '@ali/common-di';
import {
  commonChannelPathHandler,
} from '@ali/ide-connection';

import { DebugAdapterPath } from '../common/debug-service';
import { RPCServiceCenter, ServerAppContribution, Domain } from '@ali/ide-core-node';
import { DebugAdapterSessionManager } from './debug-adapter-session-manager';

@Domain(ServerAppContribution)
export class DebugAdapterSessionContribution implements ServerAppContribution {

  @Autowired(DebugAdapterSessionManager)
  protected readonly sessionManager: DebugAdapterSessionManager;

  onStart() {
    const serviceCenter = new RPCServiceCenter();
    commonChannelPathHandler.register(`${DebugAdapterPath}/:id`, {
      handler: (connection, connectionClientId: string, {id}: {id: string}) => {
        const session = this.sessionManager.find(id);
        if (!session) {
            connection.close();
            return;
        }
        connection.onClose(() => session.stop());
        session.start(connection);
      },
      dispose: (connection?: any) => {
        if (connection) {
          serviceCenter.removeConnection(connection.messageConnection);
        }
      },
    });
  }
}

import { startServer } from '@opensumi/ide-dev-tool/src/server';
// eslint-disable-next-line import/order
import { CollaborationModule } from '@opensumi/ide-collaboration/lib/node';
import { ExpressFileServerModule } from '@opensumi/ide-express-file-server/lib/node';
import { OpenerModule } from '@opensumi/ide-remote-opener/lib/node';

import { CommonNodeModules } from '../../src/node/common-modules';

startServer({
  modules: [...CommonNodeModules, ExpressFileServerModule, OpenerModule, CollaborationModule],
});

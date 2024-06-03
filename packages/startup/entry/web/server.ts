import 'tsconfig-paths/register';

import { Injector } from '@opensumi/di';
import { AIBackSerivceToken } from '@opensumi/ide-core-common';
import { startServer } from '@opensumi/ide-dev-tool/src/server';
import { ExpressFileServerModule } from '@opensumi/ide-express-file-server/lib/node';
import { OpenerModule } from '@opensumi/ide-remote-opener/lib/node';

import { CommonNodeModules } from '../../src/node/common-modules';
import { AIBackService } from '../sample-modules/ai-native/ai.back.service';

const injector = new Injector([
  {
    token: AIBackSerivceToken,
    useClass: AIBackService,
  },
]);

startServer({
  modules: [...CommonNodeModules, ExpressFileServerModule, OpenerModule],
  injector,
});

/* eslint-disable no-console */
import path from 'path';

import { startServer } from '@opensumi/ide-dev-tool/src/server';
import { ExpressFileServerModule } from '@opensumi/ide-express-file-server/lib/node';

import { CommonNodeModules } from '../../../src/node/common-modules';

startServer(
  {
    modules: [...CommonNodeModules, ExpressFileServerModule],
  },
  {
    mountStaticPath: path.join(__dirname, '../../dist'),
  },
);

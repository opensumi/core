/* eslint-disable no-console */
import path from 'path';

import { Injector, Provider } from '@opensumi/di';
import { startServer } from '@opensumi/ide-dev-tool/src/server';
import { ExpressFileServerModule } from '@opensumi/ide-express-file-server/lib/node';
import { PtyServiceManagerToken } from '@opensumi/ide-terminal-next/lib/node/pty.manager';
import {
  PtyServiceManagerRemote,
  PtyServiceManagerRemoteOptions,
} from '@opensumi/ide-terminal-next/lib/node/pty.manager.remote';

import { CommonNodeModules } from '../../../src/node/common-modules';

const injectorProviders: Provider[] = [];

// Only override terminal pty manager to use remote proxy when env is provided.
if (process.env.PTY_PROXY_SOCK || process.env.PTY_PROXY_PORT) {
  injectorProviders.push(
    {
      token: PtyServiceManagerToken,
      useClass: PtyServiceManagerRemote,
    },
    {
      token: PtyServiceManagerRemoteOptions,
      useValue: {
        socketConnectOpts: process.env.PTY_PROXY_SOCK
          ? { path: process.env.PTY_PROXY_SOCK }
          : {
              port: Number(process.env.PTY_PROXY_PORT),
              host: process.env.PTY_PROXY_HOST,
            },
      },
    },
  );
}

const injector = new Injector(injectorProviders);

startServer(
  {
    modules: [...CommonNodeModules, ExpressFileServerModule],
    injector,
  },
  {
    mountStaticPath: path.join(__dirname, '../../dist'),
  },
);

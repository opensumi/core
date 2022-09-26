/* eslint-disable no-console */
import net from 'net';

import mri from 'mri';

import { Deferred } from '@opensumi/ide-core-common';
import { DEFAULT_OPENVSX_REGISTRY } from '@opensumi/ide-core-common/lib/const';
import { IServerAppOpts, ServerApp, NodeModule } from '@opensumi/ide-core-node';

const _argv = process.argv.slice(2);
const argv = mri(_argv);

export async function startServer(arg1: NodeModule[] | Partial<IServerAppOpts>) {
  const deferred = new Deferred<net.Server>();
  let opts: IServerAppOpts = {
    webSocketHandler: [],
    marketplace: {
      endpoint: DEFAULT_OPENVSX_REGISTRY,
      showBuiltinExtensions: true,
    },
  };
  if (Array.isArray(arg1)) {
    opts = {
      ...opts,
      modulesInstances: arg1,
    };
  } else {
    opts = {
      ...opts,
      ...arg1,
    };
  }

  const server = net.createServer();
  const listenPath = argv.listenPath;

  const serverApp = new ServerApp(opts);

  await serverApp.start(server);

  server.on('error', (err) => {
    deferred.reject(err);
    console.error('server error: ' + err.message);
    setTimeout(process.exit, 0, 1);
  });

  server.listen(listenPath, () => {
    console.log(`server listen on path ${listenPath}`);
    deferred.resolve(server);
  });

  await deferred.promise;
}

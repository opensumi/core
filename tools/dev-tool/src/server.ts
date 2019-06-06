import 'tsconfig-paths/register';
import { getLogger, ILogger } from '@ali/ide-core-common';
import { IServerAppOpts, ServerApp, NodeModule } from '@ali/ide-core-node';
import { LanguageHandler } from '@ali/ide-language/src/node/connection-handler';
import { TerminalHandler } from '@ali/ide-terminal-server';
import * as path from 'path';

process.env.WORKSPACE_DIR = path.join(__dirname, '../../workspace');
export async function startServer(arg1: NodeModule[] | IServerAppOpts) {
  const logger: ILogger = getLogger();
  let opts: IServerAppOpts = {
    webSocketHandler: [
      new TerminalHandler(logger),
      new LanguageHandler(),
    ],
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

  const app = new ServerApp(opts);

  await app.start();
  return app;
}

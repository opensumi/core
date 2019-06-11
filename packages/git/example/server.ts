import { startServer } from '@ali/ide-dev-tool/src/server';
import { GitModule } from '../src/node';
const moduleInstance = new GitModule();
startServer([ moduleInstance ]);

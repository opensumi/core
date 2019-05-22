import { startServer } from '@ali/ide-dev-tool/src/server';
import { StatusBarModule } from '../src/node';
const moduleInstance = new StatusBarModule();
startServer([ moduleInstance ]);

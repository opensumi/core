import { startServer } from '@ali/ide-dev-tool/src/server';
import { ActivatorBarModule } from '../src/node';
const moduleInstance = new ActivatorBarModule();
startServer([ moduleInstance ]);

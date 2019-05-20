import { startServer } from '@ali/ide-dev-tool/src/server';
import { MonacoModule } from '../src/node';
const moduleInstance = new MonacoModule();
startServer([ moduleInstance ]);

import { startServer } from '@ali/ide-dev-tool/src/server';
import { FileServiceModule } from '../src/node';
const moduleInstance = new FileServiceModule();
startServer([ moduleInstance ]);

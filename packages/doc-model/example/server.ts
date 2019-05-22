import { startServer } from '@ali/ide-dev-tool/src/server';
import { DocModelModule } from '../src/node';
const moduleInstance = new DocModelModule();
startServer([ moduleInstance ]);

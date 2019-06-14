import { startServer } from '@ali/ide-dev-tool/src/server';
import { SearchModule } from '../src/node';
const moduleInstance = new SearchModule();
startServer([ moduleInstance ]);

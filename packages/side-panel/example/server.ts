import { startServer } from '@ali/ide-dev-tool/src/server';
import { SidePanelModule } from '../src/node';
const moduleInstance = new SidePanelModule();
startServer([ moduleInstance ]);

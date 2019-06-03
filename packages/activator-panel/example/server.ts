import { startServer } from '@ali/ide-dev-tool/src/server';
import { ActivatorPanelModule } from '../src/node';
const moduleInstance = new ActivatorPanelModule();
startServer([ moduleInstance ]);

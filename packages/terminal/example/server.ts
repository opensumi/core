import { startServer } from '@ali/ide-dev-tool/src/server';
import { TerminalModule } from '../src/node';
const moduleInstance = new TerminalModule();
startServer([ moduleInstance ]);

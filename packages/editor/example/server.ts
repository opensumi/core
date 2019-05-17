import { startServer } from '@ali/ide-dev-tool/src/server';
import { EditorModule } from '../src/node';
const moduleInstance = new EditorModule();
startServer([ moduleInstance ]);

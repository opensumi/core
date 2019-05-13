import { startServer } from '@ali/ide-dev-tool/src/server';
import { TemplateUpperNameModule } from '../src/node';
const moduleInstance = new TemplateUpperNameModule();
startServer([ moduleInstance ]);

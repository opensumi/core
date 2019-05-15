import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { FileServiceModule } from '../src/browser';
const moduleInstance = new FileServiceModule();
renderApp(moduleInstance);

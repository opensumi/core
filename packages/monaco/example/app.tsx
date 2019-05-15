import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { MonacoModule } from '../src/browser';
const moduleInstance = new MonacoModule();
renderApp(moduleInstance);

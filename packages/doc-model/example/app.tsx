import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { DocModelModule } from '../src/browser';
const moduleInstance = new DocModelModule();
renderApp(moduleInstance);

import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { EditorModule } from '../src/browser';
const moduleInstance = new EditorModule();
renderApp(moduleInstance);

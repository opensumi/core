import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { FileSchemeModule } from '../src/browser';

renderApp({
  modules: [ FileSchemeModule ],
});

import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { ConnectionModule } from '../src/browser';

renderApp({
  modules: [ ConnectionModule ],
});

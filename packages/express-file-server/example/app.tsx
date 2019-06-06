import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { ExpressFileServerModule } from '../src/browser';

renderApp({
  modules: [ ExpressFileServerModule ],
});

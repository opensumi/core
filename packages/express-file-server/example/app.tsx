import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { ExpressFileServerModule } from '@ali/ide-common-config';

renderApp({
  modules: [ ExpressFileServerModule ],
});

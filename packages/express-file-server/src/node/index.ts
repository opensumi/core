import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import * as Koa from 'koa';
import * as koaStatic from 'koa-static';

@Injectable()
export class ExpressFileServerModule extends NodeModule {
  providers: Provider[] = [];

  onConfigureServer(app: Koa) {
    // TODO multiple server
    console.log('WTF');
    console.log(process.env.WORKSPACE_DIR);
    app.use(require('koa-static')(process.env.WORKSPACE_DIR));
  }
}

import { ServerAppContribution, Domain, IServerApp, AppConfig} from '@ali/ide-core-node';
import { Autowired } from '@ali/common-di';
const mount = require('koa-mount');

@Domain(ServerAppContribution)
export class ExpressFileServerContribution implements ServerAppContribution {

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  initialize(app: IServerApp) {
    app.use(require('koa-static')(this.appConfig.workspaceDir));
    // console.log(this.appConfig);
    if (this.appConfig.coreExtensionDir) {
      app.use(mount('/ext', require('koa-static')(this.appConfig.coreExtensionDir)));
    }
    if (this.appConfig.extensionDir) {
      app.use(mount('/extension', require('koa-static')(this.appConfig.extensionDir)));
    }
  }
}

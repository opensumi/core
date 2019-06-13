import { ServerAppContribution, Domain, IServerApp, AppConfig} from '@ali/ide-core-node';
import { Autowired } from '@ali/common-di';

@Domain(ServerAppContribution)
export class ExpressFileServerContribution implements ServerAppContribution {

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  initialize(app: IServerApp) {
    app.use(require('koa-static')(this.appConfig.workspaceDir));
  }
}

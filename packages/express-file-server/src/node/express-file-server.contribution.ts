import { ServerAppContribution, Domain} from '@ali/ide-core-node';

@Domain(ServerAppContribution)
export class ExpressFileServerContribution implements ServerAppContribution {
  initialize(app) {
    app.use(require('koa-static')(process.env.WORKSPACE_DIR));
  }
}

import { ServerAppContribution, Domain, IServerApp, AppConfig} from '@ali/ide-core-node';
import { Autowired } from '@ali/common-di';
import { ALLOW_MIME } from '../common';
import * as mount from 'koa-mount';
import * as fs from 'fs';
import * as path from 'path';

@Domain(ServerAppContribution)
export class ExpressFileServerContribution implements ServerAppContribution {

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  getWhiteList() {
    return [
      this.appConfig.workspaceDir,
      this.appConfig.coreExtensionDir,
      // 内置插件目录
      this.appConfig.extensionDir,
      // 插件市场安装目录
      this.appConfig.marketplace.extensionDir,
      path.join(__dirname, '../../../../'),
    ];
  }

  initialize(app: IServerApp) {
    app.use(mount('/assets', async (ctx) => {
      const { path: filePath } = ctx.query;
      if (!path) {
        ctx.status = 404;
        return;
      }

      const whitelist = this.getWhiteList();
      const contentType = ALLOW_MIME[path.extname(filePath).slice(1)];
      if (
        // 地址在白名单内
        whitelist.some((whitelistPath) => whitelistPath && filePath.startsWith(whitelistPath))
        // 在允许的 contentType
        && contentType
      ) {
        ctx.set('Content-Type', contentType);
        if (this.appConfig.staticAllowOrigin) {
          ctx.set('Access-Control-Allow-Origin', this.appConfig.staticAllowOrigin);
        }
        ctx.body = fs.createReadStream(filePath);
      } else {
        ctx.status = 403;
      }
    }));

  }
}

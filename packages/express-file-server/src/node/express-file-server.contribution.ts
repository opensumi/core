import fs from 'fs';
import path from 'path';

import mount from 'koa-mount';

import { Autowired } from '@opensumi/di';
import { ServerAppContribution, Domain, IServerApp, AppConfig } from '@opensumi/ide-core-node';

import { ALLOW_MIME } from '../common';


@Domain(ServerAppContribution)
export class ExpressFileServerContribution implements ServerAppContribution {
  @Autowired(AppConfig)
  private appConfig: AppConfig;

  getWhiteList() {
    return [
      // 插件市场安装目录
      this.appConfig.marketplace.extensionDir,
      ...(this.appConfig.staticAllowPath || []),
    ];
  }

  initialize(app: IServerApp) {
    app.use(
      mount('/assets', async (ctx) => {
        const filePath = decodeURI(ctx.path.replace(/^\/assets/, ''));
        if (!filePath) {
          ctx.status = 404;
          return;
        }

        const whitelist = this.getWhiteList();
        const contentType = ALLOW_MIME[path.extname(filePath).slice(1)];
        if (
          /**
           * 地址在白名单内
           * Windows 下 C:\\Path\\to\\file 会被转换成 c:\\Path\\to\\file
           */
          whitelist.some(
            (whitelistPath) => whitelistPath && filePath.toLowerCase().startsWith(whitelistPath.toLowerCase()),
          ) &&
          // 在允许的 contentType
          contentType
        ) {
          ctx.set('Content-Type', contentType);
          if (this.appConfig.staticAllowOrigin) {
            ctx.set('Access-Control-Allow-Origin', this.appConfig.staticAllowOrigin);
          }
          ctx.body = fs.createReadStream(filePath);
        } else {
          ctx.status = 403;
        }
      }),
    );
  }
}

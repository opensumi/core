import fs from 'fs';
import path from 'path';

import mount from 'koa-mount';

import { Autowired } from '@opensumi/di';
import { AppConfig, Domain, IServerApp, ServerAppContribution, URI } from '@opensumi/ide-core-node';

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
        const uriPath = decodeURI(ctx.path.replace(/^\/assets/, ''));
        if (!uriPath) {
          ctx.status = 404;
          return;
        }

        const filePath = URI.parse(`file://${uriPath}`).codeUri.fsPath;
        const whitelist = this.getWhiteList();
        const contentType = ALLOW_MIME[path.extname(filePath).slice(1).toLowerCase()];
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
          const range = ctx.headers.range;

          if (!fs.existsSync(filePath)) {
            ctx.status = 404;
            ctx.body = '文件未找到';
            return;
          }

          if (this.appConfig.staticAllowOrigin) {
            ctx.set('Access-Control-Allow-Origin', this.appConfig.staticAllowOrigin);
          }

          const stats = await fs.promises.stat(filePath);
          const total = stats.size;

          if (!range) {
            ctx.status = 200;
            ctx.set('Content-Type', contentType);
            ctx.set('Content-Length', String(total));
            ctx.body = fs.createReadStream(filePath);
            return;
          }

          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : total - 1;

          if (start >= total || end >= total || start > end) {
            ctx.status = 416; // Range Not Satisfiable
            ctx.set('Content-Range', `bytes */${total}`);
            return;
          }

          ctx.status = 206;
          ctx.set('Content-Range', `bytes ${start}-${end}/${total}`);
          ctx.set('Accept-Ranges', 'bytes');
          ctx.set('Content-Length', String(end - start + 1));
          ctx.set('Content-Type', contentType);

          const stream = fs.createReadStream(filePath, { start, end });
          ctx.body = stream;
        } else {
          ctx.status = 403;
        }
      }),
    );
  }
}

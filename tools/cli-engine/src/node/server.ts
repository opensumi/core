/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-console */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { promisify } from 'util';

import cors from '@koa/cors';
import ejs from 'ejs';
import Koa from 'koa';
import mount from 'koa-mount';

import { IClientAppOpts } from '@opensumi/ide-core-browser';
import { Deferred, LogLevel } from '@opensumi/ide-core-common';
import { DEFAULT_OPENVSX_REGISTRY } from '@opensumi/ide-core-common/lib/const';
import { IServerAppOpts, ServerApp } from '@opensumi/ide-core-node';

import * as env from './env';
import { openBrowser } from './openBrowser';

const ALLOW_MIME = {
  gif: 'image/gif',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  eot: 'font/eot',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  js: 'application/javascript',
  css: 'text/css',
};

const CLI_DEVELOPMENT_PATH = env.CLI_DEVELOPMENT_PATH;
const deviceIp = env.CLIENT_IP;

const extensionDir = path.join(CLI_DEVELOPMENT_PATH, 'extensions');

interface IDEServerParams {
  serverAppOpts?: Partial<IServerAppOpts>;
  clientAppOpts?: Partial<IClientAppOpts>;
}

interface ServerParams {
  port: number;
  isDev: boolean;
  workspaceDir?: string;
  extensionCandidate?: string[];
  extHostPath?: string;
  watchServerPort?: string;
}

async function readPkgUp() {
  const pkgJsonStr = await promisify(fs.readFile)(path.resolve(__dirname, '../../package.json'), 'utf8');
  try {
    return JSON.parse(pkgJsonStr);
  } catch (err) {
    console.warn('json parse failed with:', pkgJsonStr);
    console.warn(err);
  }
  return {};
}

export async function startServer(serverParams: ServerParams, ideAppOpts: IDEServerParams) {
  const {
    port = 50999,
    workspaceDir = __dirname,
    extensionCandidate = [__dirname],
    isDev,
    extHostPath,
    watchServerPort,
  } = serverParams;

  if (isDev) {
    process.env.IS_DEV = '1';
  }

  process.env.EXT_MODE = 'js';
  process.env.KTLOG_SHOW_DEBUG = '1';

  const app = new Koa();
  const deferred = new Deferred<http.Server>();

  // @ts-ignore
  app.use(cors());
  let opts: IServerAppOpts = {
    webSocketHandler: [],
    use: app.use.bind(app),
    marketplace: {
      endpoint: DEFAULT_OPENVSX_REGISTRY,
      showBuiltinExtensions: true,
      extensionDir: path.join(CLI_DEVELOPMENT_PATH, 'extensions'),
    },
    extHost: extHostPath || path.join(__dirname, '../hosted/ext.process.js'),
    logDir: path.join(CLI_DEVELOPMENT_PATH, 'logs'),
    logLevel: LogLevel.Verbose,
    staticAllowPath: [extensionDir, ...extensionCandidate],
  };

  if (ideAppOpts.serverAppOpts) {
    opts = {
      ...opts,
      ...ideAppOpts.serverAppOpts,
    };
  }

  const serverApp = new ServerApp(opts);
  const server = http.createServer(app.callback());
  await serverApp.start(server);

  app.use(
    mount<{}>('/', async (ctx) => {
      console.log('REQUEST URL:', ctx.url);
      let staticPath;
      let _path = ctx.url;
      if (_path.startsWith('/webview')) {
        staticPath = path.join(__dirname, `./${_path.split('?')[0]}`);
      } else if (_path === '/' || _path.endsWith('.html')) {
        _path = '/index.html';
        staticPath = path.join(__dirname, '../browser/index.html');
      } else {
        staticPath = path.join(__dirname, `../browser${_path}`);
      }

      const contentType = ALLOW_MIME[path.extname(_path).slice(1)];
      if (!fs.existsSync(staticPath)) {
        console.warn(`Load ${staticPath} failed.`);
        ctx.status = 404;
        ctx.body = 'Not Found.';
        return;
      }

      let content = fs.readFileSync(staticPath).toString();

      if (_path === '/index.html') {
        const assets = fs.readFileSync(path.join(__dirname, '../browser/assets.json')).toString();

        const config = {
          ideWorkspaceDir: workspaceDir,
          extensionDir,
          extensionCandidate,
          port,
          wsPath: `ws://${deviceIp}:${port}`,
          staticServicePath: `http://${deviceIp}:${port}`,
          webviewEndpoint: `http://${deviceIp}:${port}/webview`,
          watchServerPath: `ws://${deviceIp}:${watchServerPort}`,
        };

        const pkg = await readPkgUp();

        const meta = {
          ideVersion: pkg.dependencies['@opensumi/ide-core-common'],
          engineVersion: pkg.version,
        };

        content = ejs.compile(
          content,
          {},
        )({
          config,
          meta,
          assets: JSON.parse(assets),
          clientAppOpts: ideAppOpts.clientAppOpts || {},
        });
      }
      ctx.set('Content-Type', contentType);
      ctx.body = content;
    }),
  );

  server.on('error', (err) => {
    deferred.reject(err);
    console.error('server error: ' + err.message);
    setTimeout(process.exit, 0, 1);
  });

  server.listen(port, () => {
    console.log(`Server listen on port ${port}`);
    openBrowser(`http://${deviceIp}:${port}`);

    console.log(`
      The service started successfully, please click http://${deviceIp}:${port} to access the OpenSumi IDE.
    `);

    deferred.resolve(server);
  });
  return deferred.promise;
}

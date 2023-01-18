import path from 'path';
import fs from 'fs';

import { modules } from './modules';
import { startServer } from './server';

const argv = require('yargs-parser')(process.argv.slice(2));

const {
  serverPort,
  workspaceDir,
  extensionCandidate,
  isDev,
  extHostPath,
  watchServerPort,
} = argv;

let serverAppOpts = {
  modules,
};

let clientAppOpts = {};

/**
 * opensumi-dev.config.js 用于在插件开发时自定义一些 opensumi client 及 server 端的默认配置
 * 当传入多个 extensionDir 时，优先取第一个插件目录下的 opensumi-dev.config.js
 */
const extensions = strToArray(extensionCandidate);

const opensumiDevConfigPath = path.resolve(extensions[0], 'opensumi-dev.config.js');
// read `opensumi-dev.config.js`
if (fs.existsSync(opensumiDevConfigPath)) {
  const opensumiDevConfig = require(opensumiDevConfigPath);
  serverAppOpts = {
    ...serverAppOpts,
    ...opensumiDevConfig.serverAppOpts,
  };
  clientAppOpts = { ...opensumiDevConfig.clientAppOpts };
}

startServer({
  port: Number(serverPort as string),
  isDev: !!isDev,
  workspaceDir: workspaceDir as string,
  extensionCandidate: extensionCandidate ? strToArray(extensionCandidate as string | string[]) : undefined,
  extHostPath: extHostPath as string,
  watchServerPort,
}, {
  serverAppOpts,
  clientAppOpts,
});

function strToArray(item: string | string[]): string[] {
  return Array.isArray(item) ? item : [item];
}

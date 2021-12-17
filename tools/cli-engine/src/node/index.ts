import path from 'path';
import fs from 'fs';

import { modules } from './modules';
import { startServer } from './server';

const argv = require('yargs-parser')(process.argv.slice(2));

const { serverPort, workspaceDir, extensionCandidate, isDev, extHostPath, watchServerPort } = argv;

let serverAppOpts = {
  modules,
};

let clientAppOpts = {};

/**
 * kaitian-dev.config.js 用于在插件开发时自定义一些 ide-framework client 及 server 端的默认配置
 * 当传入多个 extensionDir 时，优先取第一个插件目录下的 kaitian-dev.config.js
 */
const extensions = strToArray(extensionCandidate);

const kaitianDevConfigPath = path.resolve(extensions[0], 'kaitian-dev.config.js');
// read `kaitian-dev.config.js`
if (fs.existsSync(kaitianDevConfigPath)) {
  const kaitianDevConfig = require(kaitianDevConfigPath);
  serverAppOpts = {
    ...serverAppOpts,
    ...kaitianDevConfig.serverAppOpts,
  };
  clientAppOpts = { ...kaitianDevConfig.clientAppOpts };
}

startServer(
  {
    port: Number(serverPort as string),
    isDev: !!isDev,
    workspaceDir: workspaceDir as string,
    extensionCandidate: extensionCandidate ? strToArray(extensionCandidate as string | string[]) : undefined,
    extHostPath: extHostPath as string,
    watchServerPort,
  },
  {
    serverAppOpts,
    clientAppOpts,
  },
);

function strToArray(item: string | string[]): string[] {
  return Array.isArray(item) ? item : [item];
}

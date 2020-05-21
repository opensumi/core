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
} = argv;

let serverAppOpts = {
  modules,
};

let clientAppOpts = {};

const kaitianDevConfigPath = path.resolve(workspaceDir, 'kaitian-dev.config.js');
// read `kaitian-dev.config.js`
if (fs.existsSync(kaitianDevConfigPath)) {
  const kaitianDevConfig = require(kaitianDevConfigPath);
  serverAppOpts = {
    ...serverAppOpts,
    ...kaitianDevConfig.serverAppOpts,
  };
  clientAppOpts = { ...kaitianDevConfig.clientAppOpts };
}

startServer({
  port: Number(serverPort as string),
  isDev: !!isDev,
  workspaceDir: workspaceDir as string,
  extensionCandidate: extensionCandidate ? strToArray(extensionCandidate as string | string[]) : undefined,
  extHostPath: extHostPath as string,
}, {
  serverAppOpts,
  clientAppOpts,
});

function strToArray(item: string | string[]): string[] {
  return Array.isArray(item) ? item : [item];
}

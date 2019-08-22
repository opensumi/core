import { ElectronMainApp } from '@ali/ide-core-electron-main';
import { URI, isDevelopment } from '@ali/ide-core-common';
import { join } from 'path';

const electronApp = new ElectronMainApp({
  browserNodeIntegrated: true,
  browserUrl: URI.file(join(__dirname, './browser/dist/index.html')).toString(),
  modules: [],
  nodeEntry: join(__dirname, './node/index' + (isDevelopment() ? '.ts' : '.js')),
});

electronApp.init().then(() => {
  electronApp.loadWorkspace(join(__dirname, '../../../../tools/workspace'));
});

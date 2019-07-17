import { ElectronMainApp } from '@ali/ide-core-electron-main';
import { URI } from '@ali/ide-core-common';
import { join } from 'path';

const electronApp = new ElectronMainApp({
  browserNodeIntegrated: false,
  browserUrl: URI.file(join(__dirname, './dist/index.html')).toString(),
  modules: [],
  nodeEntry: join(__dirname, './src/node/index.ts'),
});

electronApp.init().then(() => {
  electronApp.loadWorkspace(join(__dirname, '../workspace'));
});

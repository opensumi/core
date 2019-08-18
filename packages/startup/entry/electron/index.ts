import { ElectronMainApp } from '@ali/ide-core-electron-main';
import { URI } from '@ali/ide-core-common';
import { join } from 'path';

const electronApp = new ElectronMainApp({
  browserNodeIntegrated: true,
  browserUrl: URI.file(join(__dirname, './browser/dist/index.html')).toString(),
  modules: [],
  nodeEntry: join(__dirname, './node/index.ts'),
});

electronApp.init().then(() => {
  electronApp.loadWorkspace(join(__dirname, '../../../../tools/workspace'));
});

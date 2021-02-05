import { ElectronMainApp } from '@ali/ide-core-electron-main';
import { URI, isDevelopment } from '@ali/ide-core-common';
import { join } from 'path';
import { app } from 'electron';
// import { ElectronMainWorkspaceModule } from '@ali/ide-workspace/lib/electron-main';

const electronApp = new ElectronMainApp({
  browserNodeIntegrated: true,
  browserUrl: URI.file(join(__dirname, '../browser/index.html')).toString(),
  modules: [
    // ElectronMainWorkspaceModule,
  ],
  nodeEntry: join(__dirname, '../node/index.js'),
  extensionEntry: join(__dirname, '../extension/index.js'),
  extensionWorkerEntry: join(__dirname, '../extension/index.worker.js'),
  webviewPreload: join(__dirname, '../webview/host-preload.js'),
  plainWebviewPreload: join(__dirname, '../webview/plain-preload.js'),
  browserPreload: join(__dirname, '../browser/preload.js'),
  extensionDir: join(__dirname, '../../../../extensions'), // 相对于app/dist的路径
  extensionCandidate: [],
  overrideWebPreferences: {},
});

electronApp.init().then(() => {
  electronApp.loadWorkspace();
});

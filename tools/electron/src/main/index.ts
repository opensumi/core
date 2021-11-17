import { app } from 'electron';
import { ElectronMainApp } from '@ide-framework/ide-core-electron-main';
import { URI } from '@ide-framework/ide-core-common';
import { join } from 'path';
import { MainModule } from './services';
import { WebviewElectronMainModule } from '@ide-framework/ide-webview/lib/electron-main';
// import { ElectronMainWorkspaceModule } from '@ide-framework/ide-workspace/lib/electron-main';

const getExtensionDir = () => {
  const appPath = app.getAppPath();
  if (appPath.indexOf('app.asar') > -1) {
    return join(appPath, './../extensions');
  }
  return join(appPath, './extensions'); // 相对于app的路径
};

const electronApp = new ElectronMainApp({
  browserNodeIntegrated: false,
  browserUrl: URI.file(join(__dirname, '../browser/index.html')).toString(),
  modules: [
    MainModule,
    WebviewElectronMainModule,
    // ElectronMainWorkspaceModule,
  ],
  nodeEntry: join(__dirname, '../node/index.js'),
  extensionEntry: join(__dirname, '../extension/index.js'),
  extensionWorkerEntry: join(__dirname, '../extension/index.worker.js'),
  webviewPreload: join(__dirname, '../webview/host-preload.js'),
  plainWebviewPreload: join(__dirname, '../webview/plain-preload.js'),
  browserPreload: join(__dirname, '../browser/preload.js'),
  extensionDir: getExtensionDir(),
  extensionCandidate: [],
  overrideWebPreferences: {},
});

electronApp.init().then(() => {
  electronApp.loadWorkspace();
});

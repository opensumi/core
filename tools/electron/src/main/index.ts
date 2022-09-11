import { join } from 'path';

import { app } from 'electron';

import { URI } from '@opensumi/ide-core-common';
import { ElectronMainApp } from '@opensumi/ide-core-electron-main';
import { WebviewElectronMainModule } from '@opensumi/ide-webview/lib/electron-main';

const getExtensionDir = () => {
  const appPath = app.getAppPath();
  if (appPath.indexOf('app.asar') > -1) {
    return join(appPath, './../extensions');
  }
  return join(appPath, '../extensions');
};

const electronApp = new ElectronMainApp({
  browserNodeIntegrated: false,
  browserUrl: URI.file(join(__dirname, '../browser/index.html')).toString(),
  modules: [WebviewElectronMainModule],
  nodeEntry: join(__dirname, '../node/index.js'),
  extensionEntry: join(__dirname, '../extension/index.js'),
  extensionWorkerEntry: join(__dirname, '../extension/index.worker.js'),
  webviewPreload: join(__dirname, '../webview/host-preload.js'),
  plainWebviewPreload: join(__dirname, '../webview/plain-preload.js'),
  browserPreload: join(__dirname, '../browser/preload.js'),
  extensionDir: getExtensionDir(),
  extensionCandidate: [],
  overrideWebPreferences: {},
  devtools: true, // 开启 core-electron-main 对 OpenSumi DevTools 的支持，默认为关闭
});

electronApp.init().then(() => {
  electronApp.loadWorkspace();
});

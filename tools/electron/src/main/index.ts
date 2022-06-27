import { join } from 'path';

import { app, session } from 'electron';

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
});

electronApp.init().then(() => {
  electronApp.loadWorkspace();

  //   const devtronPath = join(require('os').homedir(), 'Projects/ASOC2022/devtron');
  //   session.defaultSession.loadExtension(devtronPath);

  const opensumicrxPath = join(require('os').homedir(), 'Projects/ASOC2022/opensumi/opensumi-crx/build');
  session.defaultSession.loadExtension(opensumicrxPath);
});

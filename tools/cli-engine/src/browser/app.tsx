/* eslint-disable no-console */
import { Injector } from '@opensumi/di';
import { IClientAppOpts } from '@opensumi/ide-core-browser';
import { ClientApp } from '@opensumi/ide-core-browser/lib/bootstrap/app';

export async function renderApp(opts: IClientAppOpts) {
  const { hostname } = window.location;
  const specificIp = ['0.0.0.0', '127.0.0.1', 'localhost'].every((n) => n !== hostname);

  const guessedConfig = {} as any;
  if (!specificIp) {
    const port = (window as any).SUMI_SDK_CONFIG.port;

    guessedConfig.wsPath = `ws://${hostname}:${port}`;
    guessedConfig.staticServicePath = `http://${hostname}:${port}`;
    guessedConfig.webviewEndpoint = `http://${hostname}:${port}/webview`;
  }

  const injector = new Injector();

  //
  // 兼容历史版本
  // 老版本 cli 中不支持 extensionDevelopmentPath，是通过 extensionCandidate 实现的
  //
  if ((window as any).SUMI_SDK_CONFIG.extensionCandidate) {
    const extensions: string[] = [...(window as any).SUMI_SDK_CONFIG.extensionCandidate].filter(Boolean);
    opts.extensionCandidate = extensions.map((e) => ({ path: e, isBuiltin: true, isDevelopment: true }));
    opts.extensionDevelopmentHost = true;
  }

  opts.workspaceDir = (window as any).SUMI_SDK_CONFIG.ideWorkspaceDir;
  opts.extensionDir = (window as any).SUMI_SDK_CONFIG.extensionDir;

  opts.wsPath = guessedConfig.wsPath || (window as any).SUMI_SDK_CONFIG.wsPath;
  opts.staticServicePath = guessedConfig.staticServicePath || (window as any).SUMI_SDK_CONFIG.staticServicePath;
  opts.webviewEndpoint = guessedConfig.webviewEndpoint || (window as any).SUMI_SDK_CONFIG.webviewEndpoint;

  opts.extWorkerHost = './worker-host.js';

  opts.injector = injector;
  const app = new ClientApp(opts);

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  await app.start(document.getElementById('main')!, 'web');

  const watchServerPath = (window as any).SUMI_SDK_CONFIG.watchServerPath;
  if (watchServerPath) {
    const ws = new WebSocket(watchServerPath);

    ws.addEventListener('message', (e) => {
      if (e.data) {
        try {
          const data = JSON.parse(e.data);
          if (['change', 'rename'].includes(data.event)) {
            console.log(`Receive ${data.event} event for ${data.filename}, reload window...`);
            setTimeout(() => {
              window.location.reload();
            }, 3000);
          }
        } catch (err) {
          console.warn('parse event error \n', err);
        }
      }
    });
  }
}

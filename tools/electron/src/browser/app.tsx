console.time('Render');
import { ClientApp, IClientAppOpts, electronEnv, URI } from '@opensumi/ide-core-browser';
import { Injector, Domain } from '@opensumi/di';
import { createSocketConnection } from '@opensumi/ide-connection';

// 引入公共样式文件
import '@opensumi/ide-core-browser/lib/style/index.less';
// 引入本地icon，不使用cdn版本，与useCdnIcon配套使用
import '@opensumi/ide-core-browser/lib/style/icon.less';
import { IElectronMainLifeCycleService } from '@opensumi/ide-core-common/lib/electron';

export async function renderApp(main: Domain, modules?: Domain[]);
export async function renderApp(opts: IClientAppOpts);
export async function renderApp(arg1: IClientAppOpts | Domain, arg2: Domain[] = []) {
  let opts: IClientAppOpts;
  let modules: Domain[];

  const injector = new Injector();

  if (typeof arg1 === 'string') {
    modules = [arg1, ...arg2];
    // TODO 支持只传入一个模块的方式
    opts = { modules: [] };
  } else {
    opts = arg1 as IClientAppOpts;
  }

  opts.workspaceDir = electronEnv.env.WORKSPACE_DIR;
  opts.extensionDir = electronEnv.metadata.extensionDir;
  opts.isRemote = electronEnv.metadata.isRemote;
  opts.injector = injector;
  if (electronEnv.metadata.workerHostEntry) {
    opts.extWorkerHost = URI.file(electronEnv.metadata.workerHostEntry).toString();
  }
  opts.didRendered = () => {
    console.timeEnd('Render');
    const loadingDom = document.getElementById('loading');
    if (loadingDom) {
      loadingDom.classList.add('loading-hidden');
      loadingDom.remove();
    }
  };

  const app = new ClientApp(opts);

  // 拦截reload行为
  app.fireOnReload = () => {
    injector.get(IElectronMainLifeCycleService).reloadWindow(electronEnv.currentWindowId);
  };

  const netConnection = await (window as any).createRPCNetConnection();
  app.start(document.getElementById('main')!, 'electron', createSocketConnection(netConnection));
}

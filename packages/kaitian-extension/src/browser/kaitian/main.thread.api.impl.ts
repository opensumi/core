import { IRPCProtocol } from '@ali/ide-connection';
import { Injector } from '@ali/common-di';
import { MainThreaLifeCycle } from './main.thread.lifecycle';
import { MainThreadKaitianAPIIdentifier } from '../../common/kaitian';
import { MainThreadLayout } from './main.thread.layout';
import { Disposable } from '@ali/ide-core-common';
import { MainThreadTheme } from './main.thread.theme';
import { MainThreadCommon } from './main.thread.common';
import { MainThreadToolbar } from './main.thread.toolbar';

export function createKaitianApiFactory(
  rpcProtocol: IRPCProtocol,
  injector: Injector,
) {
  const disposer = new Disposable();
  const lifeCycle = injector.get(MainThreaLifeCycle, [rpcProtocol, injector]);

  const mainThreadTheme = injector.get(MainThreadTheme, [rpcProtocol, injector]);
  disposer.addDispose(mainThreadTheme);

  const layout = injector.get(MainThreadLayout, [rpcProtocol]);
  disposer.addDispose(layout);

  const common = injector.get(MainThreadCommon, [rpcProtocol, injector]);
  disposer.addDispose(common);

  const toolbar = injector.get(MainThreadToolbar);
  disposer.addDispose(toolbar);

  rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadLifecycle, lifeCycle);
  rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadTheme, mainThreadTheme);
  rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadLayout, layout);
  rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadCommon, common);
  rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadToolbar, toolbar);

  return () => {
    disposer.dispose();
    // do dispose
  };
}

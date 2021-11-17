import { IRPCProtocol } from '@ide-framework/ide-connection';
import { Injector } from '@ide-framework/common-di';
import { MainThreaLifeCycle } from './main.thread.lifecycle';
import { MainThreadKaitianAPIIdentifier } from '../../common/kaitian';
import { MainThreadLayout } from './main.thread.layout';
import { Disposable } from '@ide-framework/ide-core-common';
import { MainThreadTheme } from './main.thread.theme';
import { MainThreadCommon } from './main.thread.common';
import { MainThreadToolbar } from './main.thread.toolbar';
import { MainThreadIDEWindow } from './main.thread.window';

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

  const window = injector.get(MainThreadIDEWindow, [rpcProtocol]);
  disposer.addDispose(window);

  rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadLifecycle, lifeCycle);
  rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadTheme, mainThreadTheme);
  rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadLayout, layout);
  rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadCommon, common);
  rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadToolbar, toolbar);
  rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadIDEWindow, window);

  return () => {
    disposer.dispose();
    // do dispose
  };
}

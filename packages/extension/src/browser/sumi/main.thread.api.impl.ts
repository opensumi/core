import { Injector } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { Disposable } from '@opensumi/ide-core-common';

import { MainThreadSumiAPIIdentifier } from '../../common/sumi';

import { MainThreadCommon } from './main.thread.common';
import { MainThreadLayout } from './main.thread.layout';
import { MainThreadLifeCycle } from './main.thread.lifecycle';
import { MainThreadTheme } from './main.thread.theme';
import { MainThreadToolbar } from './main.thread.toolbar';
import { MainThreadIDEWindow } from './main.thread.window';

export function createSumiApiFactory(rpcProtocol: IRPCProtocol, injector: Injector) {
  const disposer = new Disposable();
  const lifeCycle = injector.get(MainThreadLifeCycle, [injector]);

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

  rpcProtocol.set(MainThreadSumiAPIIdentifier.MainThreadLifecycle, lifeCycle);
  rpcProtocol.set(MainThreadSumiAPIIdentifier.MainThreadTheme, mainThreadTheme);
  rpcProtocol.set(MainThreadSumiAPIIdentifier.MainThreadLayout, layout);
  rpcProtocol.set(MainThreadSumiAPIIdentifier.MainThreadCommon, common);
  rpcProtocol.set(MainThreadSumiAPIIdentifier.MainThreadToolbar, toolbar);
  rpcProtocol.set(MainThreadSumiAPIIdentifier.MainThreadIDEWindow, window);

  return () => {
    disposer.dispose();
    // do dispose
  };
}

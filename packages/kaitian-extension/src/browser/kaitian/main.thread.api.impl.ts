import { IRPCProtocol } from '@ali/ide-connection';
import { Injector, Injectable } from '@ali/common-di';
import { MainThreaLifeCycle } from './main.thread.lifecycle';
import { MainThreadKaitianAPIIdentifier } from '../../common/kaitian';
import { MainThreaLayout } from './main.thread.layout';
import { Disposable } from '@ali/ide-core-common';
import { MainThreadTheme } from './main.thread.theme';

export function createKaitianApiFactory(
  rpcProtocol: IRPCProtocol,
  injector: Injector,
) {
  const disposer = new Disposable();
  const lifeCycle = injector.get(MainThreaLifeCycle, [rpcProtocol, injector]);
  const mainThreadTheme = injector.get(MainThreadTheme, [rpcProtocol, injector]);
  const layout = injector.get(MainThreaLayout, [rpcProtocol, injector]);
  disposer.addDispose(mainThreadTheme);

  rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadLifecycle, lifeCycle);
  rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadTheme, mainThreadTheme);
  rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadLayout, layout);

  return () => {
    disposer.dispose();
    // do dispose
  };
}

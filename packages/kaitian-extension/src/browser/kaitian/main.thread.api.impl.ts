import { IRPCProtocol } from '@ali/ide-connection';
import { Injector, Injectable } from '@ali/common-di';
import { MainThreaLifeCycle } from './main.thread.lifecycle';
import { MainThreadKaitianAPIIdentifier } from '../../common/kaitian';
import { Disposable } from '@ali/ide-core-common';
import { MainThreadTheme } from './main.thread.theme';

export function createKaitianApiFactory(
  rpcProtocol: IRPCProtocol,
  injector: Injector,
) {
  const disposer = new Disposable();
  const lifeCycle = injector.get(MainThreaLifeCycle, [rpcProtocol, injector]);
  const mainThreadTheme = injector.get(MainThreadTheme, [rpcProtocol, injector]);
  disposer.addDispose(mainThreadTheme);

  rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadLifecycle, lifeCycle);
  rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadTheme, mainThreadTheme);

  return () => {
    disposer.dispose();
    // do dispose
  };
}

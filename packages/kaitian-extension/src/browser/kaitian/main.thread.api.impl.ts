import { IRPCProtocol } from '@ali/ide-connection';
import { Injector, Injectable } from '@ali/common-di';
import { MainThreaLifeCycle } from './main.thread.lifecycle';
import { MainThreadKaitianAPIIdentifier } from '../../common/kaitian';

export function createKaitianApiFactory(
  rpcProtocol: IRPCProtocol,
  injector: Injector,
) {
  const lifeCycle = injector.get(MainThreaLifeCycle, [rpcProtocol, injector]);

  rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadLifecycle, lifeCycle);
  return () => {
    // do dispose
  };
}

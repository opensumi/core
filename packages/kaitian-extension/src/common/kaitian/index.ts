import { createMainContextProxyIdentifier, createExtHostContextProxyIdentifier } from '@ali/ide-connection';
import { IMainThreadLifeCycle, IExtHostLifeCycle } from './lifecycle';

export const MainThreadKaitianAPIIdentifier = {
  MainThreadLifecycle: createMainContextProxyIdentifier<IMainThreadLifeCycle>('MainThreadLifeCycle'),
};

export const ExtHostKaitianAPIIdentifier = {
  ExtHostLifeCycle: createExtHostContextProxyIdentifier<IExtHostLifeCycle>('ExtHostLifeCycle'),
};

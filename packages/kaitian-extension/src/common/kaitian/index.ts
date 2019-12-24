import { createMainContextProxyIdentifier, createExtHostContextProxyIdentifier } from '@ali/ide-connection';
import { IMainThreadLifeCycle, IExtHostLifeCycle } from './lifecycle';
import { IExtHostTheme, IMainThreadTheme } from './theme';

export const MainThreadKaitianAPIIdentifier = {
  MainThreadLifecycle: createMainContextProxyIdentifier<IMainThreadLifeCycle>('MainThreadLifeCycle'),
  MainThreadTheme: createMainContextProxyIdentifier<IMainThreadTheme>('MainThreadTheme'),
};

export const ExtHostKaitianAPIIdentifier = {
  ExtHostLifeCycle: createExtHostContextProxyIdentifier<IExtHostLifeCycle>('ExtHostLifeCycle'),
  ExtHostTheme: createExtHostContextProxyIdentifier<IExtHostTheme>('ExtHostTheme'),
};

import { createExtHostContextProxyIdentifier, createMainContextProxyIdentifier } from '@opensumi/ide-connection';

import { IExtHostCommon, IMainThreadCommon } from './common';
import { IExtHostLayout, IMainThreadLayout } from './layout';
import { IExtHostLifeCycle, IMainThreadLifeCycle } from './lifecycle';
import { IExtHostTheme, IMainThreadTheme } from './theme';
import { IExtHostToolbar, IMainThreadToolbar } from './toolbar';
import { IExtHostIDEWindow, IMainThreadIDEWindow } from './window';

export const MainThreadSumiAPIIdentifier = {
  MainThreadLifecycle: createMainContextProxyIdentifier<IMainThreadLifeCycle>('MainThreadLifeCycle'),
  MainThreadTheme: createMainContextProxyIdentifier<IMainThreadTheme>('MainThreadTheme'),
  MainThreadLayout: createMainContextProxyIdentifier<IMainThreadLayout>('MainThreadLayout'),
  MainThreadCommon: createMainContextProxyIdentifier<IMainThreadCommon>('MainThreadCommon'),
  MainThreadToolbar: createMainContextProxyIdentifier<IMainThreadToolbar>('MainThreadToolbar'),
  MainThreadIDEWindow: createMainContextProxyIdentifier<IMainThreadIDEWindow>('MainThreadIDEWindow'),
};

export const ExtHostSumiAPIIdentifier = {
  ExtHostLifeCycle: createExtHostContextProxyIdentifier<IExtHostLifeCycle>('ExtHostLifeCycle'),
  ExtHostLayout: createExtHostContextProxyIdentifier<IExtHostLayout>('ExtHostLayout'),
  ExtHostTheme: createExtHostContextProxyIdentifier<IExtHostTheme>('ExtHostTheme'),
  ExtHostCommon: createExtHostContextProxyIdentifier<IExtHostCommon>('ExtHostCommon'),
  ExtHostToolbar: createExtHostContextProxyIdentifier<IExtHostToolbar>('ExtHostToolbar'),
  ExtHostIDEWindow: createExtHostContextProxyIdentifier<IExtHostIDEWindow>('ExtHostIDEWindow'),
};

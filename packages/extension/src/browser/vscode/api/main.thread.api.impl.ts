import { Injector } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';

import {
  IMainThreadTasks,
  IMainThreadTerminal,
  IMainThreadTesting,
  MainThreadAPIIdentifier,
  VSCodeExtensionService,
} from '../../../common/vscode';

import { MainThreadConnection } from './main.thread.connection';
import { MainThreadDebug } from './main.thread.debug';
import { MainThreadTasks } from './main.thread.tasks';
import { MainThreadTerminal } from './main.thread.terminal';
import { MainThreadTestsImpl } from './main.thread.tests';
import { MainThreadTreeView } from './main.thread.treeview';
import { MainThreadWindow } from './main.thread.window';
import { MainThreadWindowState } from './main.thread.window-state';

export function initNodeThreadAPIProxy(
  rpcProtocol: IRPCProtocol,
  injector: Injector,
  extensionService: VSCodeExtensionService,
) {
  rpcProtocol.set<VSCodeExtensionService>(MainThreadAPIIdentifier.MainThreadExtensionService, extensionService);

  const MainThreadTreeViewAPI = injector.get(MainThreadTreeView, [rpcProtocol, 'node']);
  const MainThreadWindowStateAPI = injector.get(MainThreadWindowState, [rpcProtocol]);
  const MainThreadWindowAPI = injector.get(MainThreadWindow, [rpcProtocol]);
  const MainThreadConnectionAPI = injector.get(MainThreadConnection, [rpcProtocol]);
  const MainThreadDebugAPI = injector.get(MainThreadDebug, [rpcProtocol, MainThreadConnectionAPI]);
  const MainThreadTerminalAPI = injector.get(MainThreadTerminal, [rpcProtocol]);
  const MainThreadTasksAPI = injector.get(MainThreadTasks, [rpcProtocol]);
  const MainthreadTestAPI = injector.get(MainThreadTestsImpl, [rpcProtocol]);

  rpcProtocol.set<MainThreadTreeView>(MainThreadAPIIdentifier.MainThreadTreeView, MainThreadTreeViewAPI);
  rpcProtocol.set<MainThreadWindowState>(MainThreadAPIIdentifier.MainThreadWindowState, MainThreadWindowStateAPI);
  rpcProtocol.set<MainThreadWindow>(MainThreadAPIIdentifier.MainThreadWindow, MainThreadWindowAPI);
  rpcProtocol.set<MainThreadConnection>(MainThreadAPIIdentifier.MainThreadConnection, MainThreadConnectionAPI);
  rpcProtocol.set<MainThreadDebug>(MainThreadAPIIdentifier.MainThreadDebug, MainThreadDebugAPI);
  rpcProtocol.set<IMainThreadTerminal>(MainThreadAPIIdentifier.MainThreadTerminal, MainThreadTerminalAPI);
  rpcProtocol.set<IMainThreadTasks>(MainThreadAPIIdentifier.MainThreadTasks, MainThreadTasksAPI);
  rpcProtocol.set<IMainThreadTesting>(MainThreadAPIIdentifier.MainThreadTests, MainthreadTestAPI);

  return () => {
    MainThreadTreeViewAPI.dispose();
    MainThreadWindowStateAPI.dispose();
    MainThreadWindowAPI.dispose();
    MainThreadConnectionAPI.dispose();
    MainThreadDebugAPI.dispose();
    MainThreadTerminalAPI.dispose();
    MainThreadTasksAPI.dispose();
    MainthreadTestAPI.dispose();
  };
}

export function initWorkerThreadAPIProxy(
  rpcProtocol: IRPCProtocol,
  injector: Injector,
  extensionService: VSCodeExtensionService,
) {
  rpcProtocol.set<VSCodeExtensionService>(MainThreadAPIIdentifier.MainThreadExtensionService, extensionService);

  const MainThreadTreeViewAPI = injector.get(MainThreadTreeView, [rpcProtocol, 'worker']);
  rpcProtocol.set<MainThreadTreeView>(MainThreadAPIIdentifier.MainThreadTreeView, MainThreadTreeViewAPI);

  return () => {
    MainThreadTreeViewAPI.dispose();
  };
}

import {
  MainThreadAPIIdentifier,
  IMainThreadCommands,
  IMainThreadLanguages,
  IMainThreadMessage,
  IMainThreadPreference,
  IMainThreadWorkspace,
  IMainThreadEnv,
  IMainThreadQuickOpen,
  IMainThreadStorage,
  IMainThreadOutput,
  IMainThreadWebview,
  IMainThreadTerminal,
} from '../../../common/vscode'; // '../../common';
import { MainThreadCommands } from './main.thread.commands';
import { MainThreadExtensionDocumentData } from './main.thread.doc';
import { Injector } from '@ali/common-di';
import { VSCodeExtensionService } from '../../../common/vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { MainThreadLanguages } from './main.thread.language';
import { MainThreadStatusBar } from './main.thread.statusbar';
import { MainThreadMessage } from './main.thread.message';
import { MainThreadEditorService } from './main.thread.editor';
import { MainThreadPreference } from './main.thread.preference';
import { MainThreadWorkspace } from './main.thread.workspace';
import { MainThreadEnv } from './main.thread.env';
import { MainThreadQuickOpen } from './main.thread.quickopen';
import { MainThreadStorage } from './main.thread.storage';
import { MainThreadOutput } from './main.thread.output';
import { MainThreadFileSystem } from './main.thread.file-system';
import { MainThreadWebview } from './main.thread.api.webview';
import { MainThreadSCM } from './main.thread.scm';
import { MainThreadTreeView } from './main.thread.treeview';
import { MainThreadDecorations } from './main.thread.decoration';
import { MainThreadWindowState } from './main.thread.window-state';
import { MainThreadDebug } from './main.thread.debug';
import { MainThreadConnection } from './main.thread.connection';
import { MainThreadTerminal } from './main.thread.terminal';

export function createApiFactory(
  rpcProtocol: IRPCProtocol,
  injector: Injector,
  extensionService: VSCodeExtensionService,
) {

  const MainThreadLanguagesAPI = injector.get(MainThreadLanguages, [rpcProtocol]);
  const MainThreadCommandsAPI = injector.get(MainThreadCommands, [rpcProtocol]);
  const MainThreadExtensionDocumentDataAPI = injector.get(MainThreadExtensionDocumentData, [rpcProtocol]);
  const MainThreadEditorServiceAPI = injector.get(MainThreadEditorService, [rpcProtocol]);
  const MainThreadStatusBarAPI = injector.get(MainThreadStatusBar, [rpcProtocol]);
  const MainThreadMessageAPI = injector.get(MainThreadMessage, [rpcProtocol]);
  const MainThreadWorkspaceAPI = injector.get(MainThreadWorkspace, [rpcProtocol]);
  const MainThreadPreferenceAPI = injector.get(MainThreadPreference, [rpcProtocol]);
  const MainThreadEnvAPI = injector.get(MainThreadEnv, [rpcProtocol]);
  const MainThreadQuickOpenAPI = injector.get(MainThreadQuickOpen, [rpcProtocol]);
  const MainThreadStorageAPI = injector.get(MainThreadStorage, [rpcProtocol]);
  const MainThreadOutputAPI = injector.get(MainThreadOutput, [rpcProtocol]);
  const MainThreadFileSystemAPI = injector.get(MainThreadFileSystem, [rpcProtocol]);
  const MainThreadWebviewAPI = injector.get(MainThreadWebview, [rpcProtocol]);
  const MainThreadSCMAPI = injector.get(MainThreadSCM, [rpcProtocol]);
  const MainThreadTreeViewAPI = injector.get(MainThreadTreeView, [rpcProtocol]);
  const MainThreadDecorationsAPI = injector.get(MainThreadDecorations, [rpcProtocol]);
  const MainThreadWindowStateAPI = injector.get(MainThreadWindowState, [rpcProtocol]);
  const MainThreadConnectionAPI = injector.get(MainThreadConnection, [rpcProtocol]);
  const MainThreadDebugAPI = injector.get(MainThreadDebug, [rpcProtocol, MainThreadConnectionAPI]);
  const MainThreadTerminalAPI = injector.get(MainThreadTerminal, [rpcProtocol]);

  rpcProtocol.set<VSCodeExtensionService>(MainThreadAPIIdentifier.MainThreadExtensionServie, extensionService);
  rpcProtocol.set<IMainThreadCommands>(MainThreadAPIIdentifier.MainThreadCommands, MainThreadCommandsAPI);
  rpcProtocol.set<IMainThreadLanguages>(MainThreadAPIIdentifier.MainThreadLanguages, MainThreadLanguagesAPI);
  rpcProtocol.set<MainThreadExtensionDocumentData>(MainThreadAPIIdentifier.MainThreadDocuments, MainThreadExtensionDocumentDataAPI);
  rpcProtocol.set<MainThreadEditorService>(MainThreadAPIIdentifier.MainThreadEditors, MainThreadEditorServiceAPI);
  rpcProtocol.set<MainThreadStatusBar>(MainThreadAPIIdentifier.MainThreadStatusBar, MainThreadStatusBarAPI);
  rpcProtocol.set<IMainThreadMessage>(MainThreadAPIIdentifier.MainThreadMessages, MainThreadMessageAPI);
  rpcProtocol.set<IMainThreadWorkspace>(MainThreadAPIIdentifier.MainThreadWorkspace, MainThreadWorkspaceAPI);
  rpcProtocol.set<IMainThreadPreference>(MainThreadAPIIdentifier.MainThreadPreference, MainThreadPreferenceAPI);
  rpcProtocol.set<IMainThreadEnv>(MainThreadAPIIdentifier.MainThreadEnv, MainThreadEnvAPI);
  rpcProtocol.set<IMainThreadQuickOpen>(MainThreadAPIIdentifier.MainThreadQuickOpen, MainThreadQuickOpenAPI);
  rpcProtocol.set<IMainThreadStorage>(MainThreadAPIIdentifier.MainThreadStorage, MainThreadStorageAPI);
  rpcProtocol.set<IMainThreadOutput>(MainThreadAPIIdentifier.MainThreadOutput, MainThreadOutputAPI);
  rpcProtocol.set<MainThreadFileSystem>(MainThreadAPIIdentifier.MainThreadFileSystem, MainThreadFileSystemAPI);
  rpcProtocol.set<IMainThreadWebview>(MainThreadAPIIdentifier.MainThreadWebview, MainThreadWebviewAPI);
  rpcProtocol.set<MainThreadSCM>(MainThreadAPIIdentifier.MainThreadSCM, MainThreadSCMAPI);
  rpcProtocol.set<MainThreadTreeView>(MainThreadAPIIdentifier.MainThreadTreeView, MainThreadTreeViewAPI);
  rpcProtocol.set<MainThreadDecorations>(MainThreadAPIIdentifier.MainThreadDecorations, MainThreadDecorationsAPI);
  rpcProtocol.set<MainThreadWindowState>(MainThreadAPIIdentifier.MainThreadWindowState, MainThreadWindowStateAPI);
  rpcProtocol.set<MainThreadConnection>(MainThreadAPIIdentifier.MainThreadConnection, MainThreadConnectionAPI);
  rpcProtocol.set<MainThreadDebug>(MainThreadAPIIdentifier.MainThreadDebug, MainThreadDebugAPI);
  rpcProtocol.set<IMainThreadTerminal>(MainThreadAPIIdentifier.MainThreadTerminal, MainThreadTerminalAPI);

  return () => {
    MainThreadLanguagesAPI.dispose();
    MainThreadCommandsAPI.dispose();
    MainThreadExtensionDocumentDataAPI.dispose();
    MainThreadEditorServiceAPI.dispose();
    MainThreadStatusBarAPI.dispose();
    MainThreadMessageAPI.dispose();
    MainThreadWorkspaceAPI.dispose();
    MainThreadPreferenceAPI.dispose();
    MainThreadEnvAPI.dispose();
    MainThreadQuickOpenAPI.dispose();
    MainThreadStorageAPI.dispose();
    MainThreadOutputAPI.dispose();
    MainThreadFileSystemAPI.dispose();
    MainThreadWebviewAPI.dispose();
    MainThreadSCMAPI.dispose();
    MainThreadTreeViewAPI.dispose();
    MainThreadDecorationsAPI.dispose();
    MainThreadWindowStateAPI.dispose();
    MainThreadDebugAPI.dispose();
    MainThreadTerminalAPI.dispose();
  };
}

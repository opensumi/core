import { Injector } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';

import { IMainThreadExtensionLog, MainThreadExtensionLogIdentifier } from '../../../common/extension-log';
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
  IMainThreadProgress,
  IMainThreadTasks,
  IMainThreadComments,
  IMainThreadUrls,
  IMainThreadTheming,
  IMainThreadCustomEditor,
  IMainThreadAuthentication,
  IMainThreadWebviewView,
  IMainThreadSecret,
  IMainThreadTesting,
  IMainThreadEditorTabsShape,
} from '../../../common/vscode'; // '../../common';
import { VSCodeExtensionService } from '../../../common/vscode';

import { MainThreadProgress } from './main.thread.api.progress';
import { MainThreadWebview, MainThreadWebviewView } from './main.thread.api.webview';
import { MainThreadAuthentication } from './main.thread.authentication';
import { MainThreadCommands } from './main.thread.commands';
import { MainthreadComments } from './main.thread.comments';
import { MainThreadConnection } from './main.thread.connection';
import { MainThreadCustomEditor } from './main.thread.custom-editor';
import { MainThreadDebug } from './main.thread.debug';
import { MainThreadDecorations } from './main.thread.decoration';
import { MainThreadExtensionDocumentData } from './main.thread.doc';
import { MainThreadEditorService } from './main.thread.editor';
import { MainThreadEditorTabsService } from './main.thread.editor-tabs';
import { MainThreadEnv } from './main.thread.env';
import { MainThreadFileSystem } from './main.thread.file-system';
import { MainThreadFileSystemEvent } from './main.thread.file-system-event';
import { MainThreadLanguages } from './main.thread.language';
import { MainThreadExtensionLog } from './main.thread.log';
import { MainThreadMessage } from './main.thread.message';
import { MainThreadOutput } from './main.thread.output';
import { MainThreadPreference } from './main.thread.preference';
import { MainThreadQuickOpen } from './main.thread.quickopen';
import { MainThreadSCM } from './main.thread.scm';
import { MainThreadSecret } from './main.thread.secret';
import { MainThreadStatusBar } from './main.thread.statusbar';
import { MainThreadStorage } from './main.thread.storage';
import { MainthreadTasks } from './main.thread.tasks';
import { MainThreadTerminal } from './main.thread.terminal';
import { MainThreadTestsImpl } from './main.thread.tests';
import { MainThreadTheming } from './main.thread.theming';
import { MainThreadTreeView } from './main.thread.treeview';
import { MainThreadUrls } from './main.thread.urls';
import { MainThreadWindow } from './main.thread.window';
import { MainThreadWindowState } from './main.thread.window-state';
import { MainThreadWorkspace } from './main.thread.workspace';

export async function createApiFactory(
  rpcProtocol: IRPCProtocol,
  injector: Injector,
  extensionService: VSCodeExtensionService,
) {
  const MainThreadLanguagesAPI = injector.get(MainThreadLanguages, [rpcProtocol]);
  const MainThreadCommandsAPI = injector.get(MainThreadCommands, [rpcProtocol]);
  const MainThreadExtensionDocumentDataAPI = injector.get(MainThreadExtensionDocumentData, [rpcProtocol]);
  const MainThreadEditorServiceAPI = injector.get(MainThreadEditorService, [
    rpcProtocol,
    MainThreadExtensionDocumentDataAPI,
  ]);
  const MainThreadStatusBarAPI = injector.get(MainThreadStatusBar, [rpcProtocol]);
  const MainThreadMessageAPI = injector.get(MainThreadMessage, [rpcProtocol]);
  const MainThreadWorkspaceAPI = injector.get(MainThreadWorkspace, [rpcProtocol]);
  const MainThreadPreferenceAPI = injector.get(MainThreadPreference, [rpcProtocol]);
  const MainThreadStorageAPI = injector.get(MainThreadStorage, [rpcProtocol]);
  const MainThreadEnvAPI = injector.get(MainThreadEnv, [rpcProtocol, MainThreadStorageAPI]);
  const MainThreadQuickOpenAPI = injector.get(MainThreadQuickOpen, [rpcProtocol]);
  const MainThreadOutputAPI = injector.get(MainThreadOutput);
  const MainThreadFileSystemAPI = injector.get(MainThreadFileSystem, [rpcProtocol]);
  const MainThreadFileSystemEventAPI = injector.get(MainThreadFileSystemEvent, [rpcProtocol]);
  const MainThreadWebviewAPI = injector.get(MainThreadWebview, [rpcProtocol]);
  const MainThreadWebviewViewAPI = injector.get(MainThreadWebviewView, [rpcProtocol, MainThreadWebviewAPI]);
  const MainThreadSCMAPI = injector.get(MainThreadSCM, [rpcProtocol]);
  const MainThreadTreeViewAPI = injector.get(MainThreadTreeView, [rpcProtocol]);
  const MainThreadDecorationsAPI = injector.get(MainThreadDecorations, [rpcProtocol]);
  const MainThreadWindowStateAPI = injector.get(MainThreadWindowState, [rpcProtocol]);
  const MainThreadWindowAPI = injector.get(MainThreadWindow, [rpcProtocol]);
  const MainThreadConnectionAPI = injector.get(MainThreadConnection, [rpcProtocol]);
  const MainThreadDebugAPI = injector.get(MainThreadDebug, [rpcProtocol, MainThreadConnectionAPI]);
  const MainThreadTerminalAPI = injector.get(MainThreadTerminal, [rpcProtocol]);
  const MainThreadProgressAPI = injector.get(MainThreadProgress, [rpcProtocol]);
  const MainthreadTasksAPI = injector.get(MainthreadTasks, [rpcProtocol]);
  const MainthreadCommentsAPI = injector.get(MainthreadComments, [rpcProtocol, MainThreadCommandsAPI]);
  const MainthreadUrlsAPI = injector.get(MainThreadUrls, [rpcProtocol]);
  const MainthreadThemingAPI = injector.get(MainThreadTheming, [rpcProtocol]);
  const MainThreadCustomEditorAPI = injector.get(MainThreadCustomEditor, [rpcProtocol, MainThreadWebviewAPI]);
  const MainThreadAuthenticationAPI = injector.get(MainThreadAuthentication, [rpcProtocol]);
  const MainThreadSecretAPI = injector.get(MainThreadSecret, [rpcProtocol]);
  const MainthreadTestAPI = injector.get(MainThreadTestsImpl, [rpcProtocol]);
  const MainThreadEditorTabsAPI = injector.get(MainThreadEditorTabsService, [rpcProtocol]);

  rpcProtocol.set<VSCodeExtensionService>(MainThreadAPIIdentifier.MainThreadExtensionService, extensionService);
  rpcProtocol.set<IMainThreadCommands>(MainThreadAPIIdentifier.MainThreadCommands, MainThreadCommandsAPI);
  rpcProtocol.set<IMainThreadLanguages>(MainThreadAPIIdentifier.MainThreadLanguages, MainThreadLanguagesAPI);
  rpcProtocol.set<MainThreadExtensionDocumentData>(
    MainThreadAPIIdentifier.MainThreadDocuments,
    MainThreadExtensionDocumentDataAPI,
  );
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
  rpcProtocol.set<IMainThreadWebviewView>(MainThreadAPIIdentifier.MainThreadWebviewView, MainThreadWebviewViewAPI);
  rpcProtocol.set<MainThreadSCM>(MainThreadAPIIdentifier.MainThreadSCM, MainThreadSCMAPI);
  rpcProtocol.set<MainThreadTreeView>(MainThreadAPIIdentifier.MainThreadTreeView, MainThreadTreeViewAPI);
  rpcProtocol.set<MainThreadDecorations>(MainThreadAPIIdentifier.MainThreadDecorations, MainThreadDecorationsAPI);
  rpcProtocol.set<MainThreadWindowState>(MainThreadAPIIdentifier.MainThreadWindowState, MainThreadWindowStateAPI);
  rpcProtocol.set<MainThreadWindow>(MainThreadAPIIdentifier.MainThreadWindow, MainThreadWindowAPI);
  rpcProtocol.set<MainThreadConnection>(MainThreadAPIIdentifier.MainThreadConnection, MainThreadConnectionAPI);
  rpcProtocol.set<MainThreadDebug>(MainThreadAPIIdentifier.MainThreadDebug, MainThreadDebugAPI);
  rpcProtocol.set<IMainThreadTerminal>(MainThreadAPIIdentifier.MainThreadTerminal, MainThreadTerminalAPI);
  rpcProtocol.set<IMainThreadProgress>(MainThreadAPIIdentifier.MainThreadProgress, MainThreadProgressAPI);
  rpcProtocol.set<IMainThreadTasks>(MainThreadAPIIdentifier.MainThreadTasks, MainthreadTasksAPI);
  rpcProtocol.set<IMainThreadComments>(MainThreadAPIIdentifier.MainThreadComments, MainthreadCommentsAPI);
  rpcProtocol.set<IMainThreadUrls>(MainThreadAPIIdentifier.MainThreadUrls, MainthreadUrlsAPI);
  rpcProtocol.set<IMainThreadTheming>(MainThreadAPIIdentifier.MainThreadTheming, MainthreadThemingAPI);
  rpcProtocol.set<IMainThreadExtensionLog>(MainThreadExtensionLogIdentifier, injector.get(MainThreadExtensionLog));
  rpcProtocol.set<IMainThreadCustomEditor>(MainThreadAPIIdentifier.MainThreadCustomEditor, MainThreadCustomEditorAPI);
  rpcProtocol.set<IMainThreadAuthentication>(
    MainThreadAPIIdentifier.MainThreadAuthentication,
    MainThreadAuthenticationAPI,
  );
  rpcProtocol.set<IMainThreadSecret>(MainThreadAPIIdentifier.MainThreadSecret, MainThreadSecretAPI);
  rpcProtocol.set<IMainThreadTesting>(MainThreadAPIIdentifier.MainThreadTests, MainthreadTestAPI);
  rpcProtocol.set<IMainThreadEditorTabsShape>(MainThreadAPIIdentifier.MainThreadEditorTabs, MainThreadEditorTabsAPI);

  await MainThreadWebviewAPI.init();

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
    MainThreadFileSystemEventAPI.dispose();
    MainThreadWebviewAPI.dispose();
    MainThreadSCMAPI.dispose();
    MainThreadTreeViewAPI.dispose();
    MainThreadDecorationsAPI.dispose();
    MainThreadWindowStateAPI.dispose();
    MainThreadWindowAPI.dispose();
    MainThreadConnectionAPI.dispose();
    MainThreadDebugAPI.dispose();
    MainThreadTerminalAPI.dispose();
    MainThreadProgressAPI.dispose();
    MainthreadTasksAPI.dispose();
    MainthreadCommentsAPI.dispose();
    MainthreadUrlsAPI.dispose();
    MainthreadThemingAPI.dispose();
    MainThreadAuthenticationAPI.dispose();
    MainThreadSecretAPI.dispose();
    MainthreadTestAPI.dispose();
    MainThreadEditorTabsAPI.dispose();
  };
}

export async function initWorkerThreadAPIProxy(workerProtocol: IRPCProtocol, injector: Injector, extensionService) {
  const MainThreadCommandsAPI = injector.get(MainThreadCommands, [workerProtocol, true]);
  const MainThreadLanguagesAPI = injector.get(MainThreadLanguages, [workerProtocol]);
  const MainThreadStatusBarAPI = injector.get(MainThreadStatusBar, [workerProtocol]);
  const MainThreadQuickOpenAPI = injector.get(MainThreadQuickOpen, [workerProtocol]);
  const MainThreadExtensionDocumentDataAPI = injector.get(MainThreadExtensionDocumentData, [workerProtocol]);
  const MainThreadEditorServiceAPI = injector.get(MainThreadEditorService, [
    workerProtocol,
    MainThreadExtensionDocumentDataAPI,
  ]);
  const MainThreadProgressAPI = injector.get(MainThreadProgress, [workerProtocol]);
  const MainThreadWorkspaceAPI = injector.get(MainThreadWorkspace, [workerProtocol]);
  const MainThreadFileSystemAPI = injector.get(MainThreadFileSystem, [workerProtocol]);
  const MainThreadPreferenceAPI = injector.get(MainThreadPreference, [workerProtocol]);
  const MainThreadOutputAPI = injector.get(MainThreadOutput);
  const MainThreadMessageAPI = injector.get(MainThreadMessage, [workerProtocol]);
  const MainThreadExtensionLogAPI = injector.get(MainThreadExtensionLog);
  const MainThreadWebviewAPI = injector.get(MainThreadWebview, [workerProtocol]);
  const MainThreadStorageAPI = injector.get(MainThreadStorage, [workerProtocol]);
  const MainThreadUrlsAPI = injector.get(MainThreadUrls, [workerProtocol]);
  const MainthreadCommentsAPI = injector.get(MainthreadComments, [workerProtocol, MainThreadCommandsAPI]);
  const MainThreadThemingAPI = injector.get(MainThreadTheming, [workerProtocol]);
  const MainThreadCustomEditorAPI = injector.get(MainThreadCustomEditor, [workerProtocol, MainThreadWebviewAPI]);
  const MainThreadAuthenticationAPI = injector.get(MainThreadAuthentication, [workerProtocol]);
  const MainThreadSecretAPI = injector.get(MainThreadSecret, [workerProtocol]);

  workerProtocol.set<VSCodeExtensionService>(MainThreadAPIIdentifier.MainThreadExtensionService, extensionService);
  workerProtocol.set<IMainThreadCommands>(MainThreadAPIIdentifier.MainThreadCommands, MainThreadCommandsAPI);
  workerProtocol.set<IMainThreadLanguages>(MainThreadAPIIdentifier.MainThreadLanguages, MainThreadLanguagesAPI);
  workerProtocol.set<MainThreadExtensionDocumentData>(
    MainThreadAPIIdentifier.MainThreadDocuments,
    MainThreadExtensionDocumentDataAPI,
  );
  workerProtocol.set<MainThreadStatusBar>(MainThreadAPIIdentifier.MainThreadStatusBar, MainThreadStatusBarAPI);
  workerProtocol.set<IMainThreadQuickOpen>(MainThreadAPIIdentifier.MainThreadQuickOpen, MainThreadQuickOpenAPI);
  workerProtocol.set<IMainThreadWorkspace>(MainThreadAPIIdentifier.MainThreadWorkspace, MainThreadWorkspaceAPI);
  workerProtocol.set<MainThreadFileSystem>(MainThreadAPIIdentifier.MainThreadFileSystem, MainThreadFileSystemAPI);
  workerProtocol.set<IMainThreadPreference>(MainThreadAPIIdentifier.MainThreadPreference, MainThreadPreferenceAPI);
  workerProtocol.set<IMainThreadOutput>(
    MainThreadAPIIdentifier.MainThreadOutput,
    MainThreadOutputAPI,
  ) as MainThreadOutput;
  workerProtocol.set<MainThreadEditorService>(MainThreadAPIIdentifier.MainThreadEditors, MainThreadEditorServiceAPI);
  workerProtocol.set<IMainThreadMessage>(MainThreadAPIIdentifier.MainThreadMessages, MainThreadMessageAPI);
  workerProtocol.set<IMainThreadExtensionLog>(MainThreadExtensionLogIdentifier, MainThreadExtensionLogAPI);
  workerProtocol.set<IMainThreadWebview>(MainThreadAPIIdentifier.MainThreadWebview, MainThreadWebviewAPI);
  workerProtocol.set<IMainThreadStorage>(MainThreadAPIIdentifier.MainThreadStorage, MainThreadStorageAPI);
  workerProtocol.set<IMainThreadUrls>(MainThreadAPIIdentifier.MainThreadUrls, MainThreadUrlsAPI);
  workerProtocol.set<IMainThreadComments>(MainThreadAPIIdentifier.MainThreadComments, MainthreadCommentsAPI);
  workerProtocol.set<IMainThreadProgress>(MainThreadAPIIdentifier.MainThreadProgress, MainThreadProgressAPI);
  workerProtocol.set<IMainThreadTheming>(MainThreadAPIIdentifier.MainThreadTheming, MainThreadThemingAPI);
  workerProtocol.set<IMainThreadCustomEditor>(
    MainThreadAPIIdentifier.MainThreadCustomEditor,
    MainThreadCustomEditorAPI,
  );
  workerProtocol.set<IMainThreadAuthentication>(
    MainThreadAPIIdentifier.MainThreadAuthentication,
    MainThreadAuthenticationAPI,
  );
  workerProtocol.set<IMainThreadSecret>(MainThreadAPIIdentifier.MainThreadSecret, MainThreadSecretAPI);

  // 作用和 node extension service 等同，用来设置 webview resourceRoots
  await MainThreadWebviewAPI.init();

  return () => {
    MainThreadCommandsAPI.dispose();
    MainThreadLanguagesAPI.dispose();
    MainThreadStatusBarAPI.dispose();
    MainThreadQuickOpenAPI.dispose();
    MainThreadExtensionDocumentDataAPI.dispose();
    MainThreadEditorServiceAPI.dispose();
    MainThreadProgressAPI.dispose();
    MainThreadWorkspaceAPI.dispose();
    MainThreadFileSystemAPI.dispose();
    MainThreadPreferenceAPI.dispose();
    MainThreadOutputAPI.dispose();
    MainThreadMessageAPI.dispose();
    MainThreadWebviewAPI.dispose();
    MainThreadStorageAPI.dispose();
    MainThreadUrlsAPI.dispose();
    MainthreadCommentsAPI.dispose();
    MainThreadThemingAPI.dispose();
    MainThreadCustomEditorAPI.dispose();
    MainThreadAuthenticationAPI.dispose();
    MainThreadSecretAPI.dispose();
  };
}

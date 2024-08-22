import { Injector } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';

import { IMainThreadExtensionLog, MainThreadExtensionLogIdentifier } from '../../../common/extension-log';
import {
  IMainThreadAuthentication,
  IMainThreadCommands,
  IMainThreadComments,
  IMainThreadCustomEditor,
  IMainThreadEditorTabsShape,
  IMainThreadEnv,
  IMainThreadLanguages,
  IMainThreadMessage,
  IMainThreadOutput,
  IMainThreadPreference,
  IMainThreadProgress,
  IMainThreadQuickOpen,
  IMainThreadSecret,
  IMainThreadStorage,
  IMainThreadTheming,
  IMainThreadUrls,
  IMainThreadWebview,
  IMainThreadWebviewView,
  IMainThreadWorkspace,
  MainThreadAPIIdentifier,
} from '../../../common/vscode';

import { MainThreadProgress } from './main.thread.api.progress';
import { MainThreadWebview, MainThreadWebviewView } from './main.thread.api.webview';
import { MainThreadAuthentication } from './main.thread.authentication';
import { MainThreadCommands } from './main.thread.commands';
import { MainThreadComments } from './main.thread.comments';
import { MainThreadCustomEditor } from './main.thread.custom-editor';
import { MainThreadDecorations } from './main.thread.decoration';
import { MainThreadExtensionDocumentData } from './main.thread.doc';
import { MainThreadEditorService } from './main.thread.editor';
import { MainThreadEditorTabsService } from './main.thread.editor-tabs';
import { MainThreadEnv } from './main.thread.env';
import { MainThreadFileSystem } from './main.thread.file-system';
import { MainThreadFileSystemEvent } from './main.thread.file-system-event';
import { MainThreadLanguages } from './main.thread.language';
import { MainThreadLocalization } from './main.thread.localization';
import { MainThreadExtensionLog } from './main.thread.log';
import { MainThreadMessage } from './main.thread.message';
import { MainThreadExtensionNotebook } from './main.thread.notebook';
import { MainThreadOutput } from './main.thread.output';
import { MainThreadPreference } from './main.thread.preference';
import { MainThreadQuickOpen } from './main.thread.quickopen';
import { MainThreadSCM } from './main.thread.scm';
import { MainThreadSecret } from './main.thread.secret';
import { MainThreadStatusBar } from './main.thread.statusbar';
import { MainThreadStorage } from './main.thread.storage';
import { MainThreadTheming } from './main.thread.theming';
import { MainThreadUrls } from './main.thread.urls';
import { MainThreadWorkspace } from './main.thread.workspace';

export function initSharedAPIProxy(rpcProtocol: IRPCProtocol, injector: Injector) {
  const MainThreadLanguagesAPI = injector.get(MainThreadLanguages, [rpcProtocol]);
  rpcProtocol.set<IMainThreadLanguages>(MainThreadAPIIdentifier.MainThreadLanguages, MainThreadLanguagesAPI);

  const MainThreadCommandsAPI = injector.get(MainThreadCommands, [rpcProtocol]);
  rpcProtocol.set<IMainThreadCommands>(MainThreadAPIIdentifier.MainThreadCommands, MainThreadCommandsAPI);

  const MainThreadExtensionDocumentDataAPI = injector.get(MainThreadExtensionDocumentData, [rpcProtocol]);
  rpcProtocol.set<MainThreadExtensionDocumentData>(
    MainThreadAPIIdentifier.MainThreadDocuments,
    MainThreadExtensionDocumentDataAPI,
  );

  const MainThreadEditorServiceAPI = injector.get(MainThreadEditorService, [
    rpcProtocol,
    MainThreadExtensionDocumentDataAPI,
  ]);
  rpcProtocol.set<MainThreadEditorService>(MainThreadAPIIdentifier.MainThreadEditors, MainThreadEditorServiceAPI);

  const MainThreadNotebookDocumentAPI = injector.get(MainThreadExtensionNotebook, [rpcProtocol]);
  rpcProtocol.set(MainThreadAPIIdentifier.MainThreadNotebook, MainThreadNotebookDocumentAPI);

  const MainThreadStatusBarAPI = injector.get(MainThreadStatusBar, [rpcProtocol]);
  rpcProtocol.set<MainThreadStatusBar>(MainThreadAPIIdentifier.MainThreadStatusBar, MainThreadStatusBarAPI);

  const MainThreadMessageAPI = injector.get(MainThreadMessage, [rpcProtocol]);
  rpcProtocol.set<IMainThreadMessage>(MainThreadAPIIdentifier.MainThreadMessages, MainThreadMessageAPI);

  const MainThreadStorageAPI = injector.get(MainThreadStorage, [rpcProtocol]);
  rpcProtocol.set<IMainThreadStorage>(MainThreadAPIIdentifier.MainThreadStorage, MainThreadStorageAPI);

  const MainThreadWorkspaceAPI = injector.get(MainThreadWorkspace, [rpcProtocol]);
  rpcProtocol.set<IMainThreadWorkspace>(MainThreadAPIIdentifier.MainThreadWorkspace, MainThreadWorkspaceAPI);

  const MainThreadQuickOpenAPI = injector.get(MainThreadQuickOpen, [rpcProtocol]);
  rpcProtocol.set<IMainThreadQuickOpen>(MainThreadAPIIdentifier.MainThreadQuickOpen, MainThreadQuickOpenAPI);

  const MainThreadPreferenceAPI = injector.get(MainThreadPreference, [rpcProtocol]);
  rpcProtocol.set<IMainThreadPreference>(MainThreadAPIIdentifier.MainThreadPreference, MainThreadPreferenceAPI);

  const MainThreadEnvAPI = injector.get(MainThreadEnv, [rpcProtocol, MainThreadStorageAPI]);
  rpcProtocol.set<IMainThreadEnv>(MainThreadAPIIdentifier.MainThreadEnv, MainThreadEnvAPI);

  const MainThreadExtensionLogAPI = injector.get(MainThreadExtensionLog);
  rpcProtocol.set<IMainThreadExtensionLog>(MainThreadExtensionLogIdentifier, MainThreadExtensionLogAPI);

  const MainThreadProgressAPI = injector.get(MainThreadProgress, [rpcProtocol]);
  rpcProtocol.set<IMainThreadProgress>(MainThreadAPIIdentifier.MainThreadProgress, MainThreadProgressAPI);

  const MainThreadOutputAPI = injector.get(MainThreadOutput);
  rpcProtocol.set<IMainThreadOutput>(MainThreadAPIIdentifier.MainThreadOutput, MainThreadOutputAPI);

  const MainThreadFileSystemAPI = injector.get(MainThreadFileSystem, [rpcProtocol]);
  rpcProtocol.set<MainThreadFileSystem>(MainThreadAPIIdentifier.MainThreadFileSystem, MainThreadFileSystemAPI);

  const MainThreadFileSystemEventAPI = injector.get(MainThreadFileSystemEvent, [rpcProtocol]);

  const MainThreadWebviewAPI = injector.get(MainThreadWebview, [rpcProtocol]);
  rpcProtocol.set<IMainThreadWebview>(MainThreadAPIIdentifier.MainThreadWebview, MainThreadWebviewAPI);

  const MainThreadWebviewViewAPI = injector.get(MainThreadWebviewView, [rpcProtocol, MainThreadWebviewAPI]);
  rpcProtocol.set<IMainThreadWebviewView>(MainThreadAPIIdentifier.MainThreadWebviewView, MainThreadWebviewViewAPI);

  const MainThreadUrlsAPI = injector.get(MainThreadUrls, [rpcProtocol]);
  rpcProtocol.set<IMainThreadUrls>(MainThreadAPIIdentifier.MainThreadUrls, MainThreadUrlsAPI);

  const MainThreadCommentsAPI = injector.get(MainThreadComments, [rpcProtocol, MainThreadCommandsAPI]);
  rpcProtocol.set<IMainThreadComments>(MainThreadAPIIdentifier.MainThreadComments, MainThreadCommentsAPI);

  const MainThreadAuthenticationAPI = injector.get(MainThreadAuthentication, [rpcProtocol]);
  rpcProtocol.set<IMainThreadAuthentication>(
    MainThreadAPIIdentifier.MainThreadAuthentication,
    MainThreadAuthenticationAPI,
  );

  const MainThreadLocalizationAPI = injector.get(MainThreadLocalization, [rpcProtocol]);
  rpcProtocol.set<MainThreadLocalization>(MainThreadAPIIdentifier.MainThreadLocalization, MainThreadLocalizationAPI);

  const MainThreadEditorTabsAPI = injector.get(MainThreadEditorTabsService, [rpcProtocol]);
  rpcProtocol.set<IMainThreadEditorTabsShape>(MainThreadAPIIdentifier.MainThreadEditorTabs, MainThreadEditorTabsAPI);

  const MainThreadSCMAPI = injector.get(MainThreadSCM, [rpcProtocol]);
  rpcProtocol.set<MainThreadSCM>(MainThreadAPIIdentifier.MainThreadSCM, MainThreadSCMAPI);

  const MainThreadSecretAPI = injector.get(MainThreadSecret, [rpcProtocol]);
  rpcProtocol.set<IMainThreadSecret>(MainThreadAPIIdentifier.MainThreadSecret, MainThreadSecretAPI);

  const MainThreadDecorationsAPI = injector.get(MainThreadDecorations, [rpcProtocol]);
  rpcProtocol.set<MainThreadDecorations>(MainThreadAPIIdentifier.MainThreadDecorations, MainThreadDecorationsAPI);

  const MainThreadThemingAPI = injector.get(MainThreadTheming, [rpcProtocol]);
  rpcProtocol.set<IMainThreadTheming>(MainThreadAPIIdentifier.MainThreadTheming, MainThreadThemingAPI);

  const MainThreadCustomEditorAPI = injector.get(MainThreadCustomEditor, [rpcProtocol, MainThreadWebviewAPI]);
  rpcProtocol.set<IMainThreadCustomEditor>(MainThreadAPIIdentifier.MainThreadCustomEditor, MainThreadCustomEditorAPI);

  return {
    setup: async () => {
      await MainThreadWebviewAPI.init();
    },
    dispose: () => {
      MainThreadLanguagesAPI.dispose();
      MainThreadCommandsAPI.dispose();
      MainThreadStatusBarAPI.dispose();
      MainThreadExtensionDocumentDataAPI.dispose();
      MainThreadNotebookDocumentAPI.dispose();
      MainThreadEditorServiceAPI.dispose();
      MainThreadMessageAPI.dispose();
      MainThreadStorageAPI.dispose();
      MainThreadWorkspaceAPI.dispose();
      MainThreadQuickOpenAPI.dispose();
      MainThreadPreferenceAPI.dispose();
      MainThreadEnvAPI.dispose();
      MainThreadProgressAPI.dispose();
      MainThreadOutputAPI.dispose();
      MainThreadFileSystemAPI.dispose();
      MainThreadFileSystemEventAPI.dispose();
      MainThreadWebviewAPI.dispose();
      MainThreadWebviewViewAPI.dispose();
      MainThreadUrlsAPI.dispose();
      MainThreadAuthenticationAPI.dispose();
      MainThreadCommentsAPI.dispose();
      MainThreadEditorTabsAPI.dispose();
      MainThreadSCMAPI.dispose();
      MainThreadSecretAPI.dispose();
      MainThreadDecorationsAPI.dispose();
      MainThreadThemingAPI.dispose();
      MainThreadCustomEditorAPI.dispose();
    },
  };
}

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

export function createApiFactory(
  rpcProtocol: IRPCProtocol,
  injector: Injector,
  extensionService: VSCodeExtensionService,
) {
  rpcProtocol.set<VSCodeExtensionService>(MainThreadAPIIdentifier.MainThreadExtensionServie, extensionService);
  rpcProtocol.set<IMainThreadCommands>(MainThreadAPIIdentifier.MainThreadCommands, injector.get(MainThreadCommands, [rpcProtocol]));
  rpcProtocol.set<IMainThreadLanguages>(MainThreadAPIIdentifier.MainThreadLanguages, injector.get(MainThreadLanguages, [rpcProtocol]));
  rpcProtocol.set<MainThreadExtensionDocumentData>(MainThreadAPIIdentifier.MainThreadDocuments, injector.get(MainThreadExtensionDocumentData, [rpcProtocol]));
  rpcProtocol.set<MainThreadEditorService>(MainThreadAPIIdentifier.MainThreadEditors, injector.get(MainThreadEditorService, [rpcProtocol]));
  rpcProtocol.set<MainThreadStatusBar>(MainThreadAPIIdentifier.MainThreadStatusBar, injector.get(MainThreadStatusBar, [rpcProtocol]));
  rpcProtocol.set<IMainThreadMessage>(MainThreadAPIIdentifier.MainThreadMessages, injector.get(MainThreadMessage, [rpcProtocol]));
  rpcProtocol.set<IMainThreadWorkspace>(MainThreadAPIIdentifier.MainThreadWorkspace, injector.get(MainThreadWorkspace, [rpcProtocol]));
  rpcProtocol.set<IMainThreadPreference>(MainThreadAPIIdentifier.MainThreadPreference, injector.get(MainThreadPreference, [rpcProtocol]));
  rpcProtocol.set<IMainThreadEnv>(MainThreadAPIIdentifier.MainThreadEnv, injector.get(MainThreadEnv, [rpcProtocol]));
  rpcProtocol.set<IMainThreadQuickOpen>(MainThreadAPIIdentifier.MainThreadQuickOpen, injector.get(MainThreadQuickOpen, [rpcProtocol]));
  rpcProtocol.set<IMainThreadStorage>(MainThreadAPIIdentifier.MainThreadStorage, injector.get(MainThreadStorage, [rpcProtocol]));
  rpcProtocol.set<IMainThreadOutput>(MainThreadAPIIdentifier.MainThreadOutput, injector.get(MainThreadOutput, [rpcProtocol]));
  rpcProtocol.set<MainThreadFileSystem>(MainThreadAPIIdentifier.MainThreadFileSystem, injector.get(MainThreadFileSystem, [rpcProtocol]));
  rpcProtocol.set<IMainThreadWebview>(MainThreadAPIIdentifier.MainThreadWebview, injector.get(MainThreadWebview, [rpcProtocol]));
  rpcProtocol.set<MainThreadSCM>(MainThreadAPIIdentifier.MainThreadSCM, injector.get(MainThreadSCM, [rpcProtocol]));
  rpcProtocol.set<MainThreadTreeView>(MainThreadAPIIdentifier.MainThreadTreeView, injector.get(MainThreadTreeView, [rpcProtocol]));
}

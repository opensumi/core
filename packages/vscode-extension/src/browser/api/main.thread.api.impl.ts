import { MainThreadAPIIdentifier, IMainThreadCommands, IMainThreadLanguages, IMainThreadMessage, IMainThreadPreference, IMainThreadWorkspace , IMainThreadQuickPick} from '../../common';
import { MainThreadCommands } from './main.thread.commands';
import { MainThreadExtensionDocumentData } from './main.thread.doc';
import { Injector } from '@ali/common-di';
import { VSCodeExtensionService } from '../types';
import { IRPCProtocol } from '@ali/ide-connection';
import { MainThreadLanguages } from './main.thread.language';
import { MainThreadStatusBar } from './main.thread.statusbar';
import { MainThreadMessage } from './main.thread.message';
import { MainThreadEditorService } from './main.thread.editor';
import { MainThreadPreference } from './main.thread.preference';
import { MainThreadWorkspace } from './main.thread.workspace';
import { MainThreadQuickPick } from './main.thread.quickpick';

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
  rpcProtocol.set<IMainThreadQuickPick>(MainThreadAPIIdentifier.MainThreadQuickPick, injector.get(MainThreadQuickPick, [rpcProtocol]));
}

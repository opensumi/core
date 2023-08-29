import { IRPCProtocol } from '@opensumi/ide-connection';
import { CancellationTokenSource, Emitter, Event } from '@opensumi/ide-core-common';
import { OverviewRulerLane } from '@opensumi/ide-editor';

import { IExtensionHostService } from '../../../common';
import {
  IExtHostConnectionService,
  IExtHostDebugService,
  ExtHostAPIIdentifier,
  TextEditorCursorStyle,
  TextEditorSelectionChangeKind,
  IExtensionDescription,
  IExtHostTests,
} from '../../../common/vscode'; // '../../common';
import { IExtHostEditorTabs } from '../../../common/vscode/editor-tabs';
import { ViewColumn } from '../../../common/vscode/enums';
import * as extTypes from '../../../common/vscode/ext-types';
import * as fileSystemTypes from '../../../common/vscode/file-system';
import { IExtHostLocalization } from '../../../common/vscode/localization';
import { ExtHostAppConfig } from '../../ext.process-base';

import { ExtHostDebug, createDebugApiFactory } from './debug';
import { ExtensionDocumentDataManagerImpl } from './doc';
import { ExtensionHostEditorService } from './editor/editor.host';
import { createEnvApiFactory } from './env/envApiFactory';
import { ExtHostEnv } from './env/ext.host.env';
import { ExtHostWebviewService, ExtHostWebviewViews } from './ext.host.api.webview';
import { ExtHostAuthentication, createAuthenticationApiFactory } from './ext.host.authentication';
import { ExtHostCommands, createCommandsApiFactory } from './ext.host.command';
import { ExtHostComments, createCommentsApiFactory } from './ext.host.comments';
import { ExtHostConnection } from './ext.host.connection';
import { ExtHostCustomEditorImpl } from './ext.host.custom-editor';
import { ExtHostDecorations } from './ext.host.decoration';
import { ExtHostEditorTabs } from './ext.host.editor-tabs';
import { createExtensionsApiFactory } from './ext.host.extensions';
import { ExtHostFileSystem } from './ext.host.file-system';
import { ExtHostFileSystemEvent } from './ext.host.file-system-event';
import { ExtHostFileSystemInfo } from './ext.host.file-system-info';
import { createLanguagesApiFactory, ExtHostLanguages } from './ext.host.language';
import { ExtHostLocalization, createLocalizationApiFactory } from './ext.host.localization';
import { ExtHostMessage } from './ext.host.message';
import { ExtHostOutput } from './ext.host.output';
import { ExtHostPreference } from './ext.host.preference';
import { ExtHostProgress } from './ext.host.progress';
import { ExtHostQuickOpen } from './ext.host.quickopen';
import { ExtHostSCM } from './ext.host.scm';
import { ExtHostStatusBar } from './ext.host.statusbar';
import { ExtHostTerminal } from './ext.host.terminal';
import { ExtHostTestsImpl } from './ext.host.tests';
import { ExtHostTheming } from './ext.host.theming';
import { ExtHostTreeViews } from './ext.host.treeview';
import { ExtHostUrls } from './ext.host.urls';
import { ExtHostWindowState } from './ext.host.window-state';
import { createWindowApiFactory, ExtHostWindow } from './ext.host.window.api.impl';
import { ExtHostWorkspace, createWorkspaceApiFactory } from './ext.host.workspace';
import { ExtHostTasks, createTaskApiFactory } from './tasks/ext.host.tasks';

export function createApiFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionHostService,
  appConfig: ExtHostAppConfig,
) {
  const builtinCommands = appConfig.builtinCommands;
  const customDebugChildProcess = appConfig.customDebugChildProcess;

  // register addressable instances
  const extHostDocs = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostDocuments,
    new ExtensionDocumentDataManagerImpl(rpcProtocol),
  );
  rpcProtocol.set(ExtHostAPIIdentifier.ExtHostExtensionService, extensionService);

  const extHostCommands = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostCommands,
    new ExtHostCommands(rpcProtocol, builtinCommands),
  ) as ExtHostCommands;
  const extHostEditors = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostEditors,
    new ExtensionHostEditorService(rpcProtocol, extHostDocs),
  ) as ExtensionHostEditorService;
  const extHostEnv = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostEnv, new ExtHostEnv(rpcProtocol));
  const extHostLanguages = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostLanguages,
    new ExtHostLanguages(rpcProtocol, extHostDocs, extHostCommands, extensionService.logger),
  );
  const extHostFileSystemInfo = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostFileSystemInfo,
    new ExtHostFileSystemInfo(),
  );
  const extHostFileSystem = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostFileSystem,
    new ExtHostFileSystem(rpcProtocol, extHostFileSystemInfo),
  );
  const extHostFileSystemEvent = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostFileSystemEvent,
    new ExtHostFileSystemEvent(rpcProtocol, extHostDocs),
  );
  const extHostMessage = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostMessage, new ExtHostMessage(rpcProtocol));
  const extHostWorkspace = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostWorkspace,
    new ExtHostWorkspace(rpcProtocol, extHostMessage, extHostDocs),
  ) as ExtHostWorkspace;
  const extHostPreference = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostPreference,
    new ExtHostPreference(rpcProtocol, extHostWorkspace),
  ) as ExtHostPreference;
  const extHostTreeView = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostTreeView,
    new ExtHostTreeViews(rpcProtocol, extHostCommands),
  );
  const extHostWebview = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostWebview,
    new ExtHostWebviewService(rpcProtocol),
  ) as ExtHostWebviewService;
  const extHostWebviewView = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostWebviewView,
    new ExtHostWebviewViews(rpcProtocol, extHostWebview),
  ) as ExtHostWebviewViews;
  const extHostSCM = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostSCM,
    new ExtHostSCM(rpcProtocol, extHostCommands),
  ) as ExtHostSCM;
  const extHostWindowState = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostWindowState,
    new ExtHostWindowState(rpcProtocol),
  );
  const extHostDecorations = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostDecorations,
    new ExtHostDecorations(rpcProtocol),
  );
  const extHostStatusBar = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostStatusBar, new ExtHostStatusBar(rpcProtocol));
  const extHostQuickOpen = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostQuickOpen,
    new ExtHostQuickOpen(rpcProtocol, extHostWorkspace),
  );
  const extHostOutput = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostOutput, new ExtHostOutput(rpcProtocol));
  const extHostWindow = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostWindow,
    new ExtHostWindow(rpcProtocol),
  ) as ExtHostWindow;
  const extHostConnection = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostConnection,
    new ExtHostConnection(rpcProtocol),
  ) as IExtHostConnectionService;
  const extHostDebug = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostDebug,
    new ExtHostDebug(rpcProtocol, extHostConnection, extHostCommands, customDebugChildProcess),
  ) as IExtHostDebugService;
  const extHostTerminal = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostTerminal, new ExtHostTerminal(rpcProtocol));
  const extHostProgress = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostProgress,
    new ExtHostProgress(rpcProtocol),
  ) as ExtHostProgress;

  const extHostTasks = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostTasks,
    new ExtHostTasks(rpcProtocol, extHostTerminal, extHostWorkspace),
  );
  const extHostComments = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostComments,
    new ExtHostComments(rpcProtocol, extHostCommands, extHostDocs),
  ) as ExtHostComments;
  const extHostUrls = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostUrls, new ExtHostUrls(rpcProtocol));
  const extHostTheming = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostTheming,
    new ExtHostTheming(rpcProtocol),
  ) as ExtHostTheming;
  const extHostCustomEditor = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostCustomEditor,
    new ExtHostCustomEditorImpl(rpcProtocol, extHostWebview, extHostDocs),
  ) as ExtHostCustomEditorImpl;
  const extHostAuthentication = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostAuthentication,
    new ExtHostAuthentication(rpcProtocol),
  ) as ExtHostAuthentication;
  const extHostTests = rpcProtocol.set<IExtHostTests>(
    ExtHostAPIIdentifier.ExtHostTests,
    new ExtHostTestsImpl(rpcProtocol),
  );
  const extHostEditorTabs = rpcProtocol.set<IExtHostEditorTabs>(
    ExtHostAPIIdentifier.ExtHostEditorTabs,
    new ExtHostEditorTabs(rpcProtocol),
  ) as ExtHostEditorTabs;

  const extHostLocalization = rpcProtocol.set<IExtHostLocalization>(
    ExtHostAPIIdentifier.ExtHostLocalization,
    new ExtHostLocalization(rpcProtocol, extensionService.logger),
  ) as ExtHostLocalization;

  rpcProtocol.set(ExtHostAPIIdentifier.ExtHostStorage, extensionService.storage);

  return (extension: IExtensionDescription) => ({
    authentication: createAuthenticationApiFactory(extension, extHostAuthentication),
    commands: createCommandsApiFactory(extHostCommands, extHostEditors, extension),
    window: createWindowApiFactory(
      extension,
      extHostEditors,
      extHostMessage,
      extHostWebview,
      extHostWebviewView,
      extHostTreeView,
      extHostWindowState,
      extHostDecorations,
      extHostStatusBar,
      extHostQuickOpen,
      extHostOutput,
      extHostTerminal,
      extHostWindow,
      extHostProgress,
      extHostUrls,
      extHostTheming,
      extHostCustomEditor,
      extHostEditorTabs,
    ),
    languages: createLanguagesApiFactory(extHostLanguages, extension),
    workspace: createWorkspaceApiFactory(
      extHostWorkspace,
      extHostPreference,
      extHostDocs,
      extHostFileSystem,
      extHostFileSystemEvent,
      extHostTasks,
      extension,
    ),
    env: createEnvApiFactory(rpcProtocol, extension, extHostEnv, extHostTerminal),
    debug: createDebugApiFactory(extHostDebug),
    version: appConfig.customVSCodeEngineVersion || '1.68.0',
    comments: createCommentsApiFactory(extension, extHostComments),
    extensions: createExtensionsApiFactory(extensionService),
    tasks: createTaskApiFactory(extHostTasks, extension),
    scm: {
      get inputBox() {
        return extHostSCM.getLastInputBox(extension)!; // Strict null override - Deprecated api
      },
      createSourceControl(id: string, label: string, rootUri?: extTypes.Uri) {
        return extHostSCM.createSourceControl(extension, id, label, rootUri);
      },
      getSourceControl(extensionId: string, id: string) {
        return extHostSCM.getSourceControl(extensionId, id);
      },
    },
    tests: {
      createTestController(controllerId: string, label: string, refreshHandler?: () => Thenable<void> | void) {
        return extHostTests.createTestController(controllerId, label, refreshHandler);
      },
    },
    l10n: createLocalizationApiFactory(extHostLocalization, extension),
    // 类型定义
    ...extTypes,
    // https://github.com/microsoft/vscode/blob/0ba16b83267cbab5811e12e0317fb47fd774324e/src/vs/workbench/api/common/extHost.api.impl.ts#L1288
    InlineCompletionItem: extTypes.InlineSuggestion,
    InlineCompletionList: extTypes.InlineSuggestionList,
    ...fileSystemTypes,
    // 参考 VS Code，目前到 1.44 版本为临时兼容，最新版(1.50+)已去除
    Task2: extTypes.Task,
    CancellationTokenSource,
    EventEmitter: Emitter,
    Event,
    ViewColumn,
    OverviewRulerLane,
    TextEditorCursorStyle,
    TextEditorSelectionChangeKind,
  });
}

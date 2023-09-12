import type * as vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection';
import { Emitter, Event, CancellationTokenSource, DefaultReporter } from '@opensumi/ide-core-common';
import { OverviewRulerLane } from '@opensumi/ide-editor';

import { IExtensionHostService, IExtensionWorkerHost, WorkerHostAPIIdentifier } from '../../../common';
import {
  TextEditorCursorStyle,
  ViewColumn,
  TextEditorSelectionChangeKind,
  IExtensionDescription,
  IExtHostLocalization,
} from '../../../common/vscode';
import { ExtHostAPIIdentifier } from '../../../common/vscode';
import { createAPIFactory as createSumiAPIFactory } from '../sumi/ext.host.api.impl';
import { ExtensionDocumentDataManagerImpl } from '../vscode/doc';
import { ExtensionHostEditorService } from '../vscode/editor/editor.host';
import { ExtHostEnv } from '../vscode/env/ext.host.env';
import { createWorkerHostEnvAPIFactory } from '../vscode/env/workerEnvApiFactory';
import { ExtHostWebviewService, ExtHostWebviewViews } from '../vscode/ext.host.api.webview';
import { createAuthenticationApiFactory, ExtHostAuthentication } from '../vscode/ext.host.authentication';
import { ExtHostCommands } from '../vscode/ext.host.command';
import { ExtHostComments, createCommentsApiFactory } from '../vscode/ext.host.comments';
import { ExtHostCustomEditorImpl } from '../vscode/ext.host.custom-editor';
import { ExtHostDecorations } from '../vscode/ext.host.decoration';
import { ExtHostEditorTabs } from '../vscode/ext.host.editor-tabs';
import { createExtensionsApiFactory } from '../vscode/ext.host.extensions';
import { ExtHostFileSystem } from '../vscode/ext.host.file-system';
import { ExtHostFileSystemEvent } from '../vscode/ext.host.file-system-event';
import { ExtHostFileSystemInfo } from '../vscode/ext.host.file-system-info';
import { createLanguagesApiFactory, ExtHostLanguages } from '../vscode/ext.host.language';
import { ExtHostLocalization, createLocalizationApiFactory } from '../vscode/ext.host.localization';
import { ExtHostMessage } from '../vscode/ext.host.message';
import { ExtHostOutput } from '../vscode/ext.host.output';
import { ExtHostPreference } from '../vscode/ext.host.preference';
import { ExtHostProgress } from '../vscode/ext.host.progress';
import { ExtHostQuickOpen } from '../vscode/ext.host.quickopen';
import { ExtHostSCM } from '../vscode/ext.host.scm';
import { ExtHostStatusBar } from '../vscode/ext.host.statusbar';
import { ExtHostTerminal } from '../vscode/ext.host.terminal';
import { ExtHostTheming } from '../vscode/ext.host.theming';
import { ExtHostTreeViews } from '../vscode/ext.host.treeview';
import { ExtHostUrls } from '../vscode/ext.host.urls';
import { ExtHostWindowState } from '../vscode/ext.host.window-state';
import { createWindowApiFactory, ExtHostWindow } from '../vscode/ext.host.window.api.impl';
import { ExtHostWorkspace, createWorkspaceApiFactory } from '../vscode/ext.host.workspace';
import { ExtHostTasks } from '../vscode/tasks/ext.host.tasks';

import * as workerExtTypes from './worker.ext-types';

export function createAPIFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionHostService | IExtensionWorkerHost,
) {
  rpcProtocol.set(WorkerHostAPIIdentifier.ExtWorkerHostExtensionService, extensionService);

  const extHostDocs = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostDocuments,
    new ExtensionDocumentDataManagerImpl(rpcProtocol),
  );
  const extHostCommands = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostCommands,
    new ExtHostCommands(rpcProtocol),
  ) as ExtHostCommands;
  const extHostLanguages = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostLanguages,
    new ExtHostLanguages(rpcProtocol, extHostDocs, extHostCommands, extensionService.logger),
  );
  const extHostEditors = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostEditors,
    new ExtensionHostEditorService(rpcProtocol, extHostDocs),
  ) as ExtensionHostEditorService;
  const extHostMessage = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostMessage, new ExtHostMessage(rpcProtocol));
  const extHostWorkspace = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostWorkspace,
    new ExtHostWorkspace(rpcProtocol, extHostMessage, extHostDocs),
  ) as ExtHostWorkspace;
  const extHostFileSystemInfo = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostFileSystemInfo,
    new ExtHostFileSystemInfo(),
  );
  const extHostFileSystem = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostFileSystem,
    new ExtHostFileSystem(rpcProtocol, extHostFileSystemInfo),
  );
  const extHostTerminal = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostTerminal, new ExtHostTerminal(rpcProtocol));
  const extHostTasks = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostTasks,
    new ExtHostTasks(rpcProtocol, extHostTerminal, extHostWorkspace),
  );
  const extHostFileSystemEvent = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostFileSystemEvent,
    new ExtHostFileSystemEvent(rpcProtocol, extHostDocs),
  );
  const extHostPreference = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostPreference,
    new ExtHostPreference(rpcProtocol, extHostWorkspace),
  ) as ExtHostPreference;
  const extHostOutput = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostOutput,
    new ExtHostOutput(rpcProtocol),
  ) as ExtHostOutput;
  const extHostWebview = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostWebview,
    new ExtHostWebviewService(rpcProtocol),
  ) as ExtHostWebviewService;
  const extHostWebviewView = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostWebviewView,
    new ExtHostWebviewViews(rpcProtocol, extHostWebview),
  ) as ExtHostWebviewViews;
  const extHostTreeView = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostTreeView,
    new ExtHostTreeViews(rpcProtocol, extHostCommands),
  );
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
  const extHostWindow = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostWindow,
    new ExtHostWindow(rpcProtocol),
  ) as ExtHostWindow;
  const extHostProgress = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostProgress,
    new ExtHostProgress(rpcProtocol),
  ) as ExtHostProgress;
  const extHostUrls = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostUrls, new ExtHostUrls(rpcProtocol));
  const extHostComments = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostComments,
    new ExtHostComments(rpcProtocol, extHostCommands, extHostDocs),
  ) as ExtHostComments;
  const extHostTheming = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostTheming,
    new ExtHostTheming(rpcProtocol),
  ) as ExtHostTheming;
  const extHostCustomEditor = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostCustomEditor,
    new ExtHostCustomEditorImpl(rpcProtocol, extHostWebview, extHostDocs),
  ) as ExtHostCustomEditorImpl;
  const extHostEditorTabs = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostEditorTabs,
    new ExtHostEditorTabs(rpcProtocol),
  ) as ExtHostEditorTabs;
  const extHostSCM = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostSCM,
    new ExtHostSCM(rpcProtocol, extHostCommands),
  ) as ExtHostSCM;
  const extHostAuthentication = rpcProtocol.set(
    ExtHostAPIIdentifier.ExtHostAuthentication,
    new ExtHostAuthentication(rpcProtocol),
  ) as ExtHostAuthentication;
  const extHostLocalization = rpcProtocol.set<IExtHostLocalization>(
    ExtHostAPIIdentifier.ExtHostLocalization,
    new ExtHostLocalization(rpcProtocol, extensionService.logger),
  ) as ExtHostLocalization;

  const extHostEnv = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostEnv, new ExtHostEnv(rpcProtocol)) as ExtHostEnv;

  // TODO: 目前 worker reporter 缺少一条通信链路，先默认实现
  const reporter = new DefaultReporter();
  const sumiAPI = createSumiAPIFactory(rpcProtocol, extensionService, 'worker', reporter);

  return (extension: IExtensionDescription) => ({
    ...workerExtTypes,
    EventEmitter: Emitter,
    CancellationTokenSource,
    Event,
    ViewColumn,
    OverviewRulerLane,
    TextEditorCursorStyle,
    TextEditorSelectionChangeKind,
    // VS Code 纯前端插件 API
    // ENV 用处貌似比较少, 现有的实现依赖 node  模块，后面需要再重新实现
    env: createWorkerHostEnvAPIFactory(rpcProtocol, extHostEnv),
    languages: createLanguagesApiFactory(extHostLanguages, extension),
    extensions: createExtensionsApiFactory(extensionService),
    workspace: createWorkspaceApiFactory(
      extHostWorkspace,
      extHostPreference,
      extHostDocs,
      extHostFileSystem,
      extHostFileSystemEvent,
      extHostTasks,
      extension,
    ),
    scm: {
      get inputBox() {
        return extHostSCM.getLastInputBox(extension)!; // Strict null override - Deprecated api
      },
      createSourceControl(id: string, label: string, rootUri: vscode.Uri) {
        return extHostSCM.createSourceControl(extension, id, label, rootUri);
      },
      getSourceControl(extensionId: string, id: string) {
        return extHostSCM.getSourceControl(extensionId, id);
      },
    },
    l10n: createLocalizationApiFactory(extHostLocalization, extension),
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
    authentication: createAuthenticationApiFactory(extension, extHostAuthentication),
    comments: createCommentsApiFactory(extension, extHostComments),
    // Sumi 扩展 API
    ...sumiAPI(extension),
  });
}

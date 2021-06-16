import { IRPCProtocol } from '@ali/ide-connection';
import { IExtensionHostService, IExtensionWorkerHost, WorkerHostAPIIdentifier } from '../../../common';
import { createLayoutAPIFactory } from './worker.host.layout';
import { TextEditorCursorStyle, ViewColumn, TextEditorSelectionChangeKind, IExtensionDescription } from '../../../common/vscode';
import { ExtHostAPIIdentifier } from '../../../common/vscode';
import * as workerExtTypes from './worker.ext-types';
import { OverviewRulerLane } from '@ali/ide-editor';
import { ExtHostCommands, createCommandsApiFactory } from '../vscode/ext.host.command';
import { createLanguagesApiFactory, ExtHostLanguages } from '../vscode/ext.host.language';
import { ExtensionDocumentDataManagerImpl } from '../vscode/doc';
import { ExtensionHostEditorService } from '../vscode/editor/editor.host';
import { Emitter, Event, CancellationTokenSource } from '@ali/ide-core-common';
import { createExtensionsApiFactory } from '../vscode/ext.host.extensions';
import { ExtHostWorkspace, createWorkspaceApiFactory } from '../vscode/ext.host.workspace';
import { ExtHostMessage } from '../vscode/ext.host.message';
import { ExtHostPreference } from '../vscode/ext.host.preference';
import { ExtHostFileSystem } from '../vscode/ext.host.file-system';
import { ExtHostFileSystemEvent } from '../vscode/ext.host.file-system-event';
import { ExtHostTasks } from '../vscode/tasks/ext.host.tasks';
import { ExtHostTerminal } from '../vscode/ext.host.terminal';
import { ExtHostOutput } from '../vscode/ext.host.output';
import { createWindowApiFactory, ExtHostWindow } from '../vscode/ext.host.window.api.impl';
import { ExtHostWebviewService, ExtHostWebviewViews } from '../vscode/ext.host.api.webview';
import { ExtHostTreeViews } from '../vscode/ext.host.treeview';
import { ExtHostWindowState } from '../vscode/ext.host.window-state';
import { ExtHostDecorations } from '../vscode/ext.host.decoration';
import { ExtHostQuickOpen } from '../vscode/ext.host.quickopen';
import { ExtHostStatusBar } from '../vscode/ext.host.statusbar';
import { ExtHostProgress } from '../vscode/ext.host.progress';
import { ExtHostUrls } from '../vscode/ext.host.urls';
import { ExtHostComments, createCommentsApiFactory } from '../vscode/ext.host.comments';
import { ExtHostTheming } from '../vscode/ext.host.theming';
import { ExtHostCustomEditorImpl } from '../vscode/ext.host.custom-editor';

export function createAPIFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionHostService | IExtensionWorkerHost,
  type: string,
) {
  rpcProtocol.set(WorkerHostAPIIdentifier.ExtWorkerHostExtensionService, extensionService);

  const extHostDocs = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostDocuments, new ExtensionDocumentDataManagerImpl(rpcProtocol));
  const extHostCommands = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostCommands, new ExtHostCommands(rpcProtocol)) as ExtHostCommands;
  const extHostLanguages = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostLanguages, new ExtHostLanguages(rpcProtocol, extHostDocs, extHostCommands));
  const extHostEditors = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostEditors, new ExtensionHostEditorService(rpcProtocol, extHostDocs)) as ExtensionHostEditorService;
  const extHostMessage = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostMessage, new ExtHostMessage(rpcProtocol));
  const extHostWorkspace = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostWorkspace, new ExtHostWorkspace(rpcProtocol, extHostMessage, extHostDocs)) as ExtHostWorkspace;
  const extHostFileSystem = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostFileSystem, new ExtHostFileSystem(rpcProtocol));
  const extHostTerminal = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostTerminal, new ExtHostTerminal(rpcProtocol));
  const extHostTasks = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostTasks, new ExtHostTasks(rpcProtocol, extHostTerminal, extHostWorkspace));
  const extHostFileSystemEvent = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostFileSystemEvent, new ExtHostFileSystemEvent(rpcProtocol, extHostDocs));
  const extHostPreference = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostPreference, new ExtHostPreference(rpcProtocol, extHostWorkspace)) as ExtHostPreference;
  const extHostOutput = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostOutput, new ExtHostOutput(rpcProtocol)) as ExtHostOutput;
  const extHostWebview = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostWebview, new ExtHostWebviewService(rpcProtocol)) as ExtHostWebviewService;
  const extHostWebviewView = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostWebviewView, new ExtHostWebviewViews(rpcProtocol, extHostWebview)) as ExtHostWebviewViews;
  const extHostTreeView = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostTreeView, new ExtHostTreeViews(rpcProtocol, extHostCommands));
  const extHostWindowState = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostWindowState, new ExtHostWindowState(rpcProtocol));
  const extHostDecorations = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostDecorations, new ExtHostDecorations(rpcProtocol));
  const extHostStatusBar = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostStatusBar, new ExtHostStatusBar(rpcProtocol));
  const extHostQuickOpen = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostQuickOpen, new ExtHostQuickOpen(rpcProtocol, extHostWorkspace));
  const extHostWindow = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostWindow, new ExtHostWindow(rpcProtocol)) as ExtHostWindow;
  const extHostProgress = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostProgress, new ExtHostProgress(rpcProtocol)) as ExtHostProgress;
  const extHostUrls = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostUrls, new ExtHostUrls(rpcProtocol));
  const extHostComments = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostComments, new ExtHostComments(rpcProtocol, extHostCommands, extHostDocs)) as ExtHostComments;
  const extHostTheming = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostTheming, new ExtHostTheming(rpcProtocol)) as ExtHostTheming;
  const extHostCustomEditor = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostCustomEditor, new ExtHostCustomEditorImpl(rpcProtocol, extHostWebview , extHostDocs)) as ExtHostCustomEditorImpl;

  return (extension: IExtensionDescription) => {
    return {
      ...workerExtTypes,
      EventEmitter: Emitter,
      CancellationTokenSource,
      Event,
      ViewColumn,
      OverviewRulerLane,
      TextEditorCursorStyle,
      TextEditorSelectionChangeKind,
      // VS Code 纯前端插件 API
      env: {
        // ENV 用处貌似比较少, 现有的实现依赖 node  模块，后面需要再重新实现
        uriScheme: 'file',
      },
      languages: createLanguagesApiFactory(extHostLanguages, extension),
      commands: createCommandsApiFactory(extHostCommands, extHostEditors, extension),
      extensions: createExtensionsApiFactory(extensionService),
      workspace: createWorkspaceApiFactory(extHostWorkspace, extHostPreference, extHostDocs, extHostFileSystem, extHostFileSystemEvent, extHostTasks, extension),
      window: createWindowApiFactory(
        extension, extHostEditors, extHostMessage, extHostWebview, extHostWebviewView,
        extHostTreeView, extHostWindowState, extHostDecorations, extHostStatusBar,
        extHostQuickOpen, extHostOutput, extHostTerminal, extHostWindow, extHostProgress,
        extHostUrls, extHostTheming, extHostCustomEditor,
      ),
      // KAITIAN 扩展 API
      layout: createLayoutAPIFactory(extHostCommands),
      comments: createCommentsApiFactory(extension, extHostComments),
    };
  };
}

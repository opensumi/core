import * as vscode from 'vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { CancellationToken } from '@ali/ide-core-common';
import { ExtHostAPIIdentifier, IExtHostMessage, IExtHostWebview, IExtHostTreeView, TreeViewOptions, ViewColumn, IWebviewPanelOptions, IWebviewOptions, WebviewPanel, WebviewPanelSerializer } from '../../common';
import { ExtHostStatusBar } from './ext.statusbar.host';
import { ExtHostQuickOpen } from './ext.host.quickopen';
import { Disposable } from 'vscode-ws-jsonrpc';
import { ExtensionHostEditorService } from '../editor/editor.host';
import { MessageType, IDisposable } from '@ali/ide-core-common';
import * as types from '../../common/ext-types';
import { ExtHostOutput } from './ext.host.output';
import { ExtHostWebviewService } from './ext.host.api.webview';
import { Uri } from '../../common/ext-types';
import { ExtHostWindowState } from './ext.host.window-state';

export function createWindowApiFactory(
  rpcProtocol: IRPCProtocol,
  extHostEditors: ExtensionHostEditorService,
  extHostMessage: IExtHostMessage,
  extHostWebviews: ExtHostWebviewService,
  extHostTreeView: IExtHostTreeView,
  ) {
  const extHostStatusBar = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostStatusBar, new ExtHostStatusBar(rpcProtocol));
  const extHostQuickOpen = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostQuickOpen, new ExtHostQuickOpen(rpcProtocol));
  const extHostOutput = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostOutput, new ExtHostOutput(rpcProtocol));
  const extHostWindowState = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostWindowState, new ExtHostWindowState(rpcProtocol));

  return {
    withProgress(options, task) {
      return Promise.resolve(task({
        report(value) {
          console.log(value);
        },
      }));
    },
    createStatusBarItem(alignment?: types.StatusBarAlignment, priority?: number): types.StatusBarItem {
      return extHostStatusBar.createStatusBarItem(alignment, priority);
    },
    createOutputChannel(name) {
      return extHostOutput.createOutputChannel(name);
    },
    setStatusBarMessage(text: string, arg?: number | Thenable<any>): Disposable {

      // step2
      return extHostStatusBar.setStatusBarMessage(text, arg);

    },
    showInformationMessage(message: string, first: vscode.MessageOptions | string | vscode.MessageItem, ...rest: (string | vscode.MessageItem)[]) {
      return extHostMessage.showMessage(MessageType.Info, message, first, ...rest);
    },
    showWarningMessage(message: string, first: vscode.MessageOptions | string | vscode.MessageItem, ...rest: Array<string | vscode.MessageItem>) {
      return extHostMessage.showMessage(MessageType.Warning, message, first, ...rest);
    },
    showErrorMessage(message: string, first: vscode.MessageOptions | string | vscode.MessageItem, ...rest: Array<string | vscode.MessageItem>) {
      return extHostMessage.showMessage(MessageType.Error, message, first, ...rest);
    },
    registerTreeDataProvider<T>(viewId: string, treeDataProvider: vscode.TreeDataProvider<T>) {
      return extHostTreeView.registerTreeDataProvider(viewId, treeDataProvider);
    },
    createTreeView<T>(viewId: string, options: TreeViewOptions<T>) {
      return extHostTreeView.createTreeView(viewId, options);
    },
    get activeTextEditor() {
      return extHostEditors.activeEditor && extHostEditors.activeEditor.textEditor;
    },
    get visibleTextEditors() {
      return extHostEditors.visibleEditors;
    },
    onDidChangeActiveTextEditor: extHostEditors.onDidChangeActiveTextEditor,
    onDidChangeVisibleTextEditors: extHostEditors.onDidChangeVisibleTextEditors,
    onDidChangeTextEditorSelection: extHostEditors.onDidChangeTextEditorSelection,
    onDidChangeTextEditorVisibleRanges: extHostEditors.onDidChangeTextEditorVisibleRanges,
    onDidChangeTextEditorOptions: extHostEditors.onDidChangeTextEditorOptions,
    onDidChangeTextEditorViewColumn: extHostEditors.onDidChangeTextEditorViewColumn,
    showTextDocument(arg0, arg1, arg2) {
      return extHostEditors.showTextDocument(arg0, arg1, arg2);
    },
    createTextEditorDecorationType(options: vscode.DecorationRenderOptions) {
      return extHostEditors.createTextEditorDecorationType(options);
    },
    showQuickPick(items: any, options: vscode.QuickPickOptions, token?: CancellationToken): Promise<vscode.QuickPickItem | undefined> {
      return extHostQuickOpen.showQuickPick(items, options, token);
    },
    createQuickPick<T extends vscode.QuickPickItem>(): vscode.QuickPick<T> {
      return extHostQuickOpen.createQuickPick();
    },
    showInputBox(options?: vscode.InputBoxOptions, token?: CancellationToken): PromiseLike<string | undefined> {
      return extHostQuickOpen.showInputBox(options, token);
    },
    createInputBox(): vscode.InputBox {
      return extHostQuickOpen.createInputBox();
    },
    createWebviewPanel(viewType: string, title: string, showOptions: ViewColumn | {preserveFocus: boolean, viewColumn: ViewColumn}, options?: IWebviewPanelOptions & IWebviewOptions): WebviewPanel {
      return extHostWebviews.createWebview(Uri.parse('not-implemented://'), viewType, title, showOptions, options);
    },
    registerWebviewPanelSerializer(viewType: string, serializer: WebviewPanelSerializer): IDisposable {
      return extHostWebviews.registerWebviewPanelSerializer(viewType, serializer);
    },
    registerDecorationProvider(args) {
      // TODO git
      console.log('registerDecorationProvider is not implemented');
    },
    registerUriHandler(args) {
       // TODO git
       console.log('registerUriHandler is not implemented');
    },

    onDidChangeWindowState: extHostWindowState.onDidChangeWindowState,

    state: extHostWindowState.state,

  };
}

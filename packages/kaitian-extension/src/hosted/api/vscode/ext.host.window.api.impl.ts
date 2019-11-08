import * as vscode from 'vscode';
import {
  IExtHostMessage, IExtHostTreeView, TreeViewOptions, ViewColumn, IWebviewPanelOptions,
  IWebviewOptions, WebviewPanel, WebviewPanelSerializer, IExtHostWindowState, IExtHostStatusBar,
  IExtHostQuickOpen, IExtHostOutput, IExtHostTerminal, IExtHostWindow, IMainThreadWindow, MainThreadAPIIdentifier, IExtOpenDialogOptions,
} from '../../../common/vscode';
import { MessageType, IDisposable, CancellationToken, Emitter } from '@ali/ide-core-common';

import { ExtensionHostEditorService } from './editor/editor.host';
import { ExtHostWebviewService } from './ext.host.api.webview';
import * as types from '../../../common/vscode/ext-types';
import { Uri, Disposable } from '../../../common/vscode/ext-types';
import { IExtension } from '../../../common';
import { IExtHostDecorationsShape } from '../../../common/vscode/decoration';
import { throwProposedApiError } from '../../../common/vscode/extension';
import { IRPCProtocol } from '@ali/ide-connection';

export function createWindowApiFactory(
  extension: IExtension,
  extHostEditors: ExtensionHostEditorService,
  extHostMessage: IExtHostMessage,
  extHostWebviews: ExtHostWebviewService,
  extHostTreeView: IExtHostTreeView,
  extHostWindowState: IExtHostWindowState,
  extHostDecorations: IExtHostDecorationsShape,
  extHostStatusBar: IExtHostStatusBar,
  extHostQuickOpen: IExtHostQuickOpen,
  extHostOutput: IExtHostOutput,
  extHostTerminal: IExtHostTerminal,
  extHostWindow: ExtHostWindow,
) {
  return {
    withProgress(options, task) {
      return Promise.resolve(task({
        report(value) {
          console.log(options, value);
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
    registerDecorationProvider: proposedApiFunction(extension, (provider: vscode.DecorationProvider) => {
      return extHostDecorations.registerDecorationProvider(provider, extension.id);
    }),
    registerUriHandler() {
       // TODO git
       console.log('registerUriHandler is not implemented');

       return {
         dispose: () => {},
       };
    },

    showOpenDialog: (options) => {
      return extHostWindow.openDialog(options);
    },

    get onDidChangeWindowState() {
      return extHostWindowState.onDidChangeWindowState;
    },

    get state() {
      return extHostWindowState.state;
    },

    /**
     * Terminal
     */
    get activeTerminal() {
      return extHostTerminal.activeTerminal;
    },

    get terminals() {
      return extHostTerminal.terminals;
    },

    onDidChangeActiveTerminal: extHostTerminal.onDidChangeActiveTerminal,

    onDidCloseTerminal: extHostTerminal.onDidCloseTerminal,

    onDidOpenTerminal: extHostTerminal.onDidOpenTerminal,

    createTerminal: extHostTerminal.createTerminal,
  };
}

function proposedApiFunction<T>(extension: IExtension, fn: T): T {
  if (extension.enableProposedApi) {
    return fn;
  } else {
    return throwProposedApiError.bind(null, extension) as any as T;
  }
}

export class ExtHostWindow implements IExtHostWindow {

  protected readonly proxy: IMainThreadWindow;

  private id = 0;
  private _onOpenedResult = new Emitter<{id: string, result: types.UriComponents[] | undefined}>();

  constructor(rpcProtocol: IRPCProtocol) {
    this.proxy = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadWindow);
  }

  openDialog(options: IExtOpenDialogOptions): Promise<types.Uri[] | undefined> {
    return new Promise<types.Uri[] | undefined> ((resolve, reject) => {
      const id = (this.id ++).toString();
      this.proxy.$showOpenDialog(id, options);
      const disposer = this._onOpenedResult.event((res) => {
        if (res.id === id) {
          disposer.dispose();
          resolve(res.result ? res.result.map((r) => Uri.revive(r)) : undefined);
        }
      });
    });
  }

  $onOpenDialogResult(id: string, result: types.UriComponents[] | undefined): void {
    this._onOpenedResult.fire({id, result});
  }

}

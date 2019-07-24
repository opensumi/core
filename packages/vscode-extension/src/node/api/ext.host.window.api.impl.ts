import * as vscode from 'vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier } from '../../common';
import { ExtHostStatusBar } from './ext.statusbar.host';
import { ExtHostMessage } from './ext.host.message';
import { ExtHostQuickOpen } from './ext.host.quickopen';
import { Disposable } from 'vscode-ws-jsonrpc';
import { ExtensionHostEditorService } from '../editor/editor.host';
import { MessageType } from '@ali/ide-core-common';
import * as types from '../../common/ext-types';

export function createWindowApiFactory(rpcProtocol: IRPCProtocol, extHostEditors: ExtensionHostEditorService) {

  const extHostStatusBar = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostStatusBar, new ExtHostStatusBar(rpcProtocol));
  const extHostMessage = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostMessage, new ExtHostMessage(rpcProtocol));
  const extHostQuickOpen = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostQuickOpen, new ExtHostQuickOpen(rpcProtocol));

  return {
    withProgress() {},
    createStatusBarItem(alignment?: types.StatusBarAlignment, priority?: number): types.StatusBarItem {
      return extHostStatusBar.createStatusBarItem(alignment, priority);
    },
    createOutputChannel() {
      return {
        appendLine: () => {},
      };
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
    showQuickPick(items: any, options: vscode.QuickPickOptions, token?: vscode.CancellationToken): Promise<vscode.QuickPickItem | undefined> {
      return extHostQuickOpen.showQuickPick(items, options, token);
    },
    createQuickPick<T extends vscode.QuickPickItem>(): vscode.QuickPick<T> {
      return extHostQuickOpen.createQuickPick();
    },
    showInputBox(options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): PromiseLike<string | undefined> {
      return extHostQuickOpen.showInputBox(options, token);
    },
    createInputBox(): vscode.InputBox {
      return extHostQuickOpen.createInputBox();
    },
  };
}

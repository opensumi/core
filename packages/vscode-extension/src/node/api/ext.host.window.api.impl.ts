import * as vscode from 'vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { MainMessageType, ExtHostAPIIdentifier } from '../../common';
import { ExtHostStatusBar } from './ext.statusbar.host';
import { ExtHostMessage } from './ext.host.message';
import { ExtHostQuickPick } from './ext.host.quickpick';
import { Disposable } from 'vscode-ws-jsonrpc';
import { ExtensionHostEditorService } from '../editor/editor.host';

export function createWindowApiFactory(rpcProtocol: IRPCProtocol, extHostEditors: ExtensionHostEditorService) {

  const extHostStatusBar = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostStatusBar, new ExtHostStatusBar(rpcProtocol));
  const extHostMessage = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostMessage, new ExtHostMessage(rpcProtocol));
  const extHostQuickPick = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostQuickPick, new ExtHostQuickPick(rpcProtocol));

  return {
    withProgress() {},
    createStatusBarItem() {
      return {
        hide: () => {},
      };
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
      return extHostMessage.showMessage(MainMessageType.Info, message, first, ...rest);
    },
    showWarningMessage(message: string, first: vscode.MessageOptions | string | vscode.MessageItem, ...rest: Array<string | vscode.MessageItem>) {
      return extHostMessage.showMessage(MainMessageType.Warning, message, first, ...rest);
    },
    showErrorMessage(message: string, first: vscode.MessageOptions | string | vscode.MessageItem, ...rest: Array<string | vscode.MessageItem>) {
      return extHostMessage.showMessage(MainMessageType.Error, message, first, ...rest);
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
    showQuickPick(items: any, options: vscode.QuickPickOptions, token?: vscode.CancellationToken): any {
      return extHostQuickPick.showQuickPick(items, options, token);
    },
    createQuickPick<T extends vscode.QuickPickItem>(): vscode.QuickPick<T> {
      return extHostQuickPick.createQuickPick();
    },
  };
}

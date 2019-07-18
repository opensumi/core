import * as vscode from 'vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { IMainThreadMessage, MainThreadAPIIdentifier, IExtHostMessage, MainMessageType, ExtHostAPIIdentifier } from '../../common';
import { ExtHostStatusBar } from './ext.statusbar.host';
import { Disposable } from 'vscode-ws-jsonrpc';

export class ExtHostMessage implements IExtHostMessage {
  private proxy: IMainThreadMessage;

  constructor(rpc: IRPCProtocol) {
    this.proxy = rpc.getProxy(MainThreadAPIIdentifier.MainThreadMessages);
  }

  async showMessage(type: MainMessageType, message: string, optionsOrFirstItem?: string | vscode.MessageItem | vscode.MessageOptions | undefined, ...rest: (string | vscode.MessageItem)[]): Promise<string | vscode.MessageItem | undefined> {
    const options: vscode.MessageOptions = {};
    const actions: string[] = [];
    const items: (string | vscode.MessageItem)[] = [];
    const pushItem = (item: string | vscode.MessageItem) => {
      items.push(item);
      if (typeof item === 'string') {
        actions.push(item);
      } else {
        actions.push(item.title);
      }
    };

    if (optionsOrFirstItem) {
      if (typeof optionsOrFirstItem === 'string' || 'title' in optionsOrFirstItem) {
        pushItem(optionsOrFirstItem);
      } else {
        if ('modal' in optionsOrFirstItem) {
          options.modal = optionsOrFirstItem.modal;
        }
      }
    }
    for (const item of rest) {
      pushItem(item);
    }
    return await this.proxy.$showMessage(type, message, options, actions);
  }

}

export function createWindowApiFactory(rpcProtocol: IRPCProtocol) {

  const extHostStatusBar = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostStatusBar, new ExtHostStatusBar(rpcProtocol));
  const extHostMessage = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostMessage, new ExtHostMessage(rpcProtocol));

  return {
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
  };
}

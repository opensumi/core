import * as vscode from 'vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { MainThreadAPIIdentifier, IExtHostQuickPick, IMainThreadQuickPick } from '../../common';
import { CancellationToken, hookCancellationToken } from '@ali/ide-core-common';
import { QuickPickItem } from '@ali/ide-quick-open';

type Item = string | vscode.QuickPickItem;

export class ExtHostQuickPick implements IExtHostQuickPick {
  private proxy: IMainThreadQuickPick;

  constructor(rpc: IRPCProtocol) {
    this.proxy = rpc.getProxy(MainThreadAPIIdentifier.MainThreadQuickPick);
  }

  showQuickPick(promiseOrItems: vscode.QuickPickItem[] | Promise<vscode.QuickPickItem[]>, options?: vscode.QuickPickOptions | undefined, token?: CancellationToken | undefined): Promise<vscode.QuickPickItem | undefined>;
  showQuickPick(promiseOrItems: vscode.QuickPickItem[] | Promise<vscode.QuickPickItem[]>, options?: (vscode.QuickPickOptions & { canSelectMany: true; }) | undefined, token?: CancellationToken | undefined): Promise<vscode.QuickPickItem[] | undefined>;
  showQuickPick(promiseOrItems: string[] | Promise<string[]>, options?: vscode.QuickPickOptions | undefined, token?: CancellationToken | undefined): Promise<string | undefined>;
  async showQuickPick(promiseOrItems: Item[] | Promise<Item[]>, options?: vscode.QuickPickOptions, token: CancellationToken = CancellationToken.None): Promise<Item | Item[] | undefined> {
    const items = await promiseOrItems;

    const pickItems = items.map((item) => {

      if (typeof item === 'string') {
        return item;
      } else {
        const quickPickItem: QuickPickItem<vscode.QuickPickItem> = {
          // QuickPickItem
          label: item.label,
          description: item.description,
          detail: item.detail,
          // vscode.QuickPickItem
          value: {
            label: item.label,
            description: item.description,
            detail: item.detail,
          },
        };

        return quickPickItem;
      }
    });

    const quickPickPromise = this.proxy.$showQuickPick(pickItems, options && {
      placeholder: options.placeHolder,
      fuzzyMatchDescription: options.matchOnDescription,
      fuzzyMatchDetail: options.matchOnDetail,
      ignoreFocusOut: options.ignoreFocusOut,
    });

    return hookCancellationToken<Item | undefined>(token, quickPickPromise)
            .then((value) => {
              if (value && options && typeof options.onDidSelectItem === 'function') {
                options.onDidSelectItem(value);
              }
              return value;
            });
  }

}

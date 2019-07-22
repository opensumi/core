import * as vscode from 'vscode';
import { IMainThreadQuickPick, IExtHostQuickPick, ExtHostAPIIdentifier } from '../../common';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { QuickPickService, QuickPickItem, QuickPickOptions } from '@ali/ide-quick-open';

@Injectable()
export class MainThreadQuickPick implements IMainThreadQuickPick {

  protected readonly proxy: IExtHostQuickPick;

  @Autowired(QuickPickService)
  protected quickPickService: QuickPickService;

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostQuickPick);
  }

  $showQuickPick(items: (string | QuickPickItem<vscode.QuickPickItem>)[], options?: QuickPickOptions): Promise<string | vscode.QuickPickItem | undefined> {
    return this.quickPickService.show(items, options);
  }

  $hideQuickPick(): void {
    this.quickPickService.hide();
  }

}

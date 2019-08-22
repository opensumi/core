import * as vscode from 'vscode';
import { IMainThreadQuickOpen, IExtHostQuickOpen, ExtHostAPIIdentifier } from '../../../common/vscode';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { QuickPickService, QuickPickItem, QuickPickOptions, QuickInputOptions, IQuickInputService } from '@ali/ide-quick-open';

@Injectable()
export class MainThreadQuickOpen implements IMainThreadQuickOpen {

  protected readonly proxy: IExtHostQuickOpen;

  @Autowired(QuickPickService)
  protected quickPickService: QuickPickService;

  @Autowired(IQuickInputService)
  protected quickInputService: IQuickInputService;

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostQuickOpen);
  }

  $showQuickPick(items: (string | QuickPickItem<vscode.QuickPickItem>)[], options?: QuickPickOptions): Promise<string | vscode.QuickPickItem | undefined> {
    return this.quickPickService.show(items, options);
  }

  $hideQuickPick(): void {
    this.quickPickService.hide();
  }

  $showQuickInput(options: QuickInputOptions, validateInput: boolean): Promise<string | undefined> {
    // 校验逻辑在扩展进程中执行
    if (validateInput) {
      options.validateInput = (val) => this.proxy.$validateInput(val);
    }

    return this.quickInputService.open(options);
  }

  $hideQuickinput(): void {
    this.quickInputService.hide();
  }

}

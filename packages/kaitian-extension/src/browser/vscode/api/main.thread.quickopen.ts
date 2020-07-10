import { IMainThreadQuickOpen, IExtHostQuickOpen, ExtHostAPIIdentifier,
} from '../../../common/vscode';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { QuickPickService, QuickPickItem, QuickPickOptions, QuickInputOptions } from '@ali/ide-quick-open';
import {
  QuickTitleBar,
} from '@ali/ide-quick-open/src/browser/quick-title-bar';
import { IQuickInputService } from '@ali/ide-core-browser/lib/quick-open';

@Injectable({ multiple: true })
export class MainThreadQuickOpen implements IMainThreadQuickOpen {

  protected readonly proxy: IExtHostQuickOpen;

  @Autowired(QuickPickService)
  protected quickPickService: QuickPickService;

  @Autowired(IQuickInputService)
  protected quickInputService: IQuickInputService;

  @Autowired(QuickTitleBar)
  protected quickTitleBarService: QuickTitleBar;

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostQuickOpen);
  }

  public dispose() { }

  $showQuickPick(items: QuickPickItem<number>[], options?: QuickPickOptions): Promise<number | undefined> {
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

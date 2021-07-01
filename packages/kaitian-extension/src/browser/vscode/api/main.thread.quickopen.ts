import { IMainThreadQuickOpen, IExtHostQuickOpen, ExtHostAPIIdentifier,
} from '../../../common/vscode';
import { Injectable, Optional, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { QuickPickService, QuickPickItem, QuickPickOptions, QuickInputOptions } from '@ali/ide-quick-open';
import {
  QuickTitleBar,
} from '@ali/ide-quick-open/lib/browser/quick-title-bar';
import { IQuickInputService } from '@ali/ide-core-browser/lib/quick-open';
import { Disposable } from '@ali/ide-core-browser';

@Injectable({ multiple: true })
export class MainThreadQuickOpen extends Disposable implements IMainThreadQuickOpen {

  protected readonly proxy: IExtHostQuickOpen;

  @Autowired(QuickPickService)
  protected quickPickService: QuickPickService;

  @Autowired(IQuickInputService)
  protected quickInputService: IQuickInputService;

  @Autowired(QuickTitleBar)
  protected quickTitleBarService: QuickTitleBar;

  constructor(@Optional(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    super();
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostQuickOpen);

    this.addDispose(
      this.quickTitleBarService.onDidTriggerButton(async (button) => {
        // @ts-ignore
        await this.proxy.$onDidTriggerButton(button.handler);
      }),
    );
  }

  $showQuickPick(_session: number, items: QuickPickItem<number>[], options?: QuickPickOptions): Promise<number | undefined> {
    return this.quickPickService.show(items, {
      ...options,
      onSelect: (_, index) => {
        // value 为 handle
        this.proxy.$onItemSelected(items[index].value);
      },
      onChangeValue: (value) => {
        this.proxy.$onDidChangeValue(_session, value);
      },
    });
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

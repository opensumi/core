import { IMainThreadQuickOpen, IExtHostQuickOpen, ExtHostAPIIdentifier } from '../../../common/vscode';
import { Injectable, Optional, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { Disposable } from '@opensumi/ide-core-browser';
import { IQuickInputService } from '@opensumi/ide-core-browser/lib/quick-open';
import { QuickPickService, QuickPickItem, QuickPickOptions, QuickInputOptions } from '@opensumi/ide-quick-open';
import { QuickTitleBar } from '@opensumi/ide-quick-open/lib/browser/quick-title-bar';

import { InputBoxImpl } from '@opensumi/ide-quick-open/lib/browser/quickInput.inputBox';

@Injectable({ multiple: true })
export class MainThreadQuickOpen extends Disposable implements IMainThreadQuickOpen {
  protected readonly proxy: IExtHostQuickOpen;

  @Autowired(QuickPickService)
  protected quickPickService: QuickPickService;

  @Autowired(IQuickInputService)
  protected quickInputService: IQuickInputService;

  @Autowired(QuickTitleBar)
  protected quickTitleBarService: QuickTitleBar;

  @Autowired(INJECTOR_TOKEN)
  protected injector: Injector;

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

  $showQuickPick(
    _session: number,
    items: QuickPickItem<number>[],
    options?: QuickPickOptions,
  ): Promise<number | undefined> {
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

  private createdInputBox = new Map<number, InputBoxImpl>();

  $createOrUpdateInputBox(id: number, options: QuickInputOptions) {
    if (this.createdInputBox.has(id)) {
      // 已经存在，需要更新
      const box = this.createdInputBox.get(id);
      box?.updateOptions(options);
    } else {
      const inputBox = this.injector.get(InputBoxImpl, [options]);
      inputBox.open();
      inputBox.onDidChangeValue((e) => {
        this.proxy.$onCreatedInputBoxDidChangeValue(id, e);
      });
      inputBox.onDidAccept(() => {
        this.proxy.$onCreatedInputBoxDidAccept(id);
      });
      this.createdInputBox.set(id, inputBox);
    }
  }

  $hideInputBox(id: number) {
    if (this.createdInputBox.has(id)) {
      const box = this.createdInputBox.get(id);
      box?.hide();
      this.proxy.$onCreatedInputBoxDidHide(id);
    }
    this.createdInputBox.delete(id);
  }

  $hideQuickinput(): void {
    this.quickInputService.hide();
  }
}

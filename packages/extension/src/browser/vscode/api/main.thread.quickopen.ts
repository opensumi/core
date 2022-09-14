import { Injectable, Optional, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { VALIDATE_TYPE } from '@opensumi/ide-components';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { Disposable } from '@opensumi/ide-core-browser';
import { IQuickInputService } from '@opensumi/ide-core-browser/lib/quick-open';
import { QuickPickService, QuickPickItem, QuickPickOptions, QuickInputOptions } from '@opensumi/ide-quick-open';
import { QuickOpenItemService } from '@opensumi/ide-quick-open/lib/browser/quick-open-item.service';
import { QuickTitleBar } from '@opensumi/ide-quick-open/lib/browser/quick-title-bar';
import { InputBoxImpl } from '@opensumi/ide-quick-open/lib/browser/quickInput.inputBox';

import { IMainThreadQuickOpen, IExtHostQuickOpen, ExtHostAPIIdentifier, Severity } from '../../../common/vscode';

@Injectable({ multiple: true })
export class MainThreadQuickOpen extends Disposable implements IMainThreadQuickOpen {
  protected readonly proxy: IExtHostQuickOpen;

  @Autowired(QuickPickService)
  protected quickPickService: QuickPickService;

  @Autowired(IQuickInputService)
  protected quickInputService: IQuickInputService;

  @Autowired(QuickTitleBar)
  protected quickTitleBarService: QuickTitleBar;

  @Autowired(QuickOpenItemService)
  protected quickOpenItemService: QuickOpenItemService;

  @Autowired(INJECTOR_TOKEN)
  protected injector: Injector;

  constructor(@Optional(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    super();
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostQuickOpen);

    this.addDispose([
      this.quickTitleBarService.onDidTriggerButton((button) => {
        this.proxy.$onDidTriggerButton((button as unknown as { handler: number }).handler);
      }),
      this.quickOpenItemService.onDidTriggerItemButton(({ item, button }) => {
        if (button.handle !== undefined) {
          this.proxy.$onDidTriggerItemButton(item.handle, button.handle);
        }
      }),
    ]);
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

  /**
   * 将插件 severity 转换为前端组件识别的 VALIDATE_TYPE
   * 由于插件进程不能依赖 @opensumi/ide-components 模块，所以在前端进行转换
   * @param severity
   * @returns
   */
  private severityToValidateType(severity?: Severity): VALIDATE_TYPE {
    switch (severity) {
      case Severity.Info:
        return VALIDATE_TYPE.INFO;
      case Severity.Warning:
        return VALIDATE_TYPE.WARNING;
      case Severity.Error:
        return VALIDATE_TYPE.ERROR;
      case Severity.Ignore:
        return VALIDATE_TYPE.IGNORE;
      default:
        return VALIDATE_TYPE.ERROR;
    }
  }

  $showQuickInput(options: QuickInputOptions, validateInput: boolean): Promise<string | undefined> {
    // 校验逻辑在扩展进程中执行
    if (validateInput) {
      options.validateInput = async (val) => {
        const result = await this.proxy.$validateInput(val);
        if (!result) {
          return result;
        }
        return typeof result === 'string'
          ? result
          : {
              message: result.message,
              type: this.severityToValidateType(result.severity),
            };
      };
    }

    return this.quickInputService.open(options);
  }

  private createdInputBox = new Map<number, InputBoxImpl>();

  $createOrUpdateInputBox(id: number, inputOptions: QuickInputOptions & { severity?: Severity }) {
    const options = {
      ...inputOptions,
      validationType: this.severityToValidateType(inputOptions?.severity),
    };
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
      inputBox.onDidHide(() => {
        this.proxy.$onCreatedInputBoxDidHide(id);
      });
      inputBox.onDidTriggerButton((btnHandle: number) => {
        this.proxy.$onCreatedInputBoxDidTriggerButton(id, btnHandle);
      });
      this.createdInputBox.set(id, inputBox);
    }
  }

  $hideInputBox(id: number) {
    if (this.createdInputBox.has(id)) {
      const box = this.createdInputBox.get(id);
      box?.hide();
    }
  }

  $disposeInputBox(id: number): void {
    if (this.createdInputBox.has(id)) {
      const box = this.createdInputBox.get(id);
      box?.dispose();
      this.createdInputBox.delete(id);
    }
  }

  $hideQuickInput(): void {
    this.quickInputService.hide();
  }
}

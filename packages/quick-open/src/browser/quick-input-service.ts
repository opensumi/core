import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { VALIDATE_TYPE } from '@opensumi/ide-components';
import { QuickInputOptions, IQuickInputService, QuickOpenService } from '@opensumi/ide-core-browser/lib/quick-open';
import { Deferred, Emitter, Event, withNullAsUndefined } from '@opensumi/ide-core-common';

import { QuickTitleBar } from './quick-title-bar';
import { InputBoxImpl } from './quickInput.inputBox';

@Injectable()
export class QuickInputService implements IQuickInputService {
  @Autowired(QuickOpenService)
  protected readonly quickOpenService: QuickOpenService;

  @Autowired(QuickTitleBar)
  protected readonly quickTitleBar: QuickTitleBar;

  @Autowired(INJECTOR_TOKEN)
  protected injector: Injector;

  inputBox?: InputBoxImpl;

  open(options: QuickInputOptions): Promise<string | undefined> {
    if (this.inputBox) {
      this.inputBox.hide();
    }

    const result = new Deferred<string | undefined>();
    const validateInput = options && options.validateInput;
    // 兼容旧逻辑
    if (options.hideOnDidAccept === undefined) {
      options.hideOnDidAccept = true;
    }

    const inputBox = this.injector.get(InputBoxImpl, [options]);
    this.inputBox = inputBox;

    inputBox.onDidAccept((v) => {
      result.resolve(v);
      this.onDidAcceptEmitter.fire();
    });

    inputBox.getDerivedOptionsFromValue = async (v) => {
      const error = validateInput && v !== undefined ? withNullAsUndefined(await validateInput(v)) : undefined;
      // 每次都要设置一下，因为 error 为空说明没有错
      return {
        validationMessage: typeof error === 'string' ? error : error?.message,
        validationType: typeof error === 'string' ? VALIDATE_TYPE.ERROR : error?.type ?? VALIDATE_TYPE.ERROR,
      };
    };

    inputBox.onDidChangeValue(async (v) => {
      this.onDidChangeValueEmitter.fire(v);
    });
    inputBox.onDidHide(() => {
      result.resolve(undefined);
    });
    inputBox.open();
    return result.promise;
  }

  refresh() {
    this.inputBox?.refresh();
  }

  hide(): void {
    this.inputBox?.hide();
  }

  dispose() {
    this.inputBox?.dispose();
  }

  readonly onDidAcceptEmitter: Emitter<void> = new Emitter();
  get onDidAccept(): Event<void> {
    return this.onDidAcceptEmitter.event;
  }

  readonly onDidChangeValueEmitter: Emitter<string> = new Emitter();
  get onDidChangeValue(): Event<string> {
    return this.onDidChangeValueEmitter.event;
  }
}

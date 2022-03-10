import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
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

    const inputBox = this.injector.get(InputBoxImpl, [options]);
    inputBox.onDidAccept((v) => {
      result.resolve(v);
      this.onDidAcceptEmitter.fire();
    });
    inputBox.onDidChangeValue(async (v) => {
      this.onDidChangeValueEmitter.fire(v);
      const error = validateInput && v !== undefined ? withNullAsUndefined(await validateInput(v)) : undefined;
      // 每次都要设置一下，因为 error 为空说明没有错
      inputBox.updateOptions({
        validationMessage: error,
      });
    });
    inputBox.onDidHide(() => {
      result.resolve(undefined);
    });
    inputBox.open();
    this.inputBox = inputBox;
    return result.promise;
  }

  refresh() {
    this.inputBox?.refresh();
  }

  hide(): void {
    this.inputBox?.hide();
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

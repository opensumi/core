import { Injectable, Autowired } from '@opensumi/di';
import { VALIDATE_TYPE } from '@opensumi/ide-core-browser/lib/components';
import {
  QuickInputOptions,
  QuickOpenItem,
  QuickOpenService,
  Mode,
  QuickOpenItemOptions,
} from '@opensumi/ide-core-browser/lib/quick-open';
import { localize, Emitter, Event } from '@opensumi/ide-core-common';

import { QuickTitleBar } from './quick-title-bar';

@Injectable({ multiple: true })
export class InputBoxImpl {
  private _options: QuickInputOptions = {};

  constructor(options: QuickInputOptions) {
    this._options = options;
  }

  getDerivedOptionsFromValue: ((value: string) => Promise<QuickInputOptions | undefined>) | undefined;

  shouldUpdate(newOptions: Partial<QuickInputOptions>, oldOptions: QuickInputOptions) {
    return (
      oldOptions.value !== newOptions.value ||
      oldOptions.prompt !== newOptions.prompt ||
      oldOptions.placeHolder !== newOptions.placeHolder ||
      oldOptions.password !== newOptions.password ||
      oldOptions.ignoreFocusOut !== newOptions.ignoreFocusOut ||
      oldOptions.enabled !== newOptions.enabled ||
      oldOptions.valueSelection !== newOptions.valueSelection ||
      oldOptions.title !== newOptions.title ||
      oldOptions.step !== newOptions.step ||
      oldOptions.totalSteps !== newOptions.totalSteps ||
      oldOptions.buttons !== newOptions.buttons ||
      oldOptions.validationMessage !== newOptions.validationMessage ||
      oldOptions.validationType !== newOptions.validationType
    );
  }

  updateOptions(newOptions: QuickInputOptions | undefined, noRefresh = false) {
    if (!newOptions) {
      return;
    }

    const oldOptions = Object.assign({}, this._options);

    this._options = {
      ...this._options,
      ...newOptions,
    };

    if (noRefresh) {
      return;
    }

    /**
     * 这里的刷新是有必要的，因为用户可能会更新 options 的值
     * 每次刷新会触发 onType，从而使页面的展示更新
     */
    if (this.shouldUpdate(newOptions, oldOptions)) {
      this.refresh();
    }
  }

  refresh() {
    this.quickOpenService.refresh();
  }

  get options() {
    return this._options;
  }

  set options(options: QuickInputOptions) {
    this._options = options;
  }

  @Autowired(QuickOpenService)
  protected readonly quickOpenService: QuickOpenService;

  @Autowired(QuickTitleBar)
  protected readonly quickTitleBar: QuickTitleBar;

  open() {
    let preLookFor = '';
    let triggeredInput = false;

    this.quickTitleBar.onDidTriggerButton((e) => {
      this.onDidTriggerButtonEmitter.fire((e as unknown as { handler: number }).handler);
    });

    this.quickOpenService.open(
      {
        onType: async (lookFor, acceptor) => {
          if (preLookFor !== lookFor) {
            preLookFor = lookFor;
            if (this.getDerivedOptionsFromValue) {
              const newOptions = await this.getDerivedOptionsFromValue(lookFor);
              this.updateOptions(newOptions, true);
            }
            this.onDidChangeValueEmitter.fire(lookFor);
            triggeredInput = true;
          }

          let label = this.options.prompt;
          const defaultPrompt = localize('quickopen.quickinput.prompt');

          if (
            this.options &&
            this.quickTitleBar.shouldShowTitleBar(this.options.title, this.options.step, this.options.buttons)
          ) {
            this.quickTitleBar.attachTitleBar(
              this.options.title,
              this.options.step,
              this.options.totalSteps,
              this.options.buttons,
            );
          }

          const error = this.options.validationMessage;
          if (error) {
            this.quickOpenService.showDecoration(this.options.validationType ?? VALIDATE_TYPE.ERROR);
          } else {
            this.quickOpenService.hideDecoration();
          }

          label = error || label;
          const itemOptions: QuickOpenItemOptions = {
            run: (mode) => {
              // 如果用户打开输入框后没有任何输入，不允许 accept
              if (!triggeredInput) {
                return false;
              }
              if (!error && mode === Mode.OPEN) {
                this.onDidAcceptEmitter.fire(lookFor);
                this.quickTitleBar.hide();
                return true;
              }
              return false;
            },
          };

          if (label) {
            // 用 detail 展示默认提示信息
            itemOptions.label = label;
            itemOptions.detail = defaultPrompt;
          } else {
            itemOptions.label = defaultPrompt;
          }

          acceptor([new QuickOpenItem(itemOptions)]);
        },
      },
      {
        prefix: this.options.value,
        placeholder: this.options.placeHolder,
        password: this.options.password,
        ignoreFocusOut: this.options.ignoreFocusOut,
        enabled: this.options.enabled,
        valueSelection: this.options.valueSelection,
        onClose: (canceled) => {
          // VSCode 对于这里的表现是，如果不是用户主动取消（说明调用成功），则不会调用 onDidHide
          if (canceled) {
            this.onDidHideEmitter.fire();
          }
          this.quickTitleBar.hide();
        },
      },
    );
  }

  dispose() {
    this.onDidAcceptEmitter.dispose();
    this.onDidChangeValueEmitter.dispose();
    this.onDidHideEmitter.dispose();
    this.onDidTriggerButtonEmitter.dispose();
  }

  hide(): void {
    this.quickOpenService.hideDecoration();
    this.quickOpenService.hide();
  }

  private readonly onDidAcceptEmitter: Emitter<string> = new Emitter();
  get onDidAccept(): Event<string> {
    return this.onDidAcceptEmitter.event;
  }

  private readonly onDidChangeValueEmitter: Emitter<string> = new Emitter();
  get onDidChangeValue(): Event<string> {
    return this.onDidChangeValueEmitter.event;
  }

  private readonly onDidTriggerButtonEmitter: Emitter<number> = new Emitter();
  get onDidTriggerButton(): Event<number> {
    return this.onDidTriggerButtonEmitter.event;
  }

  /**
   * 只在用户取消输入时触发，如果用户已经 accept 了输入，不会再触发该事件。
   * 如果用户主动调用了 hide() 方法，也会触发该事件。
   */
  private readonly onDidHideEmitter: Emitter<void> = new Emitter();
  get onDidHide(): Event<void> {
    return this.onDidHideEmitter.event;
  }
}

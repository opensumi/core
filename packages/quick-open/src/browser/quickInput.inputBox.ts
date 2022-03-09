import { Injectable, Autowired } from '@opensumi/di';
import {
  QuickInputOptions,
  QuickOpenItem,
  QuickOpenService,
  Mode,
  QuickOpenItemOptions,
} from '@opensumi/ide-core-browser/lib/quick-open';
import { QuickTitleBar } from './quick-title-bar';
import { localize, Emitter, Event } from '@opensumi/ide-core-common';
import { VALIDATE_TYPE } from '@opensumi/ide-core-browser/lib/components';

@Injectable({ multiple: true })
export class InputBoxImpl {
  private _options: QuickInputOptions = {};

  constructor(options: QuickInputOptions) {
    this._options = options;
  }

  updateOptions(_options: QuickInputOptions) {
    this._options = {
      ...this._options,
      ..._options,
    };
    this.refresh();
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
    this.quickOpenService.open(
      {
        onType: async (lookFor, acceptor) => {
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
          if (preLookFor !== lookFor) {
            this.onDidChangeValueEmitter.fire(lookFor);
            preLookFor = lookFor;
          }

          const error = this.options.validationMessage;
          if (error) {
            this.quickOpenService.showDecoration(VALIDATE_TYPE.ERROR);
          } else {
            this.quickOpenService.hideDecoration();
          }

          label = error || label;
          const itemOptions: QuickOpenItemOptions = {
            run: (mode) => {
              if (!error && mode === Mode.OPEN) {
                this.onDidAcceptEmitter.fire(lookFor);
                this.quickTitleBar.hide();
                return true;
              }
              return false;
            },
          };

          if (label) {
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
        onClose: () => {
          this.quickTitleBar.hide();
        },
      },
    );
  }

  hide(): void {
    this.quickOpenService.hideDecoration();
    this.quickOpenService.hide();
  }

  readonly onDidAcceptEmitter: Emitter<string> = new Emitter();
  get onDidAccept(): Event<string> {
    return this.onDidAcceptEmitter.event;
  }

  readonly onDidChangeValueEmitter: Emitter<string> = new Emitter();
  get onDidChangeValue(): Event<string> {
    return this.onDidChangeValueEmitter.event;
  }
}

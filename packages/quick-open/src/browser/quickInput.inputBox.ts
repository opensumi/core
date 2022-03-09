import { Injectable, Autowired } from '@opensumi/di';
import { QuickInputOptions, QuickOpenItem, QuickOpenService, Mode } from '@opensumi/ide-core-browser/lib/quick-open';
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
    let preLookfor = '';
    this.quickOpenService.open(
      {
        onType: async (lookFor, acceptor) => {
          const prompt = this.options.prompt;
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
          if (preLookfor !== lookFor) {
            this.onDidChangeValueEmitter.fire(lookFor);
            preLookfor = lookFor;
          }

          const error = this.options.validationMessage;
          if (error) {
            this.quickOpenService.showDecoration(VALIDATE_TYPE.ERROR);
          } else {
            this.quickOpenService.hideDecoration();
          }
          acceptor([
            new QuickOpenItem({
              label: error || prompt,
              description: defaultPrompt,
              run: (mode) => {
                if (!error && mode === Mode.OPEN) {
                  this.onDidAcceptEmitter.fire();
                  this.quickTitleBar.hide();
                  return true;
                }
                return false;
              },
            }),
          ]);
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

  readonly onDidAcceptEmitter: Emitter<void> = new Emitter();
  get onDidAccept(): Event<void> {
    return this.onDidAcceptEmitter.event;
  }

  readonly onDidChangeValueEmitter: Emitter<string> = new Emitter();
  get onDidChangeValue(): Event<string> {
    return this.onDidChangeValueEmitter.event;
  }
}

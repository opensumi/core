import { Injectable, Autowired } from '@opensumi/di';
import { VALIDATE_TYPE } from '@opensumi/ide-core-browser/lib/components';
import {
  QuickInputOptions,
  IQuickInputService,
  QuickOpenItem,
  QuickOpenService,
  Mode,
} from '@opensumi/ide-core-browser/lib/quick-open';
import { Deferred, localize, Emitter, Event } from '@opensumi/ide-core-common';

import { QuickTitleBar } from './quick-title-bar';

@Injectable()
export class QuickInputService implements IQuickInputService {
  @Autowired(QuickOpenService)
  protected readonly quickOpenService: QuickOpenService;

  @Autowired(QuickTitleBar)
  protected readonly quickTitleBar: QuickTitleBar;

  open(options: QuickInputOptions): Promise<string | undefined> {
    const result = new Deferred<string | undefined>();
    const prompt = this.createPrompt(options.prompt);
    let label = prompt;
    let currentText = '';
    const validateInput = options && options.validateInput;

    if (options && this.quickTitleBar.shouldShowTitleBar(options.title, options.step, options.buttons)) {
      this.quickTitleBar.attachTitleBar(options.title, options.step, options.totalSteps, options.buttons);
    }

    this.quickOpenService.open(
      {
        onType: async (lookFor, acceptor) => {
          this.onDidChangeValueEmitter.fire(lookFor);
          const error = validateInput && lookFor !== undefined ? await validateInput(lookFor) : undefined;
          label = error || prompt;
          if (error) {
            this.quickOpenService.showDecoration(VALIDATE_TYPE.ERROR);
          } else {
            this.quickOpenService.hideDecoration();
          }
          acceptor([
            new QuickOpenItem({
              label,
              run: (mode) => {
                if (!error && mode === Mode.OPEN) {
                  result.resolve(currentText);
                  this.onDidAcceptEmitter.fire(undefined);
                  this.quickTitleBar.hide();
                  return true;
                }
                return false;
              },
            }),
          ]);
          currentText = lookFor;
        },
      },
      {
        prefix: options.value,
        placeholder: options.placeHolder,
        password: options.password,
        ignoreFocusOut: options.ignoreFocusOut,
        enabled: options.enabled,
        valueSelection: options.valueSelection,
        onClose: () => {
          result.resolve(undefined);
          this.quickTitleBar.hide();
        },
      },
    );
    return result.promise;
  }

  refresh() {
    this.quickOpenService.refresh();
  }

  hide(): void {
    this.quickOpenService.hideDecoration();
    this.quickOpenService.hide();
  }

  protected createPrompt(prompt?: string): string {
    const defaultPrompt = localize('quickopen.quickinput.prompt');
    return prompt ? `${prompt} (${defaultPrompt})` : defaultPrompt;
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

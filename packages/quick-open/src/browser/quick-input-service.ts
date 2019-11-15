import { Injectable, Autowired } from '@ali/common-di';
import { QuickInputOptions, IQuickInputService, QuickOpenItem, QuickOpenMode, QuickOpenService } from './quick-open.model';
import { Deferred, MessageType, localize } from '@ali/ide-core-common';

@Injectable()
export class QuickInputService implements IQuickInputService {

  @Autowired(QuickOpenService)
  protected readonly quickOpenService: QuickOpenService;

  open(options: QuickInputOptions): Promise<string | undefined> {
    const result = new Deferred<string | undefined>();
    const prompt = this.createPrompt(options.prompt);
    let label = prompt;
    let currentText = '';
    const validateInput = options && options.validateInput;
    this.quickOpenService.open({
      onType: async (lookFor, acceptor) => {
        const error = validateInput ? await validateInput(lookFor) : undefined;
        label = error || prompt;
        if (error) {
          this.quickOpenService.showDecoration(MessageType.Error);
        } else {
          this.quickOpenService.hideDecoration();
        }
        acceptor([new QuickOpenItem({
          label,
          run: (mode) => {
            if (!error && mode === QuickOpenMode.OPEN) {
              result.resolve(currentText);
              return true;
            }
            return false;
          },
        })]);
        currentText = lookFor;
      },
    }, {
        prefix: options.value,
        placeholder: options.placeHolder,
        password: options.password,
        ignoreFocusOut: options.ignoreFocusOut,
        onClose: () => result.resolve(undefined),
      });
    return result.promise;
  }

  hide(): void {
    this.quickOpenService.hideDecoration();
    this.quickOpenService.hide();
  }

  protected createPrompt(prompt?: string): string {
    const defaultPrompt = localize('quickopen.quickinput.prompt');
    return prompt ? `${prompt} (${defaultPrompt})` : defaultPrompt;
  }

}

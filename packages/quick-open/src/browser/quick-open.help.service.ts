import { Injectable, Autowired } from '@ali/common-di';
import { QuickOpenHandler, QuickOpenHandlerRegistry } from './prefix-quick-open.service';
import { QuickOpenItem, PrefixQuickOpenService, QuickOpenMode, QuickOpenModel, QuickOpenOptions } from './quick-open.model';
import { CommandService, EDITOR_COMMANDS } from '@ali/ide-core-browser';

@Injectable()
export class HelpQuickOpenHandler implements QuickOpenHandler {

  readonly prefix: string = '?';
  readonly description: string = '';
  protected items: QuickOpenItem[];

  @Autowired(QuickOpenHandlerRegistry)
  protected readonly handlers: QuickOpenHandlerRegistry;

  @Autowired(PrefixQuickOpenService)
  protected readonly quickOpenService: PrefixQuickOpenService;

  @Autowired(CommandService)
  commandService: CommandService;

  init(): void {
    this.items = this.handlers.getHandlers()
      .filter((handler) => handler.prefix !== this.prefix)
      .sort((a, b) => this.comparePrefix(a.prefix, b.prefix))
      .map((handler) => new QuickOpenItem({
        label: handler.prefix,
        description: handler.description,
        run: (mode: QuickOpenMode) => {
          if (mode !== QuickOpenMode.OPEN) {
            return false;
          }
          this.quickOpenService.open(handler.prefix);
          return false;
        },
      }));
  }

  getModel(): QuickOpenModel {
    return {
      onType: (lookFor: string, acceptor: (items: QuickOpenItem[]) => void) => {
        acceptor(this.items);
      },
    };
  }

  getOptions() {
    return {};
  }

  onClose() {
    this.commandService.executeCommand(EDITOR_COMMANDS.FOCUS.id);
  }

  protected comparePrefix(a: string, b: string): number {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  }
}

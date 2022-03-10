import { Injectable, Autowired } from '@opensumi/di';
import { CommandService, EDITOR_COMMANDS } from '@opensumi/ide-core-browser';
import { QuickOpenItem, PrefixQuickOpenService, QuickOpenModel, Mode } from '@opensumi/ide-core-browser/lib/quick-open';

import { QuickOpenHandler, QuickOpenHandlerRegistry } from './prefix-quick-open.service';


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
    this.items = this.handlers
      .getHandlers()
      .filter((handler) => handler.prefix !== this.prefix)
      .sort((a, b) => this.comparePrefix(a.prefix, b.prefix))
      .map(
        (handler) =>
          new QuickOpenItem({
            label: handler.prefix,
            description: handler.description,
            run: (mode: Mode) => {
              if (mode !== Mode.OPEN) {
                return false;
              }
              this.quickOpenService.open(handler.prefix);
              return false;
            },
          }),
      );
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

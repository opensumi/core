import { Injectable, Autowired } from '@ali/common-di';
import { QuickOpenHandler, QuickOpenHandlerRegistry } from './prefix-quick-open.service';
import { QuickOpenItem, PrefixQuickOpenService, QuickOpenMode, QuickOpenModel, QuickOpenOptions } from './quick-open.model';

@Injectable()
export class HelpQuickOpenHandler implements QuickOpenHandler {

  readonly prefix: string = '?';
  readonly description: string = '';
  protected items: QuickOpenItem[];

  @Autowired(QuickOpenHandlerRegistry)
  protected readonly handlers: QuickOpenHandlerRegistry;

  @Autowired(PrefixQuickOpenService)
  protected readonly quickOpenService: PrefixQuickOpenService;

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
      getItems: () => this.items,
    };
  }

  getOptions(): QuickOpenOptions {
    return {};
  }

  protected comparePrefix(a: string, b: string): number {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  }
}

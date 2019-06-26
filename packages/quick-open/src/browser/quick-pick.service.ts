import { Injectable, Autowired } from '@ali/common-di';
import { QuickOpenMode, QuickOpenItem, QuickOpenGroupItem, QuickOpenItemOptions, QuickPickService, QuickOpenService, QuickPickOptions, QuickPickItem } from './quick-open.model';

@Injectable()
export class QuickPickServiceImpl implements QuickPickService {

  @Autowired(QuickOpenService)
  protected readonly quickOpenService: QuickOpenService;

  show(elements: string[], options?: QuickPickOptions): Promise<string | undefined>;
  show<T>(elements: QuickPickItem<T>[], options?: QuickPickOptions): Promise<T | undefined>;
  async show<T>(elements: (string | QuickPickItem<T>)[], options?: QuickPickOptions): Promise<T | string | undefined> {
      return new Promise<T | string | undefined>((resolve) => {
          const items = this.toItems<T>(elements, resolve);
          if (items.length === 0) {
              resolve(undefined);
              return;
          }
          if (items.length === 1) {
              items[0].run(QuickOpenMode.OPEN);
              return;
          }

          this.quickOpenService.open({
            getItems: () => items,
          }, Object.assign({
              onClose: () => resolve(undefined),
              fuzzyMatchLabel: true,
              fuzzyMatchDescription: true,
          }, options));
      });
  }
  protected toItems<T>(elements: (string | QuickPickItem<T>)[], resolve: (element: T | string) => void): QuickOpenItem[] {
      const items: QuickOpenItem[] = [];
      let groupLabel: string | undefined;
      for (const element of elements) {
        const options = this.toItemOptions(element, resolve);
        if (groupLabel) {
            items.push(new QuickOpenGroupItem(Object.assign(options, { groupLabel, showBorder: true })));
            groupLabel = undefined;
        } else {
            items.push(new QuickOpenItem(options));
        }
      }
      return items;
  }
  protected toItemOptions<T>(element: string | QuickPickItem<T>, resolve: (element: T | string) => void): QuickOpenItemOptions {
      const label = typeof element === 'string' ? element : element.label;
      const value = typeof element === 'string' ? element : element.value;
      const description = typeof element === 'string' ? undefined : element.description;
      const detail = typeof element === 'string' ? undefined : element.detail;
      const iconClass = typeof element === 'string' ? undefined : element.iconClass;
      return {
          label,
          description,
          detail,
          iconClass,
          run: (mode) => {
              if (mode !== QuickOpenMode.OPEN) {
                  return false;
              }
              resolve(value);
              return true;
          },
      };
  }

}

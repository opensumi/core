import { Injectable, Autowired } from '@opensumi/di';
import { getIcon, getIconClass, getExternalIcon } from '@opensumi/ide-core-browser';
import {
  QuickOpenService,
  QuickOpenItem,
  QuickOpenItemOptions,
  QuickPickService,
  QuickPickOptions,
  QuickPickItem,
  HideReason,
  Mode,
} from '@opensumi/ide-core-browser/lib/quick-open';
import { Emitter, Event } from '@opensumi/ide-core-common';

import { QuickTitleBar } from './quick-title-bar';


@Injectable()
export class QuickPickServiceImpl implements QuickPickService {
  @Autowired(QuickTitleBar)
  protected readonly quickTitleBar: QuickTitleBar;

  @Autowired(QuickOpenService)
  protected readonly quickOpenService: QuickOpenService;

  show(elements: string[], options?: QuickPickOptions): Promise<string | undefined>;
  show<T>(elements: QuickPickItem<T>[], options?: QuickPickOptions): Promise<T | undefined>;
  show<T>(elements: QuickPickItem<T>[], options?: QuickPickOptions & { canPickMany: true }): Promise<T[] | undefined>;
  async show<T>(
    elements: (string | QuickPickItem<T>)[],
    options?: QuickPickOptions & { canPickMany: true },
  ): Promise<T | T[] | undefined> {
    return new Promise<T | T[] | undefined>((resolve) => {
      const items = this.toItems(elements, resolve);
      if (options && this.quickTitleBar.shouldShowTitleBar(options.title, options.step, options.buttons)) {
        this.quickTitleBar.attachTitleBar(options.title, options.step, options.totalSteps, options.buttons);
      }
      const prefix = options && options.value ? options.value : '';
      this.quickOpenService.open(
        {
          onType: (_, acceptor) => {
            acceptor(items);
            this.onDidChangeActiveItemsEmitter.fire(items);
          },
        },
        Object.assign(
          {
            onClose: () => {
              this.quickTitleBar.hide();
              resolve(undefined);
            },
            onConfirm: (items: QuickOpenItem[]) => {
              this.quickTitleBar.hide();
              resolve(items.map((item) => item.getValue()));
            },
            fuzzyMatchLabel: true,
            fuzzyMatchDescription: true,
            prefix,
          },
          options,
        ),
      );
    });
  }

  hide(reason?: HideReason): void {
    this.quickOpenService.hide(reason);
  }

  protected toItems<T>(
    elements: (string | QuickPickItem<T>)[],
    resolve: (element: T | string) => void,
  ): QuickOpenItem[] {
    const items: QuickOpenItem[] = [];
    for (const element of elements) {
      const options = this.toItemOptions(element, resolve);
      items.push(new QuickOpenItem(options));
    }
    return items;
  }
  protected toItemOptions<T>(
    element: string | QuickPickItem<T>,
    resolve: (element: T | string) => void,
  ): QuickOpenItemOptions {
    let label = typeof element === 'string' ? element : element.label;
    let iconClass = typeof element === 'string' ? undefined : element.iconClass;
    const value = typeof element === 'string' ? element : element.value;
    const description = typeof element === 'string' ? undefined : element.description;
    const detail = typeof element === 'string' ? undefined : element.detail;
    const groupLabel = typeof element === 'string' ? undefined : element.groupLabel;
    const showBorder = typeof element === 'string' ? undefined : element.showBorder;
    const [icon, text] = getIconClass(label);

    if (icon) {
      iconClass = getIcon(icon) || getExternalIcon(icon);
      label = ` ${text}`;
    }
    return {
      label,
      description,
      detail,
      iconClass,
      groupLabel,
      showBorder,
      run: (mode) => {
        if (mode !== Mode.OPEN) {
          return false;
        }
        resolve(value);
        this.onDidAcceptEmitter.fire(undefined);
        return true;
      },
      value,
    };
  }

  private readonly onDidAcceptEmitter: Emitter<void> = new Emitter();
  readonly onDidAccept: Event<void> = this.onDidAcceptEmitter.event;

  private readonly onDidChangeActiveItemsEmitter: Emitter<QuickOpenItem[]> = new Emitter<QuickOpenItem[]>();
  readonly onDidChangeActiveItems: Event<QuickOpenItem[]> = this.onDidChangeActiveItemsEmitter.event;
}

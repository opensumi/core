import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { localize, formatLocalize, QuickOpenHandler, View } from '@opensumi/ide-core-browser';
import {
  QuickOpenItem,
  PrefixQuickOpenService,
  QuickOpenModel,
  QuickOpenItemOptions,
  Mode,
} from '@opensumi/ide-core-browser/lib/quick-open';

import { IMainLayoutService } from '../common';

@Injectable()
export class ViewQuickOpenHandler implements QuickOpenHandler {
  readonly prefix: string = 'view ';
  readonly description: string = localize('layout.action.openView');
  protected items: QuickOpenItem[];

  @Autowired(PrefixQuickOpenService)
  protected readonly quickOpenService: PrefixQuickOpenService;

  @Autowired(IMainLayoutService)
  private readonly layoutService: IMainLayoutService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  getModel(): QuickOpenModel {
    return {
      onType: (lookFor: string, acceptor: (items: QuickOpenItem[]) => void) => acceptor(this.getViewQuickOpenItems()),
    };
  }

  getViewQuickOpenItems() {
    const maps = this.layoutService.getAllAccordionService();
    const containerIds = Array.from(maps.keys());
    let items: (ContainerQuickOpenItem | ViewQuickOpenItem)[] = [];
    items = items.concat(
      containerIds.map((id, index) =>
        this.injector.get(ContainerQuickOpenItem, [
          id,
          {
            groupLabel: index === 0 ? localize('layout.openView.containerTitle') : '',
            showBorder: false,
          },
        ]),
      ),
    );
    for (const id of containerIds) {
      const views = maps.get(id)?.views;
      if (!views) {
        continue;
      }
      for (let i = 0, len = views.length; i < len; i++) {
        items.push(
          this.injector.get(ViewQuickOpenItem, [
            id,
            views[i],
            {
              groupLabel: i === 0 ? formatLocalize('layout.openView.viewTitle', String(id).toLocaleUpperCase()) : '',
              showBorder: false,
            },
          ]),
        );
      }
    }
    return items;
  }

  getOptions() {
    return {};
  }

  onClose() {}
}

@Injectable({ multiple: true })
export class ContainerQuickOpenItem extends QuickOpenItem {
  @Autowired(IMainLayoutService)
  private layoutService: IMainLayoutService;

  constructor(private readonly containerId, protected readonly options: QuickOpenItemOptions) {
    super(options);
  }

  getLabel() {
    return String(this.containerId).toLocaleUpperCase();
  }

  isHidden(): boolean {
    return super.isHidden();
  }

  run(mode: Mode): boolean {
    if (mode !== Mode.OPEN) {
      return false;
    }
    const handler = this.layoutService.getTabbarHandler(this.containerId);
    handler?.activate();
    return true;
  }
}

@Injectable({ multiple: true })
export class ViewQuickOpenItem extends QuickOpenItem {
  @Autowired(IMainLayoutService)
  private layoutService: IMainLayoutService;

  constructor(
    private readonly containerId: string,
    private readonly view: View,
    protected readonly options: QuickOpenItemOptions,
  ) {
    super(options);
  }

  getLabel() {
    return this.view.name;
  }

  isHidden(): boolean {
    return super.isHidden();
  }

  run(mode: Mode): boolean {
    if (mode !== Mode.OPEN) {
      return false;
    }
    const handler = this.layoutService.getTabbarHandler(this.containerId);
    if (handler) {
      handler.activate();
      if (handler.isCollapsed(this.view.id)) {
        handler?.setCollapsed(this.view.id, false);
      }
    }
    return true;
  }
}

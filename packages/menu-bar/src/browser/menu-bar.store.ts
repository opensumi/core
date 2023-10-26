import debounce from 'lodash/debounce';
import { observable, action } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import { Disposable, Emitter, Event, getExternalIcon } from '@opensumi/ide-core-browser';
import {
  AbstractMenubarService,
  IMenuRegistry,
  IMenubarItem,
  ISubmenuItem,
  MenuId,
  MenuNode,
} from '@opensumi/ide-core-browser/lib/menu/next';

export abstract class AbstractMenubarStore extends Disposable {
  menubarItems: IMenubarItem[];
  abstract handleMenubarClick(menuId: string): void;
}

@Injectable()
export class MenubarStore extends Disposable implements AbstractMenubarStore {
  @Autowired(AbstractMenubarService)
  private readonly menubarService: AbstractMenubarService;

  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  @observable
  public menubarItems = observable.array<IMenubarItem>([]);

  @observable
  public menuItems = observable.map<string, MenuNode[]>();

  private readonly _onDidMenuBarChange = new Emitter<IMenubarItem[]>();
  public get onDidMenuBarChange(): Event<IMenubarItem[]> {
    return this._onDidMenuBarChange.event;
  }

  constructor() {
    super();

    this.build();
    this.registerDispose(this.menubarService.onDidMenubarChange(this.handleMenubarChanged, this, this.disposables));
    this.registerDispose(this.menubarService.onDidMenuChange(this.handleMenuChanged, this, this.disposables));
  }

  private getMenubarSubItems(menuId: string): MenuNode[] {
    this.menubarService.rebuildMenuNodes(menuId);
    return this.menubarService.getMenuNodes(menuId) || [];
  }

  @action.bound
  private updateMenuNodes(menuId: string) {
    const menuItems = this.getMenubarSubItems(menuId);
    this.menuItems.set(menuId, menuItems);
  }

  private build() {
    const menubarItems = this.menubarService.getMenubarItems();
    this.menubarItems.splice(0, this.menubarItems.length, ...menubarItems);
    menubarItems.forEach(({ id: menuId }) => {
      this.updateMenuNodes(menuId);
    });
    this._onDidMenuBarChange.fire(this.menubarItems);
  }

  private handleMenuChanged(menuId: string) {
    this.updateMenuNodes(menuId);
  }

  private handleMenubarChanged() {
    const menubarItems = this.menubarService.getMenubarItems();
    this.menubarItems.replace(menubarItems);
    this._onDidMenuBarChange.fire(this.menubarItems);
  }

  @action.bound
  public handleMenubarClick: (menuId: string) => void = debounce(
    (menuId: string) => {
      this.updateMenuNodes(menuId);
    },
    500,
    { leading: true, trailing: true },
  );

  public unregisterMenusBarByCompact(menuId: MenuId = MenuId.ActivityBarTopExtra) {
    this.menuRegistry.unregisterMenuItem(menuId, MenuId.MenubarCompactMenu);
  }

  public registerMenuItemByCompactMenu(menuId: MenuId = MenuId.ActivityBarTopExtra) {
    this.menuRegistry.registerMenuItem(menuId, {
      submenu: MenuId.MenubarCompactMenu,
      iconClass: getExternalIcon('menu'),
      order: 1,
      group: 'navigation',
    });
  }

  public registerMenusBarByCompact(menubarItems: IMenubarItem[] = this.menubarItems) {
    this.menuRegistry.registerMenuItems(
      MenuId.MenubarCompactMenu,
      menubarItems.map(
        (item: IMenubarItem) =>
          ({
            label: item.label,
            submenu: item.id,
            iconClass: item.iconClass,
          } as ISubmenuItem),
      ),
    );
  }
}

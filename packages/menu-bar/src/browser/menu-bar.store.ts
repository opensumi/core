import debounce from 'lodash/debounce';

import { Autowired, Injectable } from '@opensumi/di';
import { Disposable, Emitter, Event, getExternalIcon } from '@opensumi/ide-core-browser';
import {
  AbstractMenubarService,
  IMenuRegistry,
  IMenubarItem,
  ISubmenuItem,
  MenuId,
  MenuNode,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { IObservable, observableValue, transaction } from '@opensumi/ide-monaco/lib/common/observable';

export abstract class AbstractMenubarStore extends Disposable {
  menubarItems: IObservable<IMenubarItem[]>;
  abstract handleMenubarClick(menuId: string): void;
}

@Injectable()
export class MenubarStore extends Disposable implements AbstractMenubarStore {
  @Autowired(AbstractMenubarService)
  private readonly menubarService: AbstractMenubarService;

  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  public readonly menubarItems = observableValue<IMenubarItem[]>(this, []);
  public readonly menuItems: Map<string, MenuNode[]> = (this, new Map());

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

  private updateMenuNodes(menuId: string) {
    const menuItems = this.getMenubarSubItems(menuId);
    this.menuItems.set(menuId, menuItems);
  }

  private build() {
    const menubarItems = this.menubarService.getMenubarItems();
    const itemsValue = this.menubarItems.get();
    transaction((tx) => {
      itemsValue.splice(0, itemsValue.length, ...menubarItems);
      this.menubarItems.set(itemsValue, tx);
    });

    menubarItems.forEach(({ id: menuId }) => {
      this.updateMenuNodes(menuId);
    });
    this._onDidMenuBarChange.fire(itemsValue);
  }

  private handleMenuChanged(menuId: string) {
    this.updateMenuNodes(menuId);
  }

  private handleMenubarChanged() {
    const menubarItems = this.menubarService.getMenubarItems();
    transaction((tx) => {
      this.menubarItems.set(menubarItems, tx);
    });
    this._onDidMenuBarChange.fire(this.menubarItems.get());
  }

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

  public registerMenusBarByCompact(menubarItems: IMenubarItem[] = this.menubarItems.get()) {
    this.menuRegistry.registerMenuItems(
      MenuId.MenubarCompactMenu,
      menubarItems.map(
        (item: IMenubarItem) =>
          ({
            label: item.label,
            submenu: item.id,
          } as ISubmenuItem),
      ),
    );
  }
}

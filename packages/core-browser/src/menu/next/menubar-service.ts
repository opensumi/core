import { Injectable, Autowired } from '@ali/common-di';
import { Event, Emitter } from '@ali/ide-core-common/lib/event';
import { IDisposable, Disposable } from '@ali/ide-core-common/lib/disposable';

import { MenuService, IMenu, SubmenuItemNode } from './menu-service';
import { IMenubarItem, IMenuRegistry, MenuNode } from './base';
import { generateCtxMenu } from './menu-util';
import { Logger } from '../../logger';

export abstract class AbstractMenubarService extends Disposable {
  readonly onDidMenuBarChange: Event<string | undefined>;
  abstract getMenubarItems(): IMenubarItem[];
  abstract getMenubarItem(menuId: string): IMenubarItem | undefined;

  readonly onDidMenuChange: Event<string>;
  abstract getMenuItem(menuId: string): MenuNode[];
}

@Injectable()
export class MenubarServiceImpl extends Disposable implements AbstractMenubarService {
  @Autowired(MenuService)
  private readonly menuService: MenuService;

  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  @Autowired(Logger)
  protected readonly logger: Logger;

  private readonly _onDidMenuBarChange = new Emitter<string | undefined>();
  /**
   * Menubar 本身发生变化时的事件
   * undefined 表示整个都需要刷新
   * 带了 menuId 只需要刷新单个 MenuBarItem
  */
  get onDidMenuBarChange(): Event<string | undefined> {
    return this._onDidMenuBarChange.event;
  }

  private readonly _onDidMenuChange = new Emitter<string>();
  get onDidMenuChange(): Event<string> {
    return this._onDidMenuChange.event;
  }

  private listenerDisposables: Map<string, IDisposable> = new Map();

  private _menubarIds: Set<string> = new Set();
  private _menus: Map<string, IMenu> = new Map();

  private _menubarItems: IMenubarItem[] = [];
  private _menuItems: Map<string, MenuNode[]> = new Map();

  constructor() {
    super();
    this._buildMenubars();
    this._buildMenus();

    // event for MenubarId
    this.addDispose(Event.debounce(
      this.menuRegistry.onDidChangeMenubar,
      () => { },
      50,
    )(this._buildMenubars, this));

    // event for MenuIds
    this.addDispose(Event.debounce(
      Event.filter(this.menuRegistry.onDidChangeMenu, (menuId: string) => this._menus.has(menuId)),
      () => { },
      50,
    )(this._buildMenus, this));

    this.addDispose(this._onDidMenuBarChange);
    this.addDispose(this._onDidMenuChange);
  }

  private _buildMenubars() {
    // reset
    this._menubarItems = [];
    this._menubarIds = new Set();

    let menubarItems = this.menuRegistry.getMenubarItems();
    menubarItems = menubarItems.sort(menubarItemsSorter);

    menubarItems.forEach((menubarItem) => {
      const menuId = menubarItem.id;
      this._menubarItems.push(menubarItem);
      // keep menuId for eventing
      this._menubarIds.add(menuId);
    });
    this._onDidMenuBarChange.fire(undefined);
  }

  private disposeMenuListener() {
    this.listenerDisposables.forEach((disposable) => {
      disposable.dispose();
    });
    this.listenerDisposables.clear();
  }

  private disposeMenus() {
    this._menus.forEach((menu) => menu.dispose());
    this._menus.clear();
  }

  private _buildMenus() {
    // reset
    this._menuItems.clear();
    this.disposeMenus();
    this.disposeMenuListener();

    this._menubarItems.forEach(({ id: menuId }) => {
      const menus = this.menuService.createMenu(menuId);

      this._menus.set(menuId, menus);
      this.listenerDisposables.set(
        menuId,
        menus.onDidChange(() => this._onDidMenuChange.fire(menuId), this, this.disposables),
      );

      const menubarMenu = [] as MenuNode[];
      this.buildMenuItems(menuId, menus, menubarMenu);
      this._menuItems.set(menuId, menubarMenu);
    });

    this._onDidMenuBarChange.fire(undefined);
  }

  dispose() {
    this.listenerDisposables.forEach((disposable) => {
      disposable.dispose();
    });
    super.dispose();
  }

  public getMenubarItems() {
    return Array.from(this._menubarIds).reduce((prev, menuId: string) => {
      const menubarItem = this.menuRegistry.getMenubarItem(menuId);
      if (menubarItem) {
        prev.push(menubarItem);
      }
      return prev;
    }, [] as IMenubarItem[]);
  }

  public getMenubarItem(menuId: string) {
    if (!this._menubarIds.has(menuId)) {
      return undefined;
    }

    return this.menuRegistry.getMenubarItem(menuId);
  }

  public getMenuItem(menuId: string) {
    return this._menuItems.get(menuId) || [];
  }

  buildMenuItems(menuId: string, menus: IMenu, menuToPopulate: any[]) {
    const result = generateCtxMenu({ menus });
    const menuItems = [...result[0], ...result[1]];
    menuItems.forEach((menuItem) => {
      if (menuItem instanceof SubmenuItemNode) {
        const submenuItems = [];

        const submenuId = menuItem.item.submenu;
        if (!this._menus.has(submenuId)) {
          const menus = this.registerDispose(this.menuService.createMenu(submenuId));
          this._menus.set(submenuId, menus);
          this.registerDispose(menus.onDidChange(() => {
            this._onDidMenuChange.fire(menuId);
          }));
        }

        const menuToDispose = this.menuService.createMenu(submenuId);
        this.buildMenuItems(submenuId, menuToDispose, submenuItems);

        const menubarSubmenuItem = {
          id: menuItem.id,
          label: menuItem.label,
          submenu: submenuId,
          items: submenuItems,
        };
        menuToPopulate.push(menubarSubmenuItem);
        menuToDispose.dispose();
      } else {
        menuToPopulate.push(menuItem);
      }
    });
  }
}

function menubarItemsSorter(a: IMenubarItem, b: IMenubarItem): number {
  // sort on priority - default is 0
  const aPrio = a.order || 0;
  const bPrio = b.order || 0;
  if (aPrio < bPrio) {
    return -1;
  } else if (aPrio > bPrio) {
    return 1;
  }
  return 0;
}

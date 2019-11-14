import { Injectable, Autowired } from '@ali/common-di';
import { Disposable, Event, Emitter } from '@ali/ide-core-browser';
import { IDisposable } from '@ali/ide-core-common';

import { MenuService, IMenu } from './menu-service';
import { IMenubarItem, IMenuRegistry } from './base';
import { Logger } from '../../logger';

export abstract class AbstractMenubarService extends Disposable {
  readonly onDidMenuBarChange: Event<string | undefined>;
  abstract getMenubarItems(): IMenubarItem[];
  abstract getMenubarItem(menuId: string): IMenubarItem | undefined;

  readonly onDidMenuChange: Event<string>;
  abstract getMenuItems(): Map<string, IMenu>;
  abstract getMenuItem(menuId: string): IMenu | undefined;
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

  private menubarIds: Set<string> = new Set();

  private readonly _onDidMenuChange = new Emitter<string>();
  get onDidMenuChange(): Event<string> {
    return this._onDidMenuChange.event;
  }

  private menuItems: Map<string, IMenu> = new Map();

  private listenerDisposables: Map<string, IDisposable> = new Map();

  constructor() {
    super();
    this.collectMenubarIds();
    this.menuRegistry.onDidChangeMenubar(this.handleMenubarChanged, this, this.disposables);
  }

  dispose() {
    this.listenerDisposables.forEach((disposable) => {
      disposable.dispose();
    });
    super.dispose();
  }

  public getMenubarItems() {
    return Array.from(this.menubarIds).reduce((prev, menuId: string) => {
      const menubarItem = this.menuRegistry.getMenubarItem(menuId);
      if (menubarItem) {
        prev.push(menubarItem);
      }
      return prev;
    }, [] as IMenubarItem[]);
  }

  public getMenubarItem(menuId: string) {
    if (!this.menubarIds.has(menuId)) {
      return undefined;
    }

    return this.menuRegistry.getMenubarItem(menuId);
  }

  public getMenuItems() {
    return this.menuItems;
  }

  public getMenuItem(menuId: string) {
    return this.menuItems.get(menuId);
  }

  private collectMenubarIds() {
    const menubarItems = this.menuRegistry.getMenubarItems();
    menubarItems.forEach((menubarItem) => {
      const menuId = menubarItem.id;
      this.menubarIds.add(menuId);
      this.addMenuFromMenubar(menuId);
    });
    this._onDidMenuBarChange.fire(undefined);
  }

  private handleMenuChanged = (menuId: string) => () => {
    this._onDidMenuChange.fire(menuId);
  }

  private handleMenubarChanged(menuId: string) {
    this.collectMenuId(menuId);
  }

  private collectMenuId(menuId: string) {
    if (this.menubarIds.has(menuId)) {
      this.logger.warn(`MenuId: ${menuId} already exists`);
      return;
    }
    this.menubarIds.add(menuId);
    this._onDidMenuBarChange.fire(menuId);
    this.addMenuFromMenubar(menuId);
  }

  private addMenuFromMenubar(menuId: string) {
    const menus = this.menuService.createMenu(menuId);
    const oldMenus = this.menuItems.get(menuId);
    if (oldMenus) {
      // 清理
      oldMenus.dispose();
      const listernerDispoable = this.listenerDisposables.get(menuId);
      if (listernerDispoable) {
        listernerDispoable.dispose();
        this.listenerDisposables.delete(menuId);
      }
    }
    this.menuItems.set(menuId, menus);
    this.listenerDisposables.set(menuId, menus.onDidChange(this.handleMenuChanged(menuId), this, this.disposables));
  }
}

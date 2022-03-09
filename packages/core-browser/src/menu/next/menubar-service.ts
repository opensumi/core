import { Injectable, Autowired } from '@opensumi/di';
import { IDisposable, Disposable } from '@opensumi/ide-core-common/lib/disposable';
import { Event, Emitter } from '@opensumi/ide-core-common/lib/event';

import { IMenubarItem, IMenuRegistry, MenuNode } from './base';
import { generateMergedCtxMenu } from './menu-util';
import { AbstractMenuService, IMenu, SubmenuItemNode } from './menu.interface';

export abstract class AbstractMenubarService extends Disposable {
  readonly onDidMenubarChange: Event<void>;
  abstract getMenubarItems(): IMenubarItem[];
  abstract getMenubarItem(menuId: string): IMenubarItem | undefined;

  readonly onDidMenuChange: Event<string>;
  abstract getMenuNodes(menuId: string): MenuNode[];
  abstract rebuildMenuNodes(menuId: string): void;
}

@Injectable()
export class MenubarServiceImpl extends Disposable implements AbstractMenubarService {
  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  /**
   * Menubar 本身发生变化时的事件
   * undefined 表示整个都需要刷新
   * 带了 menuId 只需要刷新单个 MenuBarItem
   */
  private readonly _onDidMenuBarChange = new Emitter<void>();
  public get onDidMenubarChange(): Event<void> {
    return this._onDidMenuBarChange.event;
  }

  private readonly _onDidMenuChange = new Emitter<string>();
  public get onDidMenuChange(): Event<string> {
    return this._onDidMenuChange.event;
  }

  private readonly _onMenuChange = new Emitter<string>();
  // internal 的 MenuChange 监听器，监听 menu/submenu 的变化
  private get onMenuChange(): Event<string | undefined> {
    return this._onMenuChange.event;
  }

  private _menubarIds: Set<string> = new Set();
  private _menus: Map<string, IMenu> = new Map();

  private _menubarItems: IMenubarItem[] = [];
  private _menuItems: Map<string, MenuNode[]> = new Map();

  private _menusListener: Map<string, IDisposable> = new Map();

  constructor() {
    super();
    this._build();

    // 监听 menubar 刷新事件
    this.addDispose(Event.debounce(this.menuRegistry.onDidChangeMenubar, () => {}, 50)(this._build, this));

    // 监听内部的 onMenuChange 刷新单个 menubarItem 下的所有节点
    this.addDispose(
      Event.debounce(this.onMenuChange, (l, menuId: string) => menuId, 50)(this._rebuildSingleRootMenus, this),
    );

    this.addDispose(this._onDidMenuBarChange);
    this.addDispose(this._onDidMenuChange);
  }

  // 构建完整的 menubarIds/_menubarItems/_menubarMenus
  private _build() {
    // reset
    this._menubarItems = [];
    this._menubarIds = new Set();
    this._menuItems.clear();

    let menubarItems = this.menuRegistry.getMenubarItems();
    menubarItems = menubarItems.sort(menubarItemsSorter);

    menubarItems.forEach((menubarItem) => {
      const menubarId = menubarItem.id;
      this._menubarItems.push(menubarItem);
      // keep menuId for event listener
      this._menubarIds.add(menubarId);
      // build mens for Menubar
      this._buildMenus(menubarId);
    });

    this._onDidMenuBarChange.fire();
  }

  // 根据事件监听结果更新单个 root menuId 下的 menus
  private _rebuildSingleRootMenus(menuId: string) {
    this._buildMenus(menuId);
    this._onDidMenuChange.fire(menuId);
  }

  /**
   * 构建产生每个 menubar item 下方点击展开的 menus
   * 包括递归产生多层级结构
   * @param menubarId [string]
   */
  private _buildMenus(menubarId: string) {
    const menus = this.menuService.createMenu(menubarId);

    // clean up for IMenu
    const oldMenus = this._menus.get(menubarId);
    if (oldMenus) {
      oldMenus.dispose();
      this._menus.delete(menubarId);
    }

    // clean up for menu.onDidChange
    const oldMenusListener = this._menusListener.get(menubarId);
    if (oldMenusListener) {
      oldMenusListener.dispose();
      this._menusListener.delete(menubarId);
    }

    this._menus.set(menubarId, menus);
    this._menusListener.set(
      menubarId,
      menus.onDidChange(() => this._onMenuChange.fire(menubarId), this, this.disposables),
    );

    const menubarMenu = [] as MenuNode[];
    this._traverseMenuItems(menus, menubarMenu, menubarId);
    this._menuItems.set(menubarId, menubarMenu);
  }

  /**
   * 递归构建生成单个 Menubar 下所有层级菜单的数据结构的函数
   * @param menus IMenu 实例, menuService.createMenu 返回值
   * @param menuToPopulate 递归中用来收集数结果
   * @param rootMenuId 顶级的 menuId, 下方所有 submenuId 的 onDidChange 都触发顶层 menuId 事件以刷新该 menuId 下所有的数据
   */
  private _traverseMenuItems(menus: IMenu, menuToPopulate: MenuNode[], rootMenuId: string) {
    const menuItems = generateMergedCtxMenu({ menus });
    menuItems.forEach((menuItem) => {
      if (menuItem instanceof SubmenuItemNode) {
        const submenuItems = [] as MenuNode[];

        const submenuId = menuItem.item.submenu;
        if (!this._menus.has(submenuId)) {
          const menus = this.registerDispose(this.menuService.createMenu(submenuId));
          this._menus.set(submenuId, menus);
          this.registerDispose(
            menus.onDidChange(() => {
              // 通知外部 顶层 menuId 下所有结构变了, 需要重新生成数据结构
              this._onMenuChange.fire(rootMenuId);
            }),
          );
        }

        const menuToDispose = this.menuService.createMenu(submenuId);
        this._traverseMenuItems(menuToDispose, submenuItems, rootMenuId);

        // 挂载 submenu 下的子级 menuItems
        menuItem.children = submenuItems;

        menuToPopulate.push(menuItem);
        menuToDispose.dispose();
      } else {
        menuToPopulate.push(menuItem);
      }
    });
  }

  public dispose() {
    this._menusListener.forEach((disposable) => disposable.dispose());
    this._menusListener.clear();
    this._menus.forEach((menu) => menu.dispose());
    this._menus.clear();
    super.dispose();
  }

  public getMenubarItems() {
    return this._menubarItems;
  }

  public getMenubarItem(menuId: string) {
    if (!this._menubarIds.has(menuId)) {
      return undefined;
    }

    return this.menuRegistry.getMenubarItem(menuId);
  }

  public getMenuNodes(menuId: string) {
    return this._menuItems.get(menuId) || [];
  }

  // 由于现在的 command 无法通知 isEnable/isVisible/isToggle
  // 所以 web 版本 menubar 每次需要强制重新计算
  public rebuildMenuNodes(menuId: string) {
    this._buildMenus(menuId);
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

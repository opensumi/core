import { Autowired, Injectable, Optional, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { IDisposable, Disposable } from '@opensumi/ide-core-common/lib/disposable';
import { Event, Emitter } from '@opensumi/ide-core-common/lib/event';

import { IContextKeyService } from '../../context-key';

import { MenuNode } from './base';
import { generateMergedCtxMenu, generateCtxMenu, mergeTupleMenuNodeResult } from './menu-util';
import {
  AbstractMenuService,
  AbstractContextMenuService,
  IContextMenu,
  IMenu,
  IMenuConfig,
  SubmenuItemNode,
  TupleMenuNodeResult,
  CreateMenuPayload,
} from './menu.interface';

@Injectable()
export class ContextMenuServiceImpl implements AbstractContextMenuService {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  public createMenu(payload: CreateMenuPayload): IContextMenu {
    return this.injector.get(ContextMenu, [payload]);
  }
}

@Injectable()
export class ContextMenu extends Disposable implements IContextMenu {
  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  private readonly _onDidMenuChange = new Emitter<string>();
  public get onDidChange(): Event<string> {
    return this._onDidMenuChange.event;
  }

  private readonly _onMenuChange = new Emitter<string>();
  // internal 的 MenuChange 监听器，监听 menu/submenu 的变化
  private get onMenuChange(): Event<string | undefined> {
    return this._onMenuChange.event;
  }

  private _menus: Map<string, IMenu> = new Map();
  private _menuItems: TupleMenuNodeResult = [[], []];

  private _menusListener: Map<string, IDisposable> = new Map();
  private _menuId: string;

  private readonly config: IMenuConfig;
  private readonly contextKeyService: IContextKeyService;

  public get menuId() {
    return this._menuId;
  }

  constructor(@Optional() payload: CreateMenuPayload) {
    super();
    this._menuId = payload.id;
    if (payload.config) {
      this.config = payload.config;
    }
    if (payload.contextKeyService) {
      this.contextKeyService = payload.contextKeyService;
    }

    this._build();

    // 监听内部的 onMenuChange 刷新单个 menu 下的所有节点
    this.addDispose(
      Event.debounce(
        Event.filter(this.onMenuChange, (menuId) => menuId === this._menuId),
        () => {},
        50,
      )(this._rebuildMenus, this),
    );

    this.addDispose(this._onDidMenuChange);
  }

  // 构建完整的 menuItems
  private _build() {
    // reset
    this._menuItems = [[], []];
    this._buildMenus(this._menuId);
  }

  // 根据事件监听结果更新
  private _rebuildMenus() {
    this._buildMenus(this._menuId);
    this._onDidMenuChange.fire(this._menuId);
  }

  /**
   * 构建产生每个 submenu item 下方点击展开的 menus
   * 包括递归产生多层级结构
   * @param menuId [string]
   */
  private _buildMenus(menuId: string) {
    const menus = this.menuService.createMenu(menuId, this.contextKeyService);

    // clean up for IMenu
    const oldMenus = this._menus.get(menuId);
    if (oldMenus) {
      oldMenus.dispose();
      this._menus.delete(menuId);
    }

    // clean up for menu.onDidChange
    const oldMenusListener = this._menusListener.get(menuId);
    if (oldMenusListener) {
      oldMenusListener.dispose();
      this._menusListener.delete(menuId);
    }

    this._menus.set(menuId, menus);
    this._menusListener.set(
      menuId,
      menus.onDidChange(() => this._onMenuChange.fire(menuId), this, this.disposables),
    );

    // 顶层结果最后会通过 navigation/inline 等分隔符分割，所以维持原结构
    const menuNodes = [[], []] as TupleMenuNodeResult;
    const tupleMenuNodeResult = generateCtxMenu({ menus, ...this.config });
    tupleMenuNodeResult.forEach((menuItems, index) => {
      this._traverseMenuItems(menuItems, menuNodes[index], menuId);
    });

    this._menuItems = menuNodes;
  }

  /**
   * 递归构建生成单个 Menu 下所有层级菜单的数据结构的函数
   * @param menus IMenu 实例, menuService.createMenu 返回值
   * @param menuToPopulate 递归中用来收集数结果
   * @param rootMenuId 顶级的 menuId, 下方所有 submenuId 的 onDidChange 都触发顶层 menuId 事件以刷新该 menuId 下所有的数据
   */
  private _traverseMenuItems(menuItems: MenuNode[], menuToPopulate: MenuNode[], rootMenuId: string) {
    menuItems.forEach((menuItem) => {
      if (menuItem instanceof SubmenuItemNode) {
        const submenuItems = [] as MenuNode[];

        const submenuId = menuItem.item.submenu;
        if (!this._menus.has(submenuId)) {
          const menus = this.registerDispose(this.menuService.createMenu(submenuId, this.contextKeyService));
          this._menus.set(submenuId, menus);
          this.registerDispose(
            menus.onDidChange(() => {
              // 通知外部 顶层 menuId 下所有结构变了, 需要重新生成数据结构
              this._onMenuChange.fire(rootMenuId);
            }),
          );
        }

        const menuToDispose = this.menuService.createMenu(submenuId, this.contextKeyService);
        const menuNodes = generateMergedCtxMenu({ menus: menuToDispose, ...this.config });
        this._traverseMenuItems(menuNodes, submenuItems, rootMenuId);

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

  // 获得已分好组并合并的 MenuNodes 列表
  public getMergedMenuNodes() {
    return mergeTupleMenuNodeResult(this._menuItems);
  }

  // 获得已分好组的 MenuNodes 列表
  public getGroupedMenuNodes() {
    return this._menuItems;
  }
}

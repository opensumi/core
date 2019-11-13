import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { observable } from 'mobx';
import { IMenubarItem, IMenuRegistry, MenuNode, generateCtxMenu, IMenu, MenuService } from '@ali/ide-core-browser/lib/menu/next';

export abstract class AbstractMenubarService extends Disposable {
  menubarItems: IMenubarItem[];
  menuNodeCollection: Map<string, MenuNode[]>;
}

@Injectable()
export class MenubarService extends Disposable implements AbstractMenubarService {
  @Autowired(MenuService)
  private readonly menuService: MenuService;

  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  @observable
  public menubarItems = observable.array<IMenubarItem>([]);

  @observable
  public menuNodeCollection = observable.map<string, MenuNode[]>();

  private _menuCollection: { [index: string ]: IMenu } = {};

  constructor() {
    super();
    this.generateMenubarItems();
    this.menuRegistry.onDidChangeMenubar(this.handleMenubarChanged, this, this.disposables);
    this.generateMenuNodes();
    this.menuRegistry.onDidChangeMenu(this.handleMenuChanged, this, this.disposables);
  }

  private generateMenubarItems() {
    const menubarItems = this.menuRegistry.getMenubarItems();
    this.menubarItems.splice(0, this.menubarItems.length, ...menubarItems);
    this.updateMenu(menubarItems);
  }

  private handleMenubarChanged(menuId: string) {
    const newMenubarItem = this.menuRegistry.getMenubarItem(menuId);
    if (newMenubarItem) {
      const pos = this.menubarItems.findIndex((n) => n.id === menuId);
      if (pos > -1) {
        this.menubarItems.splice(pos, 1, newMenubarItem);
      } else {
        this.menubarItems.push(newMenubarItem);
        // 需要更新 IMenus
        this.updateMenu([ newMenubarItem ]);
      }
    }
  }

  private generateMenuNodes() {
    this.menubarItems.forEach((menubarItem) => {
      const menuId = menubarItem.id;
      this.menuNodeCollection.set(menuId, this.getMenuNodes(menuId));
    });
  }

  private handleMenuChanged(menuId: string) {
    // 如果 menuId 不在 menubarItems 中则跳过更新
    const pos = this.menubarItems.findIndex((n) => n.id === menuId);
    if (pos > -1) {
      const menuNodes = this.menuNodeCollection.get(menuId);
      if (menuNodes) {
        // 替换全部菜单子项
        this.menuNodeCollection.set(menuId, this.getMenuNodes(menuId));
      }
    }
  }

  private updateMenu(menubarItems: IMenubarItem[]) {
    menubarItems.forEach((menubarItem) => {
      const menuId = menubarItem.id;
      const oldMenus = this._menuCollection[menuId];
      if (oldMenus) {
        oldMenus.dispose();
      }
      const menus = this._register(this.menuService.createMenu(menuId));
      this._menuCollection[menuId] = menus;
    });
  }

  /**
   * 暴露一个方法去产生 MenuNodes
   */
  private getMenuNodes(menuId: string): MenuNode[] {
    const menus = this._menuCollection[menuId];

    if (menus) {
      const result = generateCtxMenu({ menus });
      return [...result[0], ...result[1]];
    }

    return [];
  }
}

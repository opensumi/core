import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { localize } from '@ali/ide-core-common';
import { MenuNode, generateCtxMenu, IMenu, MenuId, MenuService } from '@ali/ide-core-browser/lib/menu/next';

enum MenuBarTitleEnum {
  File = 'File',
  Edit = 'Edit',
  Selection = 'Selection',
  View = 'View',
  Go = 'Go',
  Debug = 'Debug',
  Terminal = 'Terminal',
  Window = 'Window',
  Help = 'Help',
}

@Injectable()
export class MenuBarService extends Disposable {
  @Autowired(MenuService)
  private readonly menuService: MenuService;

  protected menuCollections: {
    [MenuBarTitleEnum.File]: IMenu;
    [MenuBarTitleEnum.Edit]: IMenu;
    [MenuBarTitleEnum.Selection]: IMenu;
    [MenuBarTitleEnum.View]: IMenu;
    [MenuBarTitleEnum.Go]: IMenu;
    [MenuBarTitleEnum.Debug]: IMenu;
    [MenuBarTitleEnum.Terminal]: IMenu;
    [MenuBarTitleEnum.Window]?: IMenu;
    [MenuBarTitleEnum.Help]: IMenu;
    [index: string]: IMenu | undefined;
  };

  private titleDesc = {
    [MenuBarTitleEnum.File]: localize('menu-bar.title.file'),
    [MenuBarTitleEnum.Edit]: localize('menu-bar.title.edit'),
    [MenuBarTitleEnum.Selection]: localize('menu-bar.title.selection'),
    [MenuBarTitleEnum.View]: localize('menu-bar.title.view'),
    [MenuBarTitleEnum.Go]: localize('menu-bar.title.go'),
    [MenuBarTitleEnum.Debug]: localize('menu-bar.title.debug'),
    [MenuBarTitleEnum.Terminal]: localize('menu-bar.title.terminal'),
    [MenuBarTitleEnum.Window]: localize('menu-bar.title.window'),
    [MenuBarTitleEnum.Help]: localize('menu-bar.title.help'),
  };

  private _menuNodeCollection: { [ key: string ]: MenuNode[] } = {};
  public get menuNodeCollection() {
    return this._menuNodeCollection;
  }

  get titles() {
    return this.titleDesc;
  }

  constructor() {
    super();
    this.menuCollections = {
      [MenuBarTitleEnum.File]: this.register(this.menuService.createMenu(MenuId.MenubarFileMenu)),
      [MenuBarTitleEnum.Edit]: this.register(this.menuService.createMenu(MenuId.MenubarEditMenu)),
      [MenuBarTitleEnum.Selection]: this.register(this.menuService.createMenu(MenuId.MenubarSelectionMenu)),
      [MenuBarTitleEnum.View]: this.register(this.menuService.createMenu(MenuId.MenubarViewMenu)),
      [MenuBarTitleEnum.Go]: this.register(this.menuService.createMenu(MenuId.MenubarGoMenu)),
      [MenuBarTitleEnum.Debug]: this.register(this.menuService.createMenu(MenuId.MenubarDebugMenu)),
      [MenuBarTitleEnum.Terminal]: this.register(this.menuService.createMenu(MenuId.MenubarTerminalMenu)),
      [MenuBarTitleEnum.Help]: this.register(this.menuService.createMenu(MenuId.MenubarHelpMenu)),
    };

    this.generateAllMenuNodes();
  }

  getMenuNodes(titleEnum: string): MenuNode[] {
    const menus = this.menuCollections[titleEnum];

    if (menus) {
      const result = generateCtxMenu({ menus });
      return [...result[0], ...result[1]];
    }

    return [];
  }

  generateAllMenuNodes() {
    Object.entries(this.menuCollections).forEach(([titleEnum, menus]) => {
      if (menus) {
        const result = generateCtxMenu({ menus });
        if (result.length === 2) {
          this._menuNodeCollection[titleEnum] = [...result[0], ...result[1]];
        }
      }
    });
  }
}

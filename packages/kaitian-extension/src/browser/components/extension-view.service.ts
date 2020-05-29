import { Disposable } from '@ali/ide-core-common';
import { Autowired, Injectable } from '@ali/common-di';
import { AbstractMenuService, MenuId, generateCtxMenu } from '@ali/ide-core-browser/lib/menu/next';
import { IContextKeyService, ViewContextKeyRegistry } from '@ali/ide-core-browser';

@Injectable({ multiple: true })
export class ExtensionViewService extends Disposable {
  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(ViewContextKeyRegistry)
  private readonly viewContextKeyRegistry: ViewContextKeyRegistry;

  private readonly id: string;

  constructor(viewId: string) {
    super();
    this.id = viewId;
  }

  getTitleMenus() {
    const contextKeyService = this.viewContextKeyRegistry.getContextKeyService(this.id) || this.contextKeyService;
    const menus = this.registerDispose(this.menuService.createMenu(MenuId.ViewTitle, contextKeyService));
    return menus;
  }

  private getMenuNodes(viewItemValue: string) {
    const viewContextKey = this.contextKeyService.createScoped();

    viewContextKey.createKey('view', this.id);
    viewContextKey.createKey('viewItem', viewItemValue);

    // viewItem
    const menus = this.menuService.createMenu(MenuId.ViewItemContext, viewContextKey);
    const result = generateCtxMenu({ menus, separator: 'inline'  });
    menus.dispose();
    viewContextKey.dispose();

    return result;
  }

  public getInlineMenuNodes(viewItemValue: string) {
    return this.getMenuNodes(viewItemValue)[0];
  }

  public getCtxMenuNodes(viewItemValue: string) {
    return this.getMenuNodes(viewItemValue)[1];
  }
}

import { Injectable, Autowired } from '@ali/common-di';
import { Disposable, Event, Emitter } from '@ali/ide-core-browser';
import { observable } from 'mobx';
import { AbstractMenubarService, IExtendMenubarItem, IMenuRegistry, MenuNode, generateCtxMenu, IMenu, AbstractMenuService } from '@ali/ide-core-browser/lib/menu/next';

export abstract class AbstractMenubarStore extends Disposable {
  menubarItems: IExtendMenubarItem[];
  abstract getMenubarItem(menuId: string): MenuNode[];
}

@Injectable()
export class MenubarStore extends Disposable implements AbstractMenubarStore {
  @Autowired(AbstractMenubarService)
  private readonly menubarService: AbstractMenubarService;

  @observable
  public menubarItems = observable.array<IExtendMenubarItem>([]);

  constructor() {
    super();

    this.generateMenubarItems();
    this.registerDispose(this.menubarService.onDidMenubarChange(this.handleMenubarChanged, this, this.disposables));
  }

  private generateMenubarItems() {
    const menubarItems = this.menubarService.getMenubarItems();
    this.menubarItems.splice(0, this.menubarItems.length, ...menubarItems);
  }

  private handleMenubarChanged() {
    const menubarItems = this.menubarService.getMenubarItems();
    this.menubarItems.replace(menubarItems);
  }

  public getMenubarItem(menuId: string): MenuNode[] {
    this.menubarService.rebuildMenuNodes(menuId);
    return this.menubarService.getMenuNodes(menuId) || [];
  }
}

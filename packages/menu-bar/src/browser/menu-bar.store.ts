import { Injectable, Autowired } from '@ali/common-di';
import { Disposable, Event, Emitter } from '@ali/ide-core-browser';
import { observable } from 'mobx';
import { AbstractMenubarService, IMenubarItem, IMenuRegistry, MenuNode, generateCtxMenu, IMenu, MenuService } from '@ali/ide-core-browser/lib/menu/next';

export abstract class AbstractMenubarStore extends Disposable {
  menubarItems: IMenubarItem[];
  abstract getMenubarItem(menuId: string): MenuNode[];
}

@Injectable()
export class MenubarStore extends Disposable implements AbstractMenubarStore {
  @Autowired(AbstractMenubarService)
  private readonly menubarService: AbstractMenubarService;

  @observable
  public menubarItems = observable.array<IMenubarItem>([]);

  constructor() {
    super();

    this.generateMenubarItems();
    this.registerDispose(this.menubarService.onDidMenuBarChange(this.handleMenubarChanged, this, this.disposables));
  }

  private generateMenubarItems() {
    const menubarItems = this.menubarService.getMenubarItems();
    this.menubarItems.splice(0, this.menubarItems.length, ...menubarItems);
  }

  private handleMenubarChanged(menuId: string) {
    const newMenubarItem = this.menubarService.getMenubarItem(menuId);
    if (newMenubarItem) {
      const pos = this.menubarItems.findIndex((n) => n.id === menuId);
      if (pos > -1) {
        this.menubarItems.splice(pos, 1, newMenubarItem);
      } else {
        this.menubarItems.push(newMenubarItem);
      }
    }
  }

  public getMenubarItem(menuId: string): MenuNode[] {
    return this.menubarService.getNewMenuItem(menuId) || [];
  }
}

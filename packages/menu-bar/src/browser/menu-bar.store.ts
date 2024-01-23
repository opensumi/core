import debounce from 'lodash/debounce';
import { observable, action, makeObservable } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import { Disposable, Emitter, Event } from '@opensumi/ide-core-browser';
import { AbstractMenubarService, IMenubarItem, MenuNode } from '@opensumi/ide-core-browser/lib/menu/next';

export abstract class AbstractMenubarStore extends Disposable {
  menubarItems: IMenubarItem[];
  abstract handleMenubarClick(menuId: string): void;
}

@Injectable()
export class MenubarStore extends Disposable implements AbstractMenubarStore {
  @Autowired(AbstractMenubarService)
  private readonly menubarService: AbstractMenubarService;

  @observable
  public menubarItems = observable.array<IMenubarItem>([]);

  @observable
  public menuItems = observable.map<string, MenuNode[]>();

  private readonly _onDidMenuBarChange = new Emitter<IMenubarItem[]>();
  public get onDidMenuBarChange(): Event<IMenubarItem[]> {
    return this._onDidMenuBarChange.event;
  }

  constructor() {
    super();
    makeObservable(this);
    this.build();
    this.registerDispose(this.menubarService.onDidMenubarChange(this.handleMenubarChanged, this, this.disposables));
    this.registerDispose(this.menubarService.onDidMenuChange(this.handleMenuChanged, this, this.disposables));
  }

  private getMenubarSubItems(menuId: string): MenuNode[] {
    this.menubarService.rebuildMenuNodes(menuId);
    return this.menubarService.getMenuNodes(menuId) || [];
  }

  @action.bound
  private updateMenuNodes(menuId: string) {
    const menuItems = this.getMenubarSubItems(menuId);
    this.menuItems.set(menuId, menuItems);
  }

  @action.bound
  private build() {
    const menubarItems = this.menubarService.getMenubarItems();
    this.menubarItems.splice(0, this.menubarItems.length, ...menubarItems);
    menubarItems.forEach(({ id: menuId }) => {
      this.updateMenuNodes(menuId);
    });
    this._onDidMenuBarChange.fire(this.menubarItems);
  }

  private handleMenuChanged(menuId: string) {
    this.updateMenuNodes(menuId);
  }

  @action.bound
  private handleMenubarChanged() {
    const menubarItems = this.menubarService.getMenubarItems();
    this.menubarItems.replace(menubarItems);
    this._onDidMenuBarChange.fire(this.menubarItems);
  }

  @action.bound
  public handleMenubarClick: (menuId: string) => void = debounce(
    (menuId: string) => {
      this.updateMenuNodes(menuId);
    },
    500,
    { leading: true, trailing: true },
  );
}

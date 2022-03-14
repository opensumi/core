import debounce = require('lodash.debounce');
import { observable, action } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-browser';
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

  constructor() {
    super();

    this.build();
    this.registerDispose(this.menubarService.onDidMenubarChange(this.handleMenubarChanged, this, this.disposables));
    this.registerDispose(this.menubarService.onDidMenuChange(this.handleMenuChanged, this, this.disposables));
  }

  @action.bound
  private updateMenuNodes(menuId: string) {
    this.menubarService.rebuildMenuNodes(menuId);
    const menuItems = this.menubarService.getMenuNodes(menuId) || [];
    this.menuItems.set(menuId, menuItems);
  }

  private build() {
    const menubarItems = this.menubarService.getMenubarItems();
    this.menubarItems.splice(0, this.menubarItems.length, ...menubarItems);
    menubarItems.forEach(({ id: menuId }) => {
      this.updateMenuNodes(menuId);
    });
  }

  private handleMenuChanged(menuId: string) {
    this.updateMenuNodes(menuId);
  }

  private handleMenubarChanged() {
    const menubarItems = this.menubarService.getMenubarItems();
    this.menubarItems.replace(menubarItems);
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

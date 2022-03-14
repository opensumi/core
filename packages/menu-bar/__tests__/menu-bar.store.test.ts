import { Injectable } from '@opensumi/di';
import { Event, Emitter } from '@opensumi/ide-core-browser';
import { AbstractMenubarService, IMenubarItem, MenuNode } from '@opensumi/ide-core-browser/lib/menu/next';
import { Disposable } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../tools/dev-tool/src/mock-injector';
import { MenuBarModule } from '../src';
import { AbstractMenubarStore, MenubarStore } from '../src/browser/menu-bar.store';

jest.useFakeTimers();

const fakeRebuildMenuNodes = jest.fn();

@Injectable()
class MockMenubarServiceImpl extends Disposable implements AbstractMenubarService {
  private readonly _onDidMenuBarChange = new Emitter<void>();
  get onDidMenubarChange(): Event<void> {
    return this._onDidMenuBarChange.event;
  }

  private readonly _onDidMenuChange = new Emitter<string>();
  get onDidMenuChange(): Event<string> {
    return this._onDidMenuChange.event;
  }

  private _menubarItems: IMenubarItem[] = [];
  private _menuItems: Map<string, MenuNode[]> = new Map();

  set menubarItems(payload: IMenubarItem[]) {
    this._menubarItems = payload;
    this._onDidMenuBarChange.fire();
  }

  set menuItems(payload: { menuId: string; data: MenuNode[] }) {
    this._menuItems.set(payload.menuId, payload.data);
    this._onDidMenuChange.fire(payload.menuId);
  }

  public getMenubarItems(): IMenubarItem[] {
    return this._menubarItems;
  }

  public rebuildMenuNodes() {
    // 空实现
    fakeRebuildMenuNodes();
  }

  public getMenubarItem() {
    return undefined;
  }

  public getMenuNodes(menuId: string) {
    return this._menuItems.get(menuId) || [];
  }
}

describe('test for packages/menu-bar/src/browser/menu-bar.store.ts', () => {
  let injector: MockInjector;

  let menubarService: MockMenubarServiceImpl;
  let menubarStore: MenubarStore;

  beforeEach(() => {
    injector = createBrowserInjector(
      [MenuBarModule],
      new MockInjector([
        {
          token: AbstractMenubarService,
          useClass: MockMenubarServiceImpl,
        },
      ]),
    );

    injector.addProviders({
      token: AbstractMenubarStore,
      useClass: MenubarStore,
    });

    menubarService = injector.get(AbstractMenubarService);
    menubarStore = injector.get(AbstractMenubarStore);
  });

  it('ok for state#menubarItems', () => {
    expect(menubarStore.menubarItems).toEqual([]);

    menubarService.menubarItems = [
      { id: 'helpMenu', label: 'help' },
      { id: 'windowMenu', label: 'window' },
    ];

    expect(menubarStore.menubarItems).toEqual([
      { id: 'helpMenu', label: 'help' },
      { id: 'windowMenu', label: 'window' },
    ]);

    menubarService.menubarItems = [{ id: 'helpMenu', label: 'help' }];

    expect(menubarStore.menubarItems).toEqual([{ id: 'helpMenu', label: 'help' }]);
  });

  it('ok for state#menuItems', () => {
    const fakeMenuNode1 = new MenuNode({ id: 'test1', label: 'test1' });
    const fakeMenuNode2 = new MenuNode({ id: 'test2', label: 'test2' });

    menubarService.menuItems = {
      menuId: 'fakeMenuId',
      data: [fakeMenuNode1, fakeMenuNode2],
    };

    expect(menubarStore.menuItems.get('non-existed-menu-id')).toBeUndefined();
    expect(menubarStore.menuItems.get('fakeMenuId')).toEqual([fakeMenuNode1, fakeMenuNode2]);
  });

  it('ok for fn#handleMenubarClick', () => {
    menubarStore.handleMenubarClick('fakeMenuId');
    expect(fakeRebuildMenuNodes).toBeCalled();
  });
});

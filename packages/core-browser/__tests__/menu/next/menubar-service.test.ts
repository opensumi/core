import { CoreCommandRegistryImpl, CommandRegistry, DisposableStore } from '@ali/ide-core-common';
import { MockContextKeyService } from '@ali/ide-monaco/lib/browser/mocks/monaco.context-key.service';
import { Injector } from '@ali/common-di';

import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { AbstractMenubarService, MenubarServiceImpl, AbstractMenuService, MenuRegistryImpl, MenuServiceImpl, IMenuRegistry, MenuId, isIMenuItem, generateMergedCtxMenu } from '../../../src/menu/next';
import { IContextKeyService } from '../../../src/context-key';
import { Command } from '@ali/ide-core-common';

jest.useFakeTimers();

// tslint:disable-next-line:new-parens
const contextKeyService = new class extends MockContextKeyService {
  match(bool) {
    if (bool) {
      return bool;
    }
    return true;
  }
};

describe('test for packages/core-browser/src/menu/next/menubar-service.ts', () => {
  let injector: MockInjector;

  let menuRegistry: IMenuRegistry;
  let menuService: AbstractMenuService;
  let menubarService: AbstractMenubarService;
  let commandRegistry: CommandRegistry;
  const disposables = new DisposableStore();
  const testMenuId = 'mock/test/menu';
  const testMenubarId = 'mock/test/menubar';

  beforeEach(() => {
    injector = createBrowserInjector([], new Injector([
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      }, {
        token: IMenuRegistry,
        useClass: MenuRegistryImpl,
      }, {
        token: CommandRegistry,
        useClass: CoreCommandRegistryImpl,
      }, {
        token: AbstractMenuService,
        useClass: MenuServiceImpl,
      },
    ]));

    injector.addProviders({
      token: AbstractMenubarService,
      useClass: MenubarServiceImpl,
    });

    commandRegistry = injector.get(CommandRegistry);
    menuRegistry = injector.get(IMenuRegistry);
    menuService = injector.get(AbstractMenuService);
    menubarService = injector.get(AbstractMenubarService);

    disposables.clear();
  });

  afterEach(() => {
    disposables.clear();
  });

  it('basic check for onDidMenuChange', () => {
    menubarService.onDidMenubarChange(() => {
      jest.runAllTimers();
      const menubarItems = menubarService.getMenubarItems();

      expect(menubarItems.length).toBe(1);
      expect(menubarItems[0].label).toBe('a1');
      expect(menubarItems[0].id).toBe(testMenubarId);
    });

    disposables.add(menuRegistry.registerMenubarItem(testMenubarId, {
      label: 'a1',
    }));
  });

  it('basic check for onDidMenuChange', () => {
    menubarService.onDidMenuChange(() => {
      jest.runAllTimers();
      const menuNodes = menubarService.getMenuNodes(testMenubarId);

      expect(menuNodes.length).toBe(1);
      expect(menuNodes[0].label).toBe('hello');
    });

    disposables.add(menuRegistry.registerMenubarItem(testMenubarId, {
      label: 'a1',
    }));

    disposables.add(menuRegistry.registerMenuItem(testMenubarId, {
      command: {
        id: 'a',
        label: 'hello',
      },
    }));
  });

  it('submenu', () => {
    menubarService.onDidMenuChange(() => {
      jest.runAllTimers();

      const menubarItems = menubarService.getMenubarItems();
      expect(menubarItems[0].label).toBe('test menubar');

      const menuNodes = menubarService.getMenuNodes(testMenubarId);
      expect(menuNodes.length).toBe(2);
      expect(menuNodes[0].label).toBe('test submenu');
      expect(menuNodes[0].children.length).toBe(2);
      expect(menuNodes[0].children.map((n) => n.label)).toEqual(['hello', 'world']);
    });

    disposables.add(menuRegistry.registerMenubarItem(testMenubarId, {
      label: 'test menubar',
    }));

    disposables.add(menuRegistry.registerMenuItem(testMenubarId, {
      command: {
        id: 'first_id',
        label: 'first',
      },
    }));

    disposables.add(menuRegistry.registerMenuItem(testMenubarId, {
      submenu: 'test_submenu_id',
      label: 'test submenu',
    }));

    disposables.add(menuRegistry.registerMenuItem('testSubmenuId', {
      command: {
        id: 'hello_id',
        label: 'hello',
      },
    }));

    disposables.add(menuRegistry.registerMenuItem('testSubmenuId', {
      command: {
        id: 'world_id',
        label: 'world',
      },
    }));
  });

  it('removeMenubarItem', () => {
    disposables.add(menuRegistry.registerMenubarItem(testMenubarId, {
      label: 'test menubar',
    }));

    disposables.add(menuRegistry.registerMenubarItem('fakeMenuBarId', {
      label: 'fake menubar',
    }));

    menubarService.onDidMenubarChange(() => {
      jest.runAllTimers();
      const menubarItems = menubarService.getMenubarItems();

      expect(menubarItems.length).toBe(1);
      expect(menubarItems[0].id).toBe('fakeMenuBarId');
    });

    menuRegistry.removeMenubarItem(testMenubarId);
  });

  it('register menubar menus must with existed menubarItem', () => {
    const fakeListener = jest.fn();
    menubarService.onDidMenuChange(fakeListener);

    disposables.add(menuRegistry.registerMenuItem(testMenubarId, {
      command: {
        id: 'a',
        label: 'hello',
      },
    }));

    expect(fakeListener).not.toBeCalled();
  });

  it('registerMenubarItem and then registerMenuItem in next tick', () => {
    disposables.add(menuRegistry.registerMenubarItem(testMenubarId, {
      label: 'a1',
    }));

    setTimeout(() => {
      disposables.add(menuRegistry.registerMenuItem(testMenubarId, {
        command: {
          id: 'a',
          label: 'hello',
        },
      }));
    }, 100);

    menubarService.onDidMenuChange(() => {
      jest.advanceTimersByTime(100);

      const menubarItems = menubarService.getMenubarItems();
      const menuNodes = menubarService.getMenuNodes(testMenubarId);

      expect(menubarItems.length).toBe(1);
      expect(menubarItems[0].label).toBe('a1');
      expect(menuNodes.length).toBe(1);
      expect(menuNodes[0].label).toBe('hello');
    });
  });

  it('sorting by order', () => {
    menubarService.onDidMenubarChange(() => {
      jest.runAllTimers();

      const menubarItems = menubarService.getMenubarItems();

      expect(menubarItems.length).toBe(3);
      expect(menubarItems[0].label).toBe('a3');
      expect(menubarItems.map((n) => n.label)).toEqual(['a3', 'a2', 'a1']);
    });

    disposables.add(menuRegistry.registerMenubarItem('testMenubarId1', {
      label: 'a1',
      order: 2,
    }));

    disposables.add(menuRegistry.registerMenubarItem('testMenubarId2', {
      label: 'a2',
    }));

    disposables.add(menuRegistry.registerMenubarItem('testMenubarId3', {
      label: 'a3',
      order: -1,
    }));
  });
});

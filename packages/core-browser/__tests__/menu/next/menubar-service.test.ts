import { Injector } from '@opensumi/di';
import { CoreCommandRegistryImpl, CommandRegistry, DisposableStore } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { MockContextKeyService } from '../../../../monaco/__mocks__/monaco.context-key.service';
import { IContextKeyService } from '../../../src/context-key';
import {
  AbstractMenubarService,
  MenubarServiceImpl,
  AbstractMenuService,
  MenuRegistryImpl,
  MenuServiceImpl,
  IMenuRegistry,
} from '../../../src/menu/next';

jest.useFakeTimers();

describe('test for packages/core-browser/src/menu/next/menubar-service.ts', () => {
  let injector: MockInjector;

  let menuRegistry: IMenuRegistry;
  let menubarService: AbstractMenubarService;
  const disposables = new DisposableStore();
  const testMenubarId = 'mock/test/menubar';

  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    injector = createBrowserInjector(
      [],
      new Injector([
        {
          token: IContextKeyService,
          useClass: MockContextKeyService,
        },
        {
          token: IMenuRegistry,
          useClass: MenuRegistryImpl,
        },
        {
          token: CommandRegistry,
          useClass: CoreCommandRegistryImpl,
        },
        {
          token: AbstractMenuService,
          useClass: MenuServiceImpl,
        },
      ]),
    );

    injector.addProviders({
      token: AbstractMenubarService,
      useClass: MenubarServiceImpl,
    });

    menuRegistry = injector.get(IMenuRegistry);
    menubarService = injector.get(AbstractMenubarService);

    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    disposables.clear();
  });

  afterEach(() => {
    disposables.clear();
    warnSpy.mockReset();
  });

  it('basic check for onDidMenuChange', () => {
    disposables.add(
      menubarService.onDidMenubarChange(() => {
        jest.runAllTimers();
        const menubarItems = menubarService.getMenubarItems();

        expect(menubarItems.length).toBe(1);
        expect(menubarItems[0].label).toBe('a1');
        expect(menubarItems[0].id).toBe(testMenubarId);
      }),
    );

    disposables.add(
      menuRegistry.registerMenubarItem(testMenubarId, {
        label: 'a1',
      }),
    );
  });

  it('basic check for onDidMenuChange', async () => {
    disposables.add(
      menubarService.onDidMenuChange(() => {
        jest.runAllTimers();
        const menuNodes = menubarService.getMenuNodes(testMenubarId);

        expect(menuNodes.length).toBe(1);
        expect(menuNodes[0].label).toBe('hello');
      }),
    );

    disposables.add(
      menuRegistry.registerMenubarItem(testMenubarId, {
        label: 'a1',
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(testMenubarId, {
        command: {
          id: 'a',
          label: 'hello',
        },
      }),
    );
  });

  it('submenu', () => {
    disposables.add(
      menubarService.onDidMenuChange(() => {
        jest.runAllTimers();

        const menubarItems = menubarService.getMenubarItems();
        expect(menubarItems[0].label).toBe('test menubar');

        const menuNodes = menubarService.getMenuNodes(testMenubarId);
        expect(menuNodes.length).toBe(2);
        expect(menuNodes[0].label).toBe('test submenu');
        expect(menuNodes[0].children.length).toBe(2);
        expect(menuNodes[0].children.map((n) => n.label)).toEqual(['hello', 'world']);
      }),
    );

    disposables.add(
      menuRegistry.registerMenubarItem(testMenubarId, {
        label: 'test menubar',
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(testMenubarId, {
        command: {
          id: 'first_id',
          label: 'first',
        },
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(testMenubarId, {
        submenu: 'test_submenu_id',
        label: 'test submenu',
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem('testSubmenuId', {
        command: {
          id: 'hello_id',
          label: 'hello',
        },
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem('testSubmenuId', {
        command: {
          id: 'world_id',
          label: 'world',
        },
      }),
    );
  });

  it('removeMenubarItem', () => {
    disposables.add(
      menuRegistry.registerMenubarItem(testMenubarId, {
        label: 'test menubar',
      }),
    );

    disposables.add(
      menuRegistry.registerMenubarItem('fakeMenuBarId', {
        label: 'fake menubar',
      }),
    );

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
    disposables.add(menubarService.onDidMenuChange(fakeListener));

    disposables.add(
      menuRegistry.registerMenuItem(testMenubarId, {
        command: {
          id: 'a',
          label: 'hello',
        },
      }),
    );

    expect(fakeListener).not.toBeCalled();
  });

  it('registerMenubarItem and then registerMenuItem again', () => {
    disposables.add(
      menuRegistry.registerMenubarItem(testMenubarId, {
        label: 'a1',
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(testMenubarId, {
        command: {
          id: 'a',
          label: 'hello',
        },
      }),
    );

    disposables.add(
      menubarService.onDidMenuChange(() => {
        expect(warnSpy.mock.calls[0][1]).toBe(`this menuId ${testMenubarId} already existed`);

        const menubarItems = menubarService.getMenubarItems();
        const menuNodes = menubarService.getMenuNodes(testMenubarId);

        expect(menubarItems.length).toBe(1);
        expect(menubarItems[0].label).toBe('a1');
        expect(menuNodes.length).toBe(1);
        expect(menuNodes[0].label).toBe('hello');
      }),
    );
  });

  it('sorting by order', () => {
    disposables.add(
      menubarService.onDidMenubarChange(() => {
        jest.runAllTimers();

        const menubarItems = menubarService.getMenubarItems();

        expect(menubarItems.length).toBe(3);
        expect(menubarItems[0].label).toBe('a3');
        expect(menubarItems.map((n) => n.label)).toEqual(['a3', 'a2', 'a1']);
      }),
    );

    disposables.add(
      menuRegistry.registerMenubarItem('testMenubarId1', {
        label: 'a1',
        order: 2,
      }),
    );

    disposables.add(
      menuRegistry.registerMenubarItem('testMenubarId2', {
        label: 'a2',
      }),
    );

    disposables.add(
      menuRegistry.registerMenubarItem('testMenubarId3', {
        label: 'a3',
        order: -1,
      }),
    );
  });
});

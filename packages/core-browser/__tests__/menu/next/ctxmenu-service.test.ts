import { Injector } from '@opensumi/di';
import { CoreCommandRegistryImpl, CommandRegistry, DisposableStore } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { MockContextKeyService } from '../../../../monaco/__mocks__/monaco.context-key.service';
import { IContextKeyService } from '../../../src/context-key';
import {
  AbstractMenuService,
  MenuRegistryImpl,
  MenuServiceImpl,
  IMenuRegistry,
  AbstractContextMenuService,
  ContextMenuServiceImpl,
} from '../../../src/menu/next';

jest.useFakeTimers();

const contextKeyService = new (class extends MockContextKeyService {
  match(bool) {
    return true;
  }
})();

describe('test for packages/core-browser/src/menu/next/menubar-service.ts', () => {
  let injector: MockInjector;

  let menuRegistry: IMenuRegistry;
  let ctxmenuService: AbstractContextMenuService;
  const disposables = new DisposableStore();
  const testMenuId = 'mock/test/menu';

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
      token: AbstractContextMenuService,
      useClass: ContextMenuServiceImpl,
    });

    menuRegistry = injector.get(IMenuRegistry);
    ctxmenuService = injector.get(AbstractContextMenuService);

    disposables.clear();
  });

  afterEach(() => {
    disposables.clear();
  });

  it('basic', () => {
    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: {
          id: 'b',
          label: 'a1',
        },
      }),
    );

    const menus = ctxmenuService.createMenu({ id: testMenuId, contextKeyService });
    expect(menus.getMergedMenuNodes().length).toBe(1);
    expect(menus.getMergedMenuNodes()[0].label).toBe('a1');
  });

  it('submenu', () => {
    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: {
          id: 'first_id',
          label: 'first',
        },
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        submenu: 'test_submenu_id',
        label: 'test submenu',
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem('test_submenu_id', {
        command: {
          id: 'hello_id',
          label: 'hello',
        },
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem('test_submenu_id', {
        command: {
          id: 'world_id',
          label: 'world',
        },
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem('test_submenu_id', {
        submenu: 'sub_submenu_id',
        label: 'sub_submenu',
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem('sub_submenu_id', {
        command: {
          id: 'nested_sub_id',
          label: 'nested submenu',
        },
      }),
    );

    const menus = ctxmenuService.createMenu({ id: testMenuId, contextKeyService });
    const ret = menus.getMergedMenuNodes();
    expect(ret.length).toBe(2);
    expect(ret[0].label).toBe('first');
    expect(ret[1].children.length).toBe(3);
    expect(ret[1].children.map((n) => n.label)).toEqual(['hello', 'world', 'sub_submenu']);
    expect(ret[1].children[2].children.length).toBe(1);
    expect(ret[1].children[2].children[0].label).toBe('nested submenu');
  });
});

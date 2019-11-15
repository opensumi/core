import { CoreCommandRegistryImpl,  CommandRegistry, DisposableStore } from '@ali/ide-core-common';
import { MockContextKeyService } from '@ali/ide-monaco/lib/browser/mocks/monaco.context-key.service';
import { Injector } from '@ali/common-di';

import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { MenuService, MenuRegistry, MenuServiceImpl, IMenuRegistry, MenuId, isIMenuItem } from '../../../src/menu/next';
import { IContextKeyService } from '../../../src/context-key';
import { Command } from '@ali/ide-core-common';

// tslint:disable-next-line:new-parens
const contextKeyService = new class extends MockContextKeyService {
  match() {
    return true;
  }
};

describe('MenuService', () => {
  let injector: MockInjector;

  let menuRegistry: MenuRegistry;
  let menuService: MenuService;
  let commandRegistry: CommandRegistry;
  const disposables = new DisposableStore();
  const testMenuId = 'mock/test/menu';

  beforeEach(() => {
    injector = createBrowserInjector([], new Injector([
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      }, {
        token: IMenuRegistry,
        useClass: MenuRegistry,
      },  {
        token: CommandRegistry,
        useClass: CoreCommandRegistryImpl,
      },
    ]));

    injector.addProviders({
      token: MenuService,
      useClass: MenuServiceImpl,
    });

    commandRegistry = injector.get(CommandRegistry);
    menuRegistry = injector.get(IMenuRegistry);
    menuService = injector.get(MenuService);

    disposables.clear();
  });

  afterEach(() => {
    disposables.clear();
  });

  it('group sorting', () => {
    [
      { id: 'one', label: 'FOO' },
      { id: 'two', label: 'FOO' },
      { id: 'three', label: 'FOO' },
      { id: 'four', label: 'FOO' },
      { id: 'five', label: 'FOO' },
    ].forEach((command: Command) => {
      commandRegistry.registerCommand(command, {
        execute: jest.fn(),
      });
    });

    disposables.add(menuRegistry.registerMenuItem(testMenuId, {
      command: 'one',
      group: '0_hello',
    }));

    disposables.add(menuRegistry.registerMenuItem(testMenuId, {
      command: 'two',
      group: 'hello',
    }));

    disposables.add(menuRegistry.registerMenuItem(testMenuId, {
      command: 'three',
      group: 'Hello',
    }));

    disposables.add(menuRegistry.registerMenuItem(testMenuId, {
      command: 'four',
      group: '',
    }));

    disposables.add(menuRegistry.registerMenuItem(testMenuId, {
      command: 'five',
      group: 'navigation',
    }));

    const menuNodes = menuService.createMenu(testMenuId, contextKeyService).getMenuNodes();

    expect(menuNodes.length).toBe(5);
    const [one, two, three, four, five] = menuNodes;

    expect(one[0]).toBe('navigation');
    expect(two[0]).toBe('0_hello');
    expect(three[0]).toBe('hello');
    expect(four[0]).toBe('Hello');
    expect(five[0]).toBe('');
  });

  it.skip('group sorting by title', () => {
    [
      { id: 'a', label: 'aaa' },
      { id: 'b', label: 'fff' },
      { id: 'c', label: 'zzz' },
    ].forEach((command: Command) => {
      commandRegistry.registerCommand(command, {
        execute: jest.fn(),
      });
    });

    disposables.add(menuRegistry.registerMenuItem(testMenuId, {
      command: 'a',
      group: 'Hello',
    }));

    disposables.add(menuRegistry.registerMenuItem(testMenuId, {
      command: 'b',
      group: 'Hello',
    }));

    disposables.add(menuRegistry.registerMenuItem(testMenuId, {
      command: 'c',
      group: 'Hello',
    }));

    const menuNodes = menuService.createMenu(testMenuId, contextKeyService).getMenuNodes();

    expect(menuNodes.length).toBe(1);
    const [, actions] = menuNodes[0];

    expect(actions.length).toBe(3);
    const [one, two, three] = actions;
    expect(one.id).toBe('a');
    expect(two.id).toBe('b');
    expect(three.id).toBe('c');
  });

  it('group sorting by order', () => {
    [
      { id: 'a', label: 'aaa' },
      { id: 'b', label: 'fff' },
      { id: 'c', label: 'zzz' },
      { id: 'd', label: 'yyy' },
    ].forEach((command: Command) => {
      commandRegistry.registerCommand(command, {
        execute: jest.fn(),
      });
    });

    disposables.add(menuRegistry.registerMenuItem(testMenuId, {
      command: 'a',
      group: 'Hello',
      order: 10,
    }));

    disposables.add(menuRegistry.registerMenuItem(testMenuId, {
      command: 'b',
      group: 'Hello',
    }));

    disposables.add(menuRegistry.registerMenuItem(testMenuId, {
      command: 'c',
      group: 'Hello',
      order: -1,
    }));

    disposables.add(menuRegistry.registerMenuItem(testMenuId, {
      command: 'd',
      group: 'Hello',
      order: -1,
    }));

    const menuNodes = menuService.createMenu(testMenuId, contextKeyService).getMenuNodes();

    expect(menuNodes.length).toBe(1);
    const [, actions] = menuNodes[0];

    expect(actions.length).toBe(4);
    const [one, two, three, four] = actions;
    // only for order
    expect(one.id).toBe('c');
    expect(two.id).toBe('d');
    expect(three.id).toBe('b');
    expect(four.id).toBe('a');
  });

  it('group sorting with navigation', () => {
    [
      { id: 'a', label: 'aaa' },
      { id: 'b', label: 'fff' },
      { id: 'c', label: 'zzz' },
    ].forEach((command: Command) => {
      commandRegistry.registerCommand(command, {
        execute: jest.fn(),
      });
    });

    disposables.add(menuRegistry.registerMenuItem(testMenuId, {
      command: 'a',
      group: 'navigation',
      order: 1.3,
    }));

    disposables.add(menuRegistry.registerMenuItem(testMenuId, {
      command: 'b',
      group: 'navigation',
      order: 1.2,
    }));

    disposables.add(menuRegistry.registerMenuItem(testMenuId, {
      command: 'c',
      group: 'navigation',
      order: 1.1,
    }));

    const menuNodes = menuService.createMenu(testMenuId, contextKeyService).getMenuNodes();

    expect(menuNodes.length).toBe(1);
    const [[, actions]] = menuNodes;

    expect(actions.length).toBe(3);
    const [one, two, three] = actions;
    expect(one.id).toBe('c');
    expect(two.id).toBe('b');
    expect(three.id).toBe('a');
  });

  it('MenuId#CommandPalette', () => {
    commandRegistry.registerCommand({
      id: 'a',
      label: 'Explicit',
    }, {
      execute: jest.fn(),
    });

    disposables.add(menuRegistry.registerMenuItem(MenuId.CommandPalette, {
      command: 'a',
    }));

    commandRegistry.registerCommand({
      id: 'b',
      label: 'Explicit',
    }, {
      execute: jest.fn(),
    });

    let foundA = false;
    let foundB = false;
    for (const item of menuRegistry.getMenuItems(MenuId.CommandPalette)) {
      if (isIMenuItem(item)) {
        if (item.command === 'a') {
          expect(commandRegistry.getCommand(item.command)!.label).toBe('Explicit');
          foundA = true;
        }
        if (item.command === 'b') {
          expect(commandRegistry.getCommand(item.command)!.label).toBe('Explicit');
          foundB = true;
        }
      }
    }
    expect(foundA).toBeTruthy();
    expect(foundB).toBeTruthy();
  });

  it('register menu item with label', () => {
    commandRegistry.registerCommand({
      id: 'a',
      label: 'a1',
    }, {
      execute: jest.fn(),
    });

    commandRegistry.registerCommand({
      id: 'b',
      label: 'b1',
    }, {
      execute: jest.fn(),
    });

    disposables.add(menuRegistry.registerMenuItem(testMenuId, {
      command: {
        id: 'a',
        label: 'a2',
      },
    }));

    disposables.add(menuRegistry.registerMenuItem(MenuId.CommandPalette, {
      command: {
        id: 'b',
        label: 'b2',
      },
    }));

    const menuNodes1 = menuService.createMenu(MenuId.CommandPalette, contextKeyService).getMenuNodes();
    expect(menuNodes1[0][1][0].label).toBe('b2');
    expect(menuNodes1[0][1][1].label).toBe('a1');
    const menuNodes2 = menuService.createMenu(testMenuId, contextKeyService).getMenuNodes();
    expect(menuNodes2[0][1][0].label).toBe('a2');
  });

  it('hack: hide in QuickOpen', () => {
    commandRegistry.registerCommand({
      id: 'a',
    }, {
      execute: jest.fn(),
    });

    commandRegistry.registerCommand({
      id: 'b',
      label: 'b1',
    }, {
      execute: jest.fn(),
    });

    disposables.add(menuRegistry.registerMenuItem(MenuId.CommandPalette, {
      command: {
        id: 'b',
        label: '',
      },
    }));

    const menuNodes1 = menuService.createMenu(MenuId.CommandPalette, contextKeyService).getMenuNodes();
    expect(menuNodes1.length).toBe(0);
  });

  it('register menu item without command', () => {
    disposables.add(menuRegistry.registerMenuItem(testMenuId, {
      command: {
        id: 'a',
        label: 'a1',
      },
    }));

    disposables.add(menuRegistry.registerMenuItem(MenuId.CommandPalette, {
      command: {
        id: 'b',
        label: 'b1',
      },
    }));

    // 注册一个 visible 为 false 的 menu item
    commandRegistry.registerCommand({
      id: 'c',
      label: 'c1',
    }, {
      execute: jest.fn(),
      isVisible: () => false,
    });

    const menuNodes1 = menuService.createMenu(MenuId.CommandPalette, contextKeyService).getMenuNodes();
    expect(menuNodes1[0][1].length).toBe(1);
    expect(menuNodes1[0][1][0].label).toBe('b1');
    const menuNodes2 = menuService.createMenu(testMenuId, contextKeyService).getMenuNodes();
    expect(menuNodes2[0][1][0].label).toBe('a1');
  });
});

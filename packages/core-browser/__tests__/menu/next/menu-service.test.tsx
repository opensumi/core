import React from 'react';

import { Injector } from '@opensumi/di';
import { Command } from '@opensumi/ide-core-common';
import { CoreCommandRegistryImpl, CommandRegistry, DisposableStore } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { MockContextKeyService } from '../../../../monaco/__mocks__/monaco.context-key.service';
import { IContextKeyService } from '../../../src/context-key';
import {
  SeparatorMenuItemNode,
  IComponentMenuItemProps,
  AbstractMenuService,
  MenuRegistryImpl,
  MenuServiceImpl,
  IMenuRegistry,
  MenuId,
  isIMenuItem,
  generateMergedCtxMenu,
  ComponentMenuItemNode,
} from '../../../src/menu/next';

const contextKeyService = new (class extends MockContextKeyService {
  match(context: string) {
    if (typeof context === 'string') {
      try {
        return JSON.parse(context);
      } catch (err) {
        return true;
      }
    }
    return true;
  }
})();

jest.useFakeTimers();

const CustomMenuItem: React.FC<IComponentMenuItemProps> = (props) => {
  const handleClick = () => {
    props.getExecuteArgs();
  };

  return (
    <div style={{ color: 'red' }} onClick={handleClick}>
      hello world
    </div>
  );
};

describe('test for packages/core-browser/src/menu/next/menu-service.ts', () => {
  let injector: MockInjector;

  let menuRegistry: IMenuRegistry;
  let menuService: AbstractMenuService;
  let commandRegistry: CommandRegistry;
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
      ]),
    );

    injector.addProviders({
      token: AbstractMenuService,
      useClass: MenuServiceImpl,
    });

    commandRegistry = injector.get(CommandRegistry);
    menuRegistry = injector.get(IMenuRegistry);
    menuService = injector.get(AbstractMenuService);

    disposables.clear();
  });

  afterEach(() => {
    disposables.clear();
  });

  it('basic property check', () => {
    disposables.add(
      menuRegistry.registerMenuItem(MenuId.CommandPalette, {
        command: 'a',
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(MenuId.CommandPalette, {
        command: {
          id: 'b',
          label: 'b1',
        },
        toggledWhen: 'true',
        order: 3,
      }),
    );

    // 注册一个 visible 为 false 的 menu item
    commandRegistry.registerCommand(
      {
        id: 'c',
        label: 'c1',
      },
      {
        execute: jest.fn(),
        isEnabled: () => false,
        isToggled: () => true,
        isVisible: () => true,
      },
    );

    commandRegistry.registerCommand(
      {
        id: 'd',
        label: 'd1',
      },
      {
        execute: jest.fn(),
        isVisible: () => false,
      },
    );

    const menus = menuService.createMenu(MenuId.CommandPalette, contextKeyService);
    const menuNodes = generateMergedCtxMenu({ menus });
    menus.dispose();
    expect(menuNodes.length).toBe(2);
    expect(menuNodes[0].label).toBe('c1');
    expect(menuNodes[0].disabled).toBeTruthy();
    expect(menuNodes[0].checked).toBeTruthy();

    expect(menuNodes[1].label).toBe('b1');
    expect(menuNodes[1].checked).toBeTruthy();
    expect(menuNodes[1].disabled).toBeFalsy();
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

    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: 'one',
        group: '0_hello',
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: 'two',
        group: 'hello',
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: 'three',
        group: 'Hello',
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: 'four',
        group: '',
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: 'five',
        group: 'navigation',
      }),
    );

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

    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: 'a',
        group: 'Hello',
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: 'b',
        group: 'Hello',
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: 'c',
        group: 'Hello',
      }),
    );

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

    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: 'a',
        group: 'Hello',
        order: 10,
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: 'b',
        group: 'Hello',
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: 'c',
        group: 'Hello',
        order: -1,
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: 'd',
        group: 'Hello',
        order: -1,
      }),
    );

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

    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: 'a',
        group: 'navigation',
        order: 1.3,
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: 'b',
        group: 'navigation',
        order: 1.2,
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: 'c',
        group: 'navigation',
        order: 1.1,
      }),
    );

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
    commandRegistry.registerCommand(
      {
        id: 'a',
        label: 'Explicit',
      },
      {
        execute: jest.fn(),
      },
    );

    disposables.add(
      menuRegistry.registerMenuItem(MenuId.CommandPalette, {
        command: 'a',
      }),
    );

    commandRegistry.registerCommand(
      {
        id: 'b',
        label: 'Explicit',
      },
      {
        execute: jest.fn(),
      },
    );

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

  it('register command with enabledWhen', () => {
    [
      { id: 'a', label: 'aaa', enabledWhen: JSON.stringify(true) },
      { id: 'b', label: 'fff', enabledWhen: JSON.stringify(false) },
      { id: 'c', label: 'zzz' },
    ].forEach((desc) => {
      commandRegistry.registerCommand(
        {
          id: desc.id,
          label: desc.label,
        },
        {
          execute: jest.fn(),
        },
      );

      disposables.add(
        menuRegistry.registerMenuItem(testMenuId, {
          command: desc.id,
          enabledWhen: desc.enabledWhen,
        }),
      );
    });

    const menuNodes = menuService.createMenu(testMenuId, contextKeyService).getMenuNodes();
    expect(menuNodes.length).toBe(1);

    const [[, actions]] = menuNodes;
    expect(actions.length).toBe(3);
    const [one, two, three] = actions;
    expect(one.disabled).toBeFalsy();
    expect(two.disabled).toBeTruthy();
    expect(three.disabled).toBeFalsy();
  });

  it('register menu item with label', () => {
    commandRegistry.registerCommand(
      {
        id: 'a',
        label: 'a1',
      },
      {
        execute: jest.fn(),
      },
    );

    commandRegistry.registerCommand(
      {
        id: 'b',
        label: 'b1',
      },
      {
        execute: jest.fn(),
      },
    );

    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: {
          id: 'a',
          label: 'a2',
        },
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(MenuId.CommandPalette, {
        command: {
          id: 'b',
          label: 'b2',
        },
      }),
    );

    const menuNodes1 = menuService.createMenu(MenuId.CommandPalette, contextKeyService).getMenuNodes();
    expect(menuNodes1[0][1][0].label).toBe('b2');
    expect(menuNodes1[0][1][1].label).toBe('a1');
    const menuNodes2 = menuService.createMenu(testMenuId, contextKeyService).getMenuNodes();
    expect(menuNodes2[0][1][0].label).toBe('a2');
  });

  it('hack: hide in QuickOpen', () => {
    commandRegistry.registerCommand(
      {
        id: 'a',
      },
      {
        execute: jest.fn(),
      },
    );

    commandRegistry.registerCommand(
      {
        id: 'b',
        label: 'b1',
      },
      {
        execute: jest.fn(),
      },
    );

    disposables.add(
      menuRegistry.registerMenuItem(MenuId.CommandPalette, {
        command: {
          id: 'b',
          label: '',
        },
      }),
    );

    const menuNodes1 = menuService.createMenu(MenuId.CommandPalette, contextKeyService).getMenuNodes();
    expect(menuNodes1.length).toBe(0);
  });

  it('register menu item without command', () => {
    disposables.add(
      menuRegistry.registerMenuItem(testMenuId, {
        command: {
          id: 'a',
          label: 'a1',
        },
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(MenuId.CommandPalette, {
        command: {
          id: 'b',
          label: 'b1',
        },
      }),
    );

    // 注册一个 visible 为 false 的 menu item
    commandRegistry.registerCommand(
      {
        id: 'c',
        label: 'c1',
      },
      {
        execute: jest.fn(),
        isVisible: () => false,
      },
    );

    const menuNodes1 = menuService.createMenu(MenuId.CommandPalette, contextKeyService).getMenuNodes();
    expect(menuNodes1[0][1].length).toBe(1);
    expect(menuNodes1[0][1][0].label).toBe('b1');
    const menuNodes2 = menuService.createMenu(testMenuId, contextKeyService).getMenuNodes();
    expect(menuNodes2[0][1][0].label).toBe('a1');
  });

  it('register menubar item', () => {
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

    const menubarItems = menuRegistry.getMenubarItems();

    expect(menubarItems.length).toBe(3);
    // menu registry 会忽略排序，排序是在 menubar-service 里做的
    expect(menubarItems[0].label).toBe('a1');
    expect(menubarItems.map((n) => n.label)).toEqual(['a1', 'a2', 'a3']);
  });

  it('unregister menu-id', () => {
    disposables.add(
      menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
        command: {
          id: 'a',
          label: 'a1',
        },
      }),
    );

    disposables.add(
      menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
        command: {
          id: 'b',
          label: 'b1',
        },
      }),
    );

    const menus = menuService.createMenu(MenuId.ExplorerContext, contextKeyService);
    disposables.add(menus);

    let menuNodes = generateMergedCtxMenu({ menus });
    expect(menuNodes.length).toBe(2);
    expect(menuNodes.map((n) => n.label)).toEqual(['a1', 'b1']);

    disposables.add(menuRegistry.unregisterMenuId(MenuId.ExplorerContext));
    jest.runAllTimers();

    menuNodes = generateMergedCtxMenu({ menus });
    expect(menuNodes.length).toBe(0);
  });

  it('unregister menu item', () => {
    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: {
        id: 'a',
        label: 'a1',
      },
    });
    const menus = menuService.createMenu(MenuId.ExplorerContext, contextKeyService);

    let menuNodes = generateMergedCtxMenu({ menus });
    expect(menuNodes.length).toBe(1);
    expect(menuNodes[0].label).toBe('a1');

    menuRegistry.unregisterMenuItem(MenuId.ExplorerContext, 'a');
    jest.runAllTimers();
    menuNodes = generateMergedCtxMenu({ menus });
    expect(menuNodes.length).toBe(0);
  });

  describe('component menu item', () => {
    it('works', () => {
      disposables.add(
        menuRegistry.registerMenuItem(MenuId.EditorTitle, {
          component: CustomMenuItem,
          order: 100,
        }),
      );

      disposables.add(
        menuRegistry.registerMenuItem(MenuId.EditorTitle, {
          command: {
            id: 'b',
            label: 'b1',
          },
          group: 'navigation',
          order: 3,
        }),
      );

      const menus = menuService.createMenu(MenuId.EditorTitle, contextKeyService);
      const menuNodes = generateMergedCtxMenu({ menus });
      menus.dispose();
      expect(menuNodes.length).toBe(2);
      expect(menuNodes[0].label).toBe('b1');
      expect((menuNodes[1] as ComponentMenuItemNode).component).toBe(CustomMenuItem);
    });

    it('works for different group', () => {
      disposables.add(
        menuRegistry.registerMenuItem(MenuId.EditorTitle, {
          component: CustomMenuItem,
          order: 100,
        }),
      );

      disposables.add(
        menuRegistry.registerMenuItem(MenuId.EditorTitle, {
          command: {
            id: 'b',
            label: 'b1',
          },
          group: 'a3',
        }),
      );

      const menus = menuService.createMenu(MenuId.EditorTitle, contextKeyService);
      const menuNodes = generateMergedCtxMenu({ menus });
      menus.dispose();
      expect(menuNodes.length).toBe(3);
      expect((menuNodes[0] as ComponentMenuItemNode).component).toBe(CustomMenuItem);
      expect(menuNodes[1].id).toBe(SeparatorMenuItemNode.ID);
      expect(menuNodes[2].label).toBe('b1');
    });

    it('only works for editor/title', () => {
      // 目前只有 editor-title 开启了该选项
      disposables.add(
        menuRegistry.registerMenuItem('test-xxx', {
          component: CustomMenuItem,
          order: 100,
        }),
      );

      const menus1 = menuService.createMenu('test-xxx', contextKeyService);
      const menuNodes1 = generateMergedCtxMenu({ menus: menus1 });
      menus1.dispose();
      expect(menuNodes1.length).toBe(0);
    });
  });
});

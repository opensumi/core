import { CommandRegistry, CommandService, Command, isOSX } from '@ali/ide-core-common';
import { IDisposable, Disposable } from '@ali/ide-core-common/lib/disposable';
import { Event, Emitter } from '@ali/ide-core-common/lib/event';
import { Autowired, Injectable, Optional, INJECTOR_TOKEN, Injector } from '@ali/common-di';

import { ContextKeyChangeEvent, IContextKeyService } from '../../context-key';
import { IMenuItem, isIMenuItem, ISubmenuItem, IMenuRegistry, MenuNode } from './base';
import { MenuId } from './menu-id';
import { KeybindingRegistry } from '../../keybinding';

export interface IMenuNodeOptions {
  args?: any[]; // 固定参数可从这里传入
}

export interface IMenu extends IDisposable {
  readonly onDidChange: Event<IMenu | undefined>;
  getMenuNodes(options?: IMenuNodeOptions): Array<[string, Array<MenuItemNode | SubmenuItemNode>]>;
}

export abstract class AbstractMenuService {
  abstract createMenu(id: MenuId | string, contextKeyService?: IContextKeyService): IMenu;
}

export class SubmenuItemNode extends MenuNode {
  static readonly ID = 'menu.item.node.submenu';

  readonly item: ISubmenuItem;

  constructor(item: ISubmenuItem) {
    super(SubmenuItemNode.ID, '', item.label);
    this.item = item;
  }
}

// 分隔符
export class SeparatorMenuItemNode extends MenuNode {
  static readonly ID = 'menu.item.node.separator';

  constructor(label?: string) {
    super(SeparatorMenuItemNode.ID, label, label || 'separator');
  }
}

@Injectable()
export class MenuItemNode extends MenuNode {
  readonly item: Command;
  private _options: IMenuNodeOptions;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @Autowired(KeybindingRegistry)
  protected readonly keybindings: KeybindingRegistry;

  @Autowired(CommandRegistry)
  protected readonly commandRegistry: CommandRegistry;

  constructor(
    @Optional() item: Command,
    @Optional() options: IMenuNodeOptions = {},
    @Optional() disabled: boolean,
    @Optional() checked: boolean,
    @Optional() nativeRole?: string,
  ) {
    super(item.id, item.iconClass, item.label!, checked, disabled, nativeRole);

    this.className = undefined;

    const shortcutDesc = this.getShortcut(item.id);

    this.keybinding = shortcutDesc && shortcutDesc.keybinding || '';
    this.rawKeybinding = shortcutDesc && shortcutDesc.rawKeybinding;
    this.isKeyCombination = !!(shortcutDesc && shortcutDesc.isKeyCombination);
    this._options = options;

    this.item = item;
  }

  execute(args?: any[]): Promise<any> {
    const runArgs = [
      ...(this._options.args || []),
      ...(args || []),
    ];

    return this.commandService.executeCommand(this.item.id, ...runArgs);
  }

  private getShortcut(commandId: string) {
    if (commandId) {
      const keybindings = this.keybindings.getKeybindingsForCommand(commandId);
      if (keybindings.length > 0) {
        const isKeyCombination = Array.isArray(keybindings[0].resolved) && keybindings[0].resolved.length > 1;
        let keybinding = this.keybindings.acceleratorFor(keybindings[0], isOSX ? '' : '+').join(' ');
        if (isKeyCombination) {
          keybinding = `[${keybinding}]`;
        }
        return {
          keybinding,
          rawKeybinding: keybindings[0].keybinding,
          isKeyCombination,
        };
      }
    }
    return null;
  }
}

@Injectable()
export class MenuServiceImpl implements AbstractMenuService {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IContextKeyService)
  globalCtxKeyService: IContextKeyService;

  createMenu(id: MenuId, contextKeyService?: IContextKeyService): IMenu {
    return this.injector.get(Menu, [id, contextKeyService || this.globalCtxKeyService]);
  }
}

type MenuItemGroup = [string, Array<IMenuItem | ISubmenuItem>];

@Injectable()
class Menu extends Disposable implements IMenu {
  private readonly _onDidChange = new Emitter<IMenu | undefined>();
  get onDidChange(): Event<IMenu | undefined> {
    return this._onDidChange.event;
  }

  private _menuGroups: MenuItemGroup[];
  private _contextKeys: Set<string>;

  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  @Autowired(CommandRegistry)
  private readonly commandRegistry: CommandRegistry;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  constructor(
    @Optional() private readonly id: MenuId,
    @Optional() private readonly contextKeyService: IContextKeyService,
  ) {
    super();
    this._build();

    // rebuild this menu whenever the menu registry reports an
    // event for this MenuId
    this.addDispose(Event.debounce(
      // @taian.lta we need a new global menu registry
      Event.filter(this.menuRegistry.onDidChangeMenu, (menuId) => menuId === this.id),
      () => { },
      50,
    )(this._build, this));

    // when context keys change we need to check if the menu also
    // has changed
    this.addDispose(Event.debounce<ContextKeyChangeEvent, boolean>(
      this.contextKeyService.onDidChangeContext,
      (last, event) => last || event.payload.affectsSome(this._contextKeys),
      50,
    )((e) => e && this._onDidChange.fire(undefined), this));

    this.addDispose(this._onDidChange);
  }

  private _build(): void {

    // reset
    this._menuGroups = [];
    this._contextKeys = new Set();

    let menuItems = this.menuRegistry.getMenuItems(this.id);

    let group: MenuItemGroup | undefined;
    menuItems = menuItems.sort(menuItemsSorter);

    for (const item of menuItems) {
      // group by groupId
      const groupName = item.group || '';
      if (!group || group[0] !== groupName) {
        group = [groupName, []];
        this._menuGroups.push(group);
      }
      group![1].push(item);

      // keep keys for eventing
      this.fillKeysInWhenExpr(this._contextKeys, item.when);

      // 收集 toggledWhen
      if (isIMenuItem(item)) {
        this.fillKeysInWhenExpr(this._contextKeys, item.toggledWhen);
      }

      // FIXME: 我们的 command 有 precondition(command)/toggled 属性吗？
      // keep precondition keys for event if applicable
      // if (isIMenuItem(item) && item.command.precondition) {
      //   Menu._fillInKbExprKeys(item.command.precondition, this._contextKeys);
      // }

      // keep toggled keys for event if applicable
      // if (isIMenuItem(item) && item.command.toggled) {
      //   Menu._fillInKbExprKeys(item.command.toggled, this._contextKeys);
      // }
    }
    this._onDidChange.fire(this);
  }

  getMenuNodes(options: IMenuNodeOptions = {}): Array<[string, Array<MenuItemNode | SubmenuItemNode>]> {
    const result: [string, Array<MenuItemNode | SubmenuItemNode>][] = [];
    for (const group of this._menuGroups) {
      const [id, items] = group;
      const activeActions: Array<MenuItemNode | SubmenuItemNode> = [];
      for (const item of items) {
        // FIXME: 由于缺失比较多的 context key, 因此 CommandPalette 跳过 when 匹配
        if (this.id === MenuId.CommandPalette || this.contextKeyService.match(item.when)) {
          if (isIMenuItem(item)) {
            // 兼容现有的 Command#isVisible
            const { args = [] } = options;
            const menuCommandDesc = this.menuRegistry.getMenuCommand(item.command);
            const command = this.commandRegistry.getCommand(menuCommandDesc.id);

            const menuCommand = { ...(command || {}), ...menuCommandDesc };
            // 没有 desc 的 command 不展示在 menu 中
            if (!menuCommand.label) {
              continue;
            }

            // FIXME: Command.isVisible 待废弃
            // command 存在但是 isVisible 为 false 则跳过
            if (command && !this.commandRegistry.isVisible(menuCommand.id, ...args)) {
              continue;
            }

            // 默认为 true, command 存在则按照 command#isEnabled 的结果
            const commandEnablement = command ? this.commandRegistry.isEnabled(menuCommand.id, ...args) : true;
            const commandToggle = Boolean(command && this.commandRegistry.isToggled(menuCommand.id, ...args));

            const disabled = !commandEnablement;
            // toggledWhen 的优先级高于 isToggled
            // 若设置了 toggledWhen 则忽略 Command 的 isVisible
            const checked = 'toggledWhen' in item
              ? this.contextKeyService.match(item.toggledWhen)
              : commandToggle;
            const action = this.injector.get(MenuItemNode, [menuCommand, options, disabled, checked, item.nativeRole]);
            activeActions.push(action);
          } else {
            // 只有 label 存在值的时候才渲染
            if (item.label) {
              const action = new SubmenuItemNode(item);
              activeActions.push(action);
            }
          }
        }
      }

      if (activeActions.length > 0) {
        result.push([id, activeActions]);
      }
    }
    return result;
  }

  private fillKeysInWhenExpr(set: Set<string>, when?: string | monaco.contextkey.ContextKeyExpr) {
    const keys = this.contextKeyService.getKeysInWhen(when);
    keys.forEach((key) => {
      set.add(key);
    });
  }
}

function menuItemsSorter(a: IMenuItem, b: IMenuItem): number {
  const aGroup = a.group;
  const bGroup = b.group;

  if (aGroup !== bGroup) {

    // Falsy groups come last
    if (!aGroup) {
      return 1;
    } else if (!bGroup) {
      return -1;
    }

    // 'navigation' group comes first
    if (aGroup === 'navigation') {
      return -1;
    } else if (bGroup === 'navigation') {
      return 1;
    }

    // lexical sort for groups
    const value = aGroup.localeCompare(bGroup);
    if (value !== 0) {
      return value;
    }
  }

  // sort on priority - default is 0
  const aPrio = a.order || 0;
  const bPrio = b.order || 0;
  if (aPrio < bPrio) {
    return -1;
  } else if (aPrio > bPrio) {
    return 1;
  }

  return 0;
  // TODO: 临时先禁用掉这里的排序
  // return Command.compareCommands(a.command, b.command);
}

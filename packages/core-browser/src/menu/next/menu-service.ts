import { CommandService, Command, replaceLocalizePlaceholder } from '@ali/ide-core-common';
import { IDisposable, Disposable } from '@ali/ide-core-common/lib/disposable';
import { Event, Emitter } from '@ali/ide-core-common/lib/event';
import { Autowired, Injectable, Optional, Inject, INJECTOR_TOKEN, Injector } from '@ali/common-di';

import { ContextKeyChangeEvent, IContextKeyService } from '../../context-key';
import { MenuId, IMenuItem, isIMenuItem, ISubmenuItem, IMenuRegistry, MenuNode } from './base';
import { i18nify } from './menu-util';
import { KeybindingRegistry, ResolvedKeybinding } from '../../keybinding';

export interface IMenuNodeOptions {
  arg?: any; // 固定参数从这里传入
}

export interface IMenu extends IDisposable {
  readonly onDidChange: Event<IMenu | undefined>;
  getMenuNodes(options?: IMenuNodeOptions): Array<[string, Array<MenuItemNode | SubmenuItemNode>]>;
}

export abstract class MenuService {
  abstract createMenu(id: MenuId, scopedKeybindingService: IContextKeyService): IMenu;
}

// 后续 MenuNode 要看齐 @ali/ide-core-common 的 ActionMenuNode
export class SubmenuItemNode extends MenuNode {
  readonly item: ISubmenuItem;

  // todo: 需要再去看下 submenu 如何实现，我们这边目前没有看到
  constructor(item: ISubmenuItem) {
    typeof item.title === 'string' ? super('', item.title, 'submenu') : super('', item.title.value, 'submenu');
    this.item = item;
  }
}

// 分隔符
export class SeparatorMenuItemNode extends MenuNode {
  static readonly ID = 'menu.item.node.separator';

  constructor(label?: string) {
    super(SeparatorMenuItemNode.ID, label, label ? 'separator text' : 'separator');
  }
}

@Injectable()
export class MenuItemNode extends MenuNode {
  readonly item: Command;
  private _options: IMenuNodeOptions;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(KeybindingRegistry)
  keybindings: KeybindingRegistry;

  constructor(
    @Optional() item: Command,
    @Optional() options: IMenuNodeOptions,
  ) {
    // 后置获取 i18n 数据
    const command = i18nify(item);
    super(command.id, command.iconClass!, command.label!);
    this.className = undefined;
    this.shortcut = this.getShortcut(command.id);
    this._options = options || {};

    this.item = command;
  }

  execute(...args: any[]): Promise<any> {
    let runArgs: any[] = [];

    if (this._options.arg) {
      runArgs = [...runArgs, this._options.arg];
    }

    runArgs = [...runArgs, ...args];

    return this.commandService.executeCommand(this.item.id, ...runArgs);
  }

  private getShortcut(commandId: string) {
    if (commandId) {
      const keybinding = this.keybindings.getKeybindingsForCommand(commandId) as ResolvedKeybinding[];
      if (keybinding.length > 0) {
        return keybinding[0]!.resolved![0].toString();
      }
    }
    return '';
  }
}

@Injectable()
export class MenuServiceImpl implements MenuService {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  createMenu(id: MenuId, contextKeyService: IContextKeyService): IMenu {
    return this.injector.get(Menu, [id, contextKeyService]);
  }
}

type MenuItemGroup = [string, Array<IMenuItem | ISubmenuItem>];

@Injectable()
class Menu extends Disposable implements IMenu {
  private readonly _onDidChange = new Emitter<IMenu | undefined>();

  private _menuGroups: MenuItemGroup[];
  private _contextKeys: Set<string>;

  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

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
      // (listener) => this.eventBus.on(ContextKeyChangeEvent, listener),
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

    const menuItems = this.menuRegistry.getMenuItems(this.id);

    let group: MenuItemGroup | undefined;
    menuItems.sort(menuItemsSorter);

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

      // @fixme: 我们的 command 有 precondition(command)/toggled 属性吗？
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

  get onDidChange(): Event<IMenu | undefined> {
    return this._onDidChange.event;
  }

  /**
   * 由于 i18n 语言包加载时序问题, 在插件注册时 command 的 label/category 不一定能获取到 i18n 文案
   * 因此在 getMenuNodes 里后置进行语言获取替换及 menu 的排序
   */
  getMenuNodes(options: IMenuNodeOptions): Array<[string, Array<MenuItemNode | SubmenuItemNode>]> {
    const result: [string, Array<MenuItemNode | SubmenuItemNode>][] = [];
    for (const group of this._menuGroups) {
      const [id, items] = group;
      const activeActions: Array<MenuItemNode | SubmenuItemNode> = [];
      for (const item of items) {
        if (this.contextKeyService.match(item.when)) {
          const action = isIMenuItem(item)
            ? this.injector.get(MenuItemNode, [item.command, options])
            : new SubmenuItemNode(item);
          activeActions.push(action);
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

  // sort on label/category 目前 sort 不了，是因为注册的 command 的多语言依赖于插件语言包
  // 但是目前 contribute 时 插件语言包加载不到，需要后续解决
  return 0;
  return Command.compareCommands(a.command, b.command);
}

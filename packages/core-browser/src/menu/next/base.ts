import { CommandRegistry, IDisposable, Event, Emitter, Command, ContributionProvider } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { MenuId } from './menu-id';

export const NextMenuContribution = Symbol('NextMenuContribution');
export interface NextMenuContribution {
  registerNextMenus(menus: IMenuRegistry): void;
}

export interface ILocalizedString {
  value: string;
  original: string;
}

export interface IMenuItem {
  command: string;
  when?: string | monaco.contextkey.ContextKeyExpr;
  group?: 'navigation' | string;
  order?: number;
  nativeRole?: string; // electron native 菜单使用
}

export interface ISubmenuItem {
  title: string | ILocalizedString;
  submenu: MenuId; // 暂时尚未遇到
  when?: string | monaco.contextkey.ContextKeyExpr;
  group?: 'navigation' | string;
  order?: number;
  nativeRole?: string; // electron native 菜单使用
}

export type ICommandsMap = Map<string, Command>;

export abstract class IMenuRegistry {
  readonly onDidChangeMenu: Event<string>;
  abstract addCommand(userCommand: Command): IDisposable;
  abstract getCommand(id: string): Command | undefined;
  abstract getCommands(): ICommandsMap;
  abstract registerMenuItem(menu: MenuId | string, item: IMenuItem | ISubmenuItem): IDisposable;
  abstract getMenuItems(loc: MenuId): Array<IMenuItem | ISubmenuItem>;
}

@Injectable()
export class MenuRegistry implements IMenuRegistry {
  private readonly _commands = new Map<string, Command>();
  private readonly _menuItems = new Map<string, Array<IMenuItem | ISubmenuItem>>();
  private readonly _onDidChangeMenu = new Emitter<string>();

  readonly onDidChangeMenu: Event<string> = this._onDidChangeMenu.event;

  @Autowired(NextMenuContribution)
  protected readonly contributions: ContributionProvider<NextMenuContribution>;

  @Autowired(CommandRegistry)
  protected readonly commandRegistry: CommandRegistry;

  // MenuContribution
  onStart() {
    for (const contrib of this.contributions.getContributions()) {
      contrib.registerNextMenus(this);
    }
  }

  addCommand(command: Command): IDisposable {
    this._commands.set(command.id, command);
    this._onDidChangeMenu.fire(MenuId.CommandPalette);
    return {
      dispose: () => {
        if (this._commands.delete(command.id)) {
          this._onDidChangeMenu.fire(MenuId.CommandPalette);
        }
      },
    };
  }

  getCommand(id: string): Command | undefined {
    return this._commands.get(id);
  }

  getCommands(): ICommandsMap {
    const map = new Map<string, Command>();
    this._commands.forEach((value, key) => map.set(key, value));
    return map;
  }

  registerMenuItem(id: MenuId | string, item: IMenuItem | ISubmenuItem): IDisposable {
    let array = this._menuItems.get(id);
    if (!array) {
      array = [item];
      this._menuItems.set(id, array);
    } else {
      array.push(item);
    }
    this._onDidChangeMenu.fire(id);
    return {
      dispose: () => {
        const idx = array!.indexOf(item);
        if (idx >= 0) {
          array!.splice(idx, 1);
          this._onDidChangeMenu.fire(id);
        }
      },
    };
  }

  getMenuItems(id: MenuId): Array<IMenuItem | ISubmenuItem> {
    const result = (this._menuItems.get(id) || []).slice(0);

    if (id === MenuId.CommandPalette) {
      // CommandPalette 特殊处理, 默认展示所有的 command
      // CommandPalette 负责添加 when 条件
      this.appendImplicitMenuItems(result);
    }

    return result;
  }

  private appendImplicitMenuItems(result: Array<IMenuItem | ISubmenuItem>) {
    // 只保留 MenuItem
    const temp = result.filter((item) => isIMenuItem(item)) as IMenuItem[];
    const set = new Set<string>(temp.map((n) => n.command));

    const allCommands = this.commandRegistry.getCommands();
    // 将 commandRegistry 中 "其他" command 加进去
    allCommands.forEach((command) => {
      if (!set.has(command.id)) {
        result.push({ command: command.id });
      }
    });
  }
}

export function isIMenuItem(item: IMenuItem | ISubmenuItem): item is IMenuItem {
  return (item as IMenuItem).command !== undefined;
}

export function isISubmenuItem(item: IMenuItem | ISubmenuItem): item is ISubmenuItem {
  return (item as ISubmenuItem).submenu !== undefined;
}

export interface IMenuAction {
  readonly id: string; // command id
  label: string;
  tooltip: string;
  className?: string;
  icon: string; // 标准的 vscode icon 是分两种主题的
  keybinding: string; // 快捷键描述
  isKeyCombination: boolean; // 是否为组合键
  disabled?: boolean; // disable 状态的 menu
  nativeRole?: string; // eletron menu 使用
  execute(event?: any): Promise<any>;
}

export class MenuNode implements IMenuAction {
  readonly id: string;
  label: string;
  tooltip: string;
  className: string | undefined;
  icon: string;
  keybinding: string;
  isKeyCombination: boolean;
  disabled: boolean;
  nativeRole: string;
  readonly _actionCallback?: (event?: any) => Promise<any>;

  constructor(
    commandId: string,
    icon: string = '',
    label: string = '',
    disabled = false,
    nativeRole: string = '',
    keybinding: string = '',
    isKeyCombination: boolean = false,
    className: string = '',
    actionCallback?: (event?: any) => Promise<any>,
  ) {
    this.id = commandId;
    this.label = label;
    this.className = className;
    this.icon = icon;
    this.keybinding = keybinding;
    this.isKeyCombination = isKeyCombination;
    this.disabled = disabled;
    this.nativeRole = nativeRole;
    this._actionCallback = actionCallback;
  }

  execute(event?: any): Promise<any> {
    if (this._actionCallback) {
      return this._actionCallback(event);
    }

    return Promise.resolve(true);
  }
}

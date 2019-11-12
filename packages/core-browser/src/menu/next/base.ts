import { CommandRegistry, IDisposable, Event, Emitter, Command, ContributionProvider } from '@ali/ide-core-common';
import { ILogger } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';

import { MenuId } from './menu-id';
import { Disposable } from '../../../../core-common/lib';

export const NextMenuContribution = Symbol('NextMenuContribution');
export interface NextMenuContribution {
  registerNextMenus(menus: IMenuRegistry): void;
}

export interface ILocalizedString {
  value: string;
  original: string;
}

export interface MenuCommandDesc {
  id: string;
  label?: string;
}

export interface IMenuItem {
  command: string | MenuCommandDesc;
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
  abstract getMenuCommand(command: string | MenuCommandDesc): MenuCommandDesc;
  abstract registerMenuItem(menu: MenuId | string, item: IMenuItem | ISubmenuItem): IDisposable;
  abstract getMenuItems(loc: MenuId): Array<IMenuItem | ISubmenuItem>;
}

@Injectable()
export class CoreMenuRegistry implements IMenuRegistry {
  private readonly _commands = new Map<string, ICommandsMap>();
  private readonly _menuItems = new Map<string, Array<IMenuItem | ISubmenuItem>>();
  private readonly _onDidChangeMenu = new Emitter<string>();

  readonly onDidChangeMenu: Event<string> = this._onDidChangeMenu.event;

  @Autowired(NextMenuContribution)
  protected readonly contributions: ContributionProvider<NextMenuContribution>;

  @Autowired(CommandRegistry)
  private readonly commandRegistry: CommandRegistry;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  private addCommand(menuId: MenuId | string, command: MenuCommandDesc): IDisposable {
    if (!menuId || !command.id) {
      this.logger.warn(`invalid namespace with menuId: ${menuId} and commandId: ${command.id}`);
      return Disposable.NULL;
    }
    const currentCommandsMap = this._commands.get(menuId) || new Map<string, Command>();
    currentCommandsMap.set(command.id, command);

    this._commands.set(menuId, currentCommandsMap);
    this._onDidChangeMenu.fire(menuId);
    return {
      dispose: () => {
        if (this._commands.delete(command.id)) {
          this._onDidChangeMenu.fire(menuId);
        }
      },
    };
  }

  private getCommand(menuId: MenuId | string, commandId: string): Command | undefined {
    if (!menuId || !commandId) {
      this.logger.warn(`invalid namespace with menuId: ${menuId} and commandId: ${commandId}`);
      return undefined;
    }

    const commandsMap = this._commands.get(menuId);
    if (!commandsMap) {
      return undefined;
    }

    return commandsMap.get(commandId);
  }

  private getCommands(menuId: MenuId | string): ICommandsMap | undefined {
    return this._commands.get(menuId);
  }

  registerMenuItem(menuId: MenuId | string, item: IMenuItem | ISubmenuItem): IDisposable {
    let array = this._menuItems.get(menuId);
    if (!array) {
      array = [item];
      this._menuItems.set(menuId, array);
    } else {
      array.push(item);
    }

    // // 如果当前 MenuItem 为 IMenuItem 且 command 带了额外描述, 则保存对应的内容
    // if (isIMenuItem(item) && typeof item.command !== 'string' && item.command.id) {
    //   this.addCommand(menuId, item.command);
    // }

    this._onDidChangeMenu.fire(menuId);
    return {
      dispose: () => {
        const idx = array!.indexOf(item);
        if (idx >= 0) {
          array!.splice(idx, 1);
          this._onDidChangeMenu.fire(menuId);
        }
      },
    };
  }

  getMenuItems(id: MenuId | string): Array<IMenuItem | ISubmenuItem> {
    const result = (this._menuItems.get(id) || []).slice(0);

    if (id === MenuId.CommandPalette) {
      // CommandPalette 特殊处理, 默认展示所有的 command
      // CommandPalette 负责添加 when 条件
      this.appendImplicitMenuItems(result);
    }

    return result;
  }

  getMenuCommand(command: string | MenuCommandDesc): MenuCommandDesc {
    if (typeof command === 'string') {
      return { id: command };
    }

    return command;
  }

  private appendImplicitMenuItems(result: Array<IMenuItem | ISubmenuItem>) {
    // 只保留 MenuItem
    const temp = result.filter((item) => isIMenuItem(item)) as IMenuItem[];
    const set = new Set<string>(temp.map((n) => this.getMenuCommand(n.command).id));

    const allCommands = this.commandRegistry.getCommands();
    // 将 commandRegistry 中 "其他" command 加进去
    allCommands.forEach((command) => {
      if (!set.has(command.id)) {
        result.push({ command: command.id });
      }
    });
  }
}

@Injectable()
export class MenuRegistry extends CoreMenuRegistry {
  @Autowired(NextMenuContribution)
  protected readonly contributions: ContributionProvider<NextMenuContribution>;

  // MenuContribution
  onStart() {
    for (const contrib of this.contributions.getContributions()) {
      contrib.registerNextMenus(this);
    }
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

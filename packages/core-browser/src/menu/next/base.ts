import { CommandRegistry, IDisposable, Event, Emitter, Command, ContributionProvider, ILogger } from '@ali/ide-core-common';
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

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export interface MenuCommandDesc {
  id: string;
  label: string;
}

export interface IMenuItem {
  command: string | MenuCommandDesc;
  when?: string | monaco.contextkey.ContextKeyExpr;
  toggledWhen?: string | monaco.contextkey.ContextKeyExpr;
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
  abstract getMenuCommand(command: string | MenuCommandDesc): PartialBy<MenuCommandDesc, 'label'>;
  abstract registerMenuItem(menu: MenuId | string, item: IMenuItem | ISubmenuItem): IDisposable;
  abstract getMenuItems(loc: MenuId): Array<IMenuItem | ISubmenuItem>;
}

@Injectable()
export class CoreMenuRegistry implements IMenuRegistry {
  private readonly _menuItems = new Map<string, Array<IMenuItem | ISubmenuItem>>();
  private readonly _onDidChangeMenu = new Emitter<string>();

  readonly onDidChangeMenu: Event<string> = this._onDidChangeMenu.event;

  @Autowired(NextMenuContribution)
  protected readonly contributions: ContributionProvider<NextMenuContribution>;

  @Autowired(CommandRegistry)
  private readonly commandRegistry: CommandRegistry;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  registerMenuItem(menuId: MenuId | string, item: IMenuItem | ISubmenuItem): IDisposable {
    let array = this._menuItems.get(menuId);
    if (!array) {
      array = [item];
      this._menuItems.set(menuId, array);
    } else {
      array.push(item);
    }

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

  getMenuCommand(command: string | MenuCommandDesc) {
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
  checked?: boolean; // checked 状态 通过 toggleWhen 实现
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
  checked: boolean;
  nativeRole: string;
  readonly _actionCallback?: (event?: any) => Promise<any>;

  constructor(
    commandId: string,
    icon: string = '',
    label: string = '',
    checked = false,
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
    this.checked = checked;
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

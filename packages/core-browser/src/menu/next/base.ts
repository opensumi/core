import { Injectable, Autowired } from '@ali/common-di';
import { ButtonType } from '@ali/ide-components';
import { ILogger, Disposable, combinedDisposable, CommandRegistry, IDisposable, Event, Emitter, Command, ContributionProvider } from '@ali/ide-core-common';

import { MenuId } from './menu-id';

export const NextMenuContribution = Symbol('NextMenuContribution');
export interface NextMenuContribution {
  registerNextMenus(menus: IMenuRegistry): void;
}

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export interface MenuCommandDesc {
  id: string;
  label: string;
}

interface IBaseMenuItem {
  group?: 'navigation' | string;
  order?: number;
  /**
   * 决定是否在视图层展示
   */
  when?: string | monaco.contextkey.ContextKeyExpr;
  // 以下为 kaitian 拓展的属性
  /**
   * 单独变更此 menu action 的 args
   */
  argsTransformer?: ((...args: any[]) => any[]);
  /**
   * 图标的名称
   * 当 menu 在 InlineActionBar 出现时，使用的 iconClass
   * 如果这个值不存在，则默认跟随 command 的 iconClass
   * 如果command的icon也不存在，使用 command 的 label
   * // TODO: 未来可能废弃 command 内的 iconClass
   */
  iconClass?: string;
  /**
   * electron native 菜单使用
   */
  nativeRole?: string;
  /**
   * 决定 menu 渲染的类型
   * 默认值为 icon
   */
  type?: IMenuActionDisplayType;
}

export interface IMenuItem extends IBaseMenuItem {
  command: string | MenuCommandDesc;
  // 以下为 kaitian 拓展的属性
  /**
   * 决定 toggled 状态
   * more-dropdown 中主要表现为文字左侧有一个 ✅
   * icon 则表现为 背景色选中 状态
   */
  toggledWhen?: string | monaco.contextkey.ContextKeyExpr;
  /**
   * 决定 disabled 状态，主要表现为 menu item 颜色变灰
   */
  enabledWhen?: string | monaco.contextkey.ContextKeyExpr;
}

export interface ISubmenuItem extends IBaseMenuItem {
  submenu: MenuId | string;
  /**
   * 支持国际化占位符，例如 %evenEditorGroups%
   */
  label?: string;
}

export type ICommandsMap = Map<string, Command>;

export abstract class IMenuRegistry {
  readonly onDidChangeMenubar: Event<string>;
  abstract registerMenubarItem(menuId: string, item: PartialBy<IMenubarItem, 'id'>): IDisposable;
  abstract removeMenubarItem(menuId: string): void;
  abstract getMenubarItem(menuId: string): IMenubarItem | undefined;
  abstract getMenubarItems(): Array<IMenubarItem>;

  readonly onDidChangeMenu: Event<string>;
  abstract getMenuCommand(command: string | MenuCommandDesc): PartialBy<MenuCommandDesc, 'label'>;
  abstract registerMenuItem(menuId: MenuId | string, item: IMenuItem | ISubmenuItem): IDisposable;
  abstract registerMenuItems(menuId: MenuId | string, items: Array<IMenuItem | ISubmenuItem>): IDisposable;
  abstract unregisterMenuId(menuId: string): IDisposable;
  abstract getMenuItems(menuId: MenuId | string): Array<IMenuItem | ISubmenuItem>;
}

export interface IMenubarItem {
  id: string; // 作为 menu-id 注册进来
  label: string;
  order?: number;
  nativeRole?: string; // electron menu 使用
}

@Injectable()
export class CoreMenuRegistryImpl implements IMenuRegistry {
  private readonly _menubarItems = new Map<string, IMenubarItem>();

  private readonly _onDidChangeMenubar = new Emitter<string>();
  readonly onDidChangeMenubar: Event<string> = this._onDidChangeMenubar.event;

  private readonly _menuItems = new Map<string, Array<IMenuItem | ISubmenuItem>>();

  private readonly _onDidChangeMenu = new Emitter<string>();
  readonly onDidChangeMenu: Event<string> = this._onDidChangeMenu.event;

  // 记录被禁用的 menu-id
  // TODO: 考虑是否存到持久化数据中? @taian.lta
  private readonly _disabledMenuIds = new Set<string>();

  @Autowired(NextMenuContribution)
  protected readonly contributions: ContributionProvider<NextMenuContribution>;

  @Autowired(CommandRegistry)
  private readonly commandRegistry: CommandRegistry;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  /**
   * 这里的注册只允许注册一次
   */
  registerMenubarItem(menuId: string, item: PartialBy<IMenubarItem, 'id'>): IDisposable {
    // 将 menuId 存到结构中去
    const menubarItem = { ...item, id: menuId } as IMenubarItem;
    const existedItem = this._menubarItems.get(menuId);
    if (existedItem) {
      this.logger.warn(`this menuId ${menuId} already existed`);
      return Disposable.NULL;
    }

    this._menubarItems.set(menuId, menubarItem);
    this._onDidChangeMenubar.fire(menuId);
    return {
      dispose: () => {
        this.removeMenubarItem(menuId);
      },
    };
  }

  removeMenubarItem(menuId: string) {
    const item = this._menubarItems.get(menuId);
    if (item) {
      this._menubarItems.delete(menuId);
      this._onDidChangeMenubar.fire(menuId);
    }
  }

  getMenubarItem(menuId: string): IMenubarItem | undefined {
    return this._menubarItems.get(menuId);
  }

  getMenubarItems(): IMenubarItem[] {
    const menubarIds = Array.from(this._menubarItems.keys());
    return menubarIds.reduce((prev, menubarId) => {
      const menubarItem = this._menubarItems.get(menubarId);
      if (menubarItem) {
        prev.push(menubarItem);
      }
      return prev;
    }, [] as IMenubarItem[]);
  }

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

  registerMenuItems(menuId: string, items: (IMenuItem | ISubmenuItem)[]): IDisposable {
    const disposables = [] as IDisposable[];
    items.forEach((item) => {
      disposables.push(this.registerMenuItem(menuId, item));
    });

    return combinedDisposable(disposables);
  }

  unregisterMenuId(menuId: string): IDisposable {
    this._disabledMenuIds.add(menuId);
    this._onDidChangeMenu.fire(menuId);

    return {
      dispose: () => {
        const deleted = this._disabledMenuIds.delete(menuId);
        if (deleted) {
          this._onDidChangeMenu.fire(menuId);
        }
      },
    };
  }

  getMenuItems(id: MenuId | string): Array<IMenuItem | ISubmenuItem> {
    // 将 disable 掉的 MenuId 返回为空
    if (this._disabledMenuIds.has(id)) {
      return [];
    }

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
export class MenuRegistryImpl extends CoreMenuRegistryImpl {
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

/**
 * 这里的 MenuAction 的展示类型拓展为支持 Button 组件的类型以及 checkbox
 * 由于 Comment 模块的默认用的 Menu 的展示类型为 Button 类型
 * 同时从设计角度更完善的展示 checked 属性，额外拓展了 checkbox 类型
 * 用在 button 类型时 checked 状态的展示
*/
export type IMenuActionDisplayType = ButtonType | & 'checkbox';

export interface IMenuAction {
  /**
   * command id
   */
  readonly id: string;
  label: string;
  /**
   * 标准的 vscode icon 是分两种主题的
   */
  icon?: string;
  tooltip?: string;
  className?: string;
  /**
   * 快捷键描述
   */
  keybinding?: string;
  rawKeybinding?: string;
  /**
   * 是否为组合键
   */
  isKeyCombination?: boolean;
  /**
   * disable 状态的 menu
   */
  disabled?: boolean;
  /**
   * checked 状态 通过 toggledWhen 实现
   */
  checked?: boolean;
  /**
   * electron menu 使用
  */
  nativeRole?: string;
  execute?: (...args: any[]) => any;
  /**
   * 默认值为 'icon'
   */
  type?: IMenuActionDisplayType;
}

export class MenuNode implements IMenuAction {
  readonly id: string;
  label: string;
  icon?: string;
  tooltip?: string;
  className?: string;
  keybinding: string;
  rawKeybinding: string;
  isKeyCombination: boolean;
  disabled: boolean;
  checked: boolean;
  nativeRole: string;
  children: MenuNode[];
  type?: IMenuActionDisplayType;
  protected _actionCallback?: (...args: any[]) => any;

  constructor(props: IMenuAction) {
    this.id = props.id;
    this.label = props.label;
    this.className = props.className || '';
    this.icon = props.icon || '';
    this.keybinding = props.keybinding || '';
    this.rawKeybinding = props.rawKeybinding || '';
    this.isKeyCombination = Boolean(props.isKeyCombination);
    this.disabled = Boolean(props.disabled);
    this.checked = Boolean(props.checked);
    this.nativeRole = props.nativeRole || '';
    this.type = props.type;
    this._actionCallback = props.execute;
  }

  execute(...args: any[]): any {
    if (this._actionCallback) {
      return this._actionCallback(...args);
    }

    return Promise.resolve(true);
  }
}

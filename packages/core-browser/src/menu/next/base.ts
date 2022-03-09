import ReactIs from 'react-is';

import { Injectable, Autowired } from '@opensumi/di';
import { ButtonType } from '@opensumi/ide-components';
import { warning } from '@opensumi/ide-components/lib/utils';
import {
  replaceLocalizePlaceholder,
  ILogger,
  Disposable,
  combinedDisposable,
  CommandRegistry,
  IDisposable,
  Event,
  Emitter,
  Command,
  ContributionProvider,
  ISumiMenuExtendInfo,
} from '@opensumi/ide-core-common';
import { ContextKeyExpr } from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';


import { MenuId } from './menu-id';

export const MenuContribution = Symbol('MenuContribution');
export interface MenuContribution {
  /**
   * @deprecated 请使用 registerMenus
   */
  registerNextMenus?(menus: IMenuRegistry): void;
  registerMenus?(menus: IMenuRegistry): void;
}

/**
 * @deprecated 请使用 NextMenuContribution
 */
export const NextMenuContribution = MenuContribution;
/**
 * @deprecated 请使用 NextMenuContribution
 */
export type NextMenuContribution = MenuContribution;

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export interface MenuCommandDesc {
  id: string;
  label: string;
}

interface ICoreMenuItem {
  order?: number;
  /**
   * 决定是否在视图层展示
   */
  when?: string | ContextKeyExpr;
  // 以下为 sumi 拓展的属性
  /**
   * 单独变更此 menu action 的 args
   */
  argsTransformer?: (...args: any[]) => any[];
}

interface IBaseMenuItem extends ICoreMenuItem {
  group?: 'navigation' | string;
  /**
   * 图标的名称
   * 当 menu 在 InlineActionBar 出现时，使用的 iconClass
   * 如果这个值不存在，则默认跟随 command 的 iconClass
   * 如果command的icon也不存在，使用 command 的 label
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

export interface IComponentMenuItemProps {
  getExecuteArgs: () => any[];
}

/**
 * 有限开放，目前仅支持 navigation 的 group，也不支持 context 系列的位置
 */
interface IInternalComponentMenuItem extends ICoreMenuItem {
  /**
   * 单个 menu 支持传入额外参数
   */
  extraTailArgs?: any[];
  /**
   * 组件形式的 menu item
   */
  component: React.ComponentType<IComponentMenuItemProps>;
}

export interface IComponentMenuItem extends IInternalComponentMenuItem {
  /**
   * group 默认为 `navigation`
   */
  group: 'navigation';
}

export interface IMenuItem extends IBaseMenuItem {
  command: string | MenuCommandDesc;
  // 以下为 sumi 拓展的属性
  /**
   * 单个 menu 支持传入额外参数
   */
  extraTailArgs?: any[];
  /**
   * 决定 toggled 状态
   * more-dropdown 中主要表现为文字左侧有一个 ✅
   * icon 则表现为 背景色选中 状态
   */
  toggledWhen?: string | ContextKeyExpr;
  /**
   * 决定 disabled 状态，主要表现为 menu item 颜色变灰
   */
  enabledWhen?: string | ContextKeyExpr;
  /**
   * 菜单栏最右侧显示的额外信息
   */
  extraDesc?: string;
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
  abstract registerMenuExtendInfo(menuId: MenuId | string, items: Array<ISumiMenuExtendInfo>);
  abstract registerMenuItem(
    menuId: MenuId | string,
    item: IMenuItem | ISubmenuItem | IInternalComponentMenuItem,
  ): IDisposable;
  abstract unregisterMenuItem(menuId: MenuId | string, menuItemId: string): void;
  abstract registerMenuItems(
    menuId: MenuId | string,
    items: Array<IMenuItem | ISubmenuItem | IInternalComponentMenuItem>,
  ): IDisposable;
  abstract unregisterMenuId(menuId: string): IDisposable;
  abstract getMenuItems(menuId: MenuId | string): Array<IMenuItem | ISubmenuItem | IComponentMenuItem>;
}

export interface IMenubarItem {
  id: string; // 作为 menu-id 注册进来
  label: string;
  order?: number;
  nativeRole?: string; // electron menu 使用
}

@Injectable()
export class CoreMenuRegistryImpl implements IMenuRegistry {
  // 目前只支持 `EditorTitle` 开放 `ComponentMenuItem`
  static EnableComponentMenuIds: Array<MenuId | string> = [MenuId.EditorTitle];

  private readonly _menubarItems = new Map<string, IMenubarItem>();

  private readonly _onDidChangeMenubar = new Emitter<string>();
  readonly onDidChangeMenubar: Event<string> = this._onDidChangeMenubar.event;

  private readonly _menuItems = new Map<string, Array<IMenuItem | ISubmenuItem | IComponentMenuItem>>();
  private readonly _menuExtendInfo = new Map<string, Array<ISumiMenuExtendInfo>>();

  private readonly _onDidChangeMenu = new Emitter<string>();
  readonly onDidChangeMenu: Event<string> = this._onDidChangeMenu.event;

  // 记录被禁用的 menu-id
  private readonly _disabledMenuIds = new Set<string>();

  @Autowired(MenuContribution)
  protected readonly contributions: ContributionProvider<MenuContribution>;

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

    return Disposable.create(() => this.removeMenubarItem(menuId));
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

  registerMenuExtendInfo(menuId: MenuId | string, item: Array<ISumiMenuExtendInfo>): IDisposable {
    this._menuExtendInfo.set(menuId, item);

    return Disposable.create(() => this._menuExtendInfo.delete(menuId));
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

    return Disposable.create(() => {
      const idx = array!.indexOf(item);
      if (idx >= 0) {
        array!.splice(idx, 1);
        this._onDidChangeMenu.fire(menuId);
      }
    });
  }

  unregisterMenuItem(menuId: MenuId | string, menuItemId: string): void {
    const array = this._menuItems.get(menuId);
    if (array) {
      const idx = array.findIndex((item) => {
        const command: string | MenuCommandDesc = (item as IMenuItem).command;
        if (command) {
          if (typeof command === 'string') {
            return command === menuItemId;
          }
          return command.id === menuItemId;
        } else {
          return (item as ISubmenuItem).submenu === menuItemId;
        }
      });
      if (idx >= 0) {
        array.splice(idx, 1);
        this._onDidChangeMenu.fire(menuId);
      }
    }
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

    return Disposable.create(() => {
      const deleted = this._disabledMenuIds.delete(menuId);
      if (deleted) {
        this._onDidChangeMenu.fire(menuId);
      }
    });
  }

  getMenuItems(id: MenuId | string): Array<IMenuItem | ISubmenuItem | IComponentMenuItem> {
    // 将 disable 掉的 MenuId 返回为空
    if (this._disabledMenuIds.has(id)) {
      return [];
    }

    const result = (this._menuItems.get(id) || []).slice(0).reduce((prev, cur) => {
      if (isIComponentMenuItem(cur)) {
        // 目前只支持 `EditorTitle` 开放 `ComponentMenuItem`
        if (CoreMenuRegistryImpl.EnableComponentMenuIds.includes(id)) {
          prev.push({
            ...cur,
            group: 'navigation',
          });
        }
      } else {
        prev.push(cur);
      }

      return prev;
    }, [] as Array<IMenuItem | ISubmenuItem | IComponentMenuItem>);

    if (id === MenuId.CommandPalette) {
      // CommandPalette 特殊处理, 默认展示所有的 command
      // CommandPalette 负责添加 when 条件
      this.appendImplicitMenuItems(result);
    }

    if (this._menuExtendInfo.has(id)) {
      return this.convertToMenuExtendInfo(this._menuExtendInfo.get(id)!, result);
    }

    return result;
  }

  getMenuCommand(command: string | MenuCommandDesc) {
    if (typeof command === 'string') {
      return { id: command };
    }

    return command;
  }

  private appendImplicitMenuItems(result: Array<IMenuItem | ISubmenuItem | IComponentMenuItem>) {
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

  private convertToMenuExtendInfo(
    extendInfoArr: ISumiMenuExtendInfo[],
    result: Array<IMenuItem | ISubmenuItem | IComponentMenuItem>,
  ) {
    return result.map((menuItem) => {
      if (!isIMenuItem(menuItem)) {
        return menuItem;
      }

      const { command } = menuItem;
      const info = extendInfoArr.find((item) => item.command === command);

      return info ? { ...menuItem, ...info } : menuItem;
    });
  }
}

@Injectable()
export class MenuRegistryImpl extends CoreMenuRegistryImpl {
  @Autowired(MenuContribution)
  protected readonly contributions: ContributionProvider<MenuContribution>;

  // MenuContribution
  initialize() {
    for (const contrib of this.contributions.getContributions()) {
      if (contrib.registerNextMenus) {
        contrib.registerNextMenus(this);
        warning(false, '`registerNextMenus` was deprecated in favor of `registerMenus`');
      }
      contrib.registerMenus && contrib.registerMenus(this);
    }
  }
}

export function isIMenuItem(item: IMenuItem | ISubmenuItem | IInternalComponentMenuItem): item is IMenuItem {
  return (item as IMenuItem).command !== undefined;
}

export function isISubmenuItem(item: IMenuItem | ISubmenuItem | IInternalComponentMenuItem): item is ISubmenuItem {
  return (item as ISubmenuItem).submenu !== undefined;
}

export function isIComponentMenuItem(
  item: IMenuItem | ISubmenuItem | IInternalComponentMenuItem,
): item is IInternalComponentMenuItem {
  return ReactIs.isValidElementType((item as IInternalComponentMenuItem).component);
}

/**
 * 这里的 MenuAction 的展示类型拓展为支持 Button 组件的类型以及 checkbox
 * 由于 Comment 模块的默认用的 Menu 的展示类型为 Button 类型
 * 同时从设计角度更完善的展示 checked 属性，额外拓展了 checkbox 类型
 * 用在 button 类型时 checked 状态的展示
 */
export type IMenuActionDisplayType = ButtonType | 'checkbox';

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
  /**
   * menu 子项最右侧的额外描述信息
   */
  extraDesc?: string;
}

/**
 * base 类
 */
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
  extraDesc: string;
  children: MenuNode[];
  type?: IMenuActionDisplayType;
  protected _actionCallback?: (...args: any[]) => any;

  constructor(props: IMenuAction) {
    this.id = props.id;
    this.label = replaceLocalizePlaceholder(props.label)!;
    this.className = props.className || '';
    this.icon = props.icon || '';
    this.keybinding = props.keybinding || '';
    this.rawKeybinding = props.rawKeybinding || '';
    this.isKeyCombination = Boolean(props.isKeyCombination);
    this.disabled = Boolean(props.disabled);
    this.checked = Boolean(props.checked);
    this.nativeRole = props.nativeRole || '';
    this.type = props.type;
    this.extraDesc = props.extraDesc || '';
    this._actionCallback = props.execute;
  }

  getExecuteArgs(...args: any[]): any[] {
    return args;
  }

  execute(...args: any[]): any {
    const runArgs = this.getExecuteArgs(args);
    if (this._actionCallback) {
      return this._actionCallback(...runArgs);
    }

    return Promise.resolve(true);
  }
}

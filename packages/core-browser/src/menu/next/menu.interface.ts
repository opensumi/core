import { Autowired, Injectable, Optional } from '@opensumi/di';
import { CommandRegistry, CommandService, Command, isOSX } from '@opensumi/ide-core-common';
import { IDisposable } from '@opensumi/ide-core-common/lib/disposable';
import { Event } from '@opensumi/ide-core-common/lib/event';

import { IContextKeyService } from '../../context-key';
import { KeybindingRegistry } from '../../keybinding';

import { ISubmenuItem, MenuNode, IMenuActionDisplayType, IComponentMenuItem, IComponentMenuItemProps } from './base';
import { MenuId } from './menu-id';
import { ICtxMenuRenderer } from './renderer/ctxmenu/base';

export type TupleMenuNodeResult = [MenuNode[], MenuNode[]];

export interface IMenuNodeOptions {
  /**
   * 固定参数可从这里传入
   */
  args?: any[];
  contextDom?: HTMLElement;
}

export type IMenuSeparator = 'navigation' | 'inline';

export interface IMenuConfig extends IMenuNodeOptions {
  separator?: IMenuSeparator;
  withAlt?: boolean; // 尚未支持
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
    @Optional() icon: string | undefined,
    @Optional() options: IMenuNodeOptions = {},
    @Optional() disabled: boolean,
    @Optional() checked: boolean,
    @Optional() type?: IMenuActionDisplayType,
    @Optional() nativeRole?: string,
    @Optional() extraDesc?: string,
    @Optional() private extraTailArgs?: any[],
    @Optional() private argsTransformer?: (...args: any[]) => any[],
  ) {
    super({
      id: item.id,
      icon,
      label: item.label!,
      type,
      checked,
      disabled,
      nativeRole,
      extraDesc,
    });

    this.className = undefined;

    const shortcutDesc = this.getShortcut(item.id);

    this.keybinding = (shortcutDesc && shortcutDesc.keybinding) || '';
    this.rawKeybinding = (shortcutDesc && shortcutDesc.rawKeybinding) || '';
    this.isKeyCombination = !!(shortcutDesc && shortcutDesc.isKeyCombination);
    this._options = options;

    this.item = item;
  }

  getExecuteArgs(args: any[] = []): any[] {
    let runArgs = [...(this._options.args || []), ...(args || []), ...(this.extraTailArgs || [])];
    // args 为 createMenu 时提供，同一个 menu 所有的都是同一 args
    // argsTransformer 每个 action 不同，所以先合并 args，然后再经过 transformer
    if (this.argsTransformer) {
      runArgs = this.argsTransformer(...runArgs);
    }

    return runArgs;
  }

  execute(args: any[] = []): Promise<any> {
    return this.commandService.executeCommand(this.item.id, ...this.getExecuteArgs(args));
  }

  private getShortcut(commandId: string) {
    if (commandId) {
      const keybindings = this.keybindings.getKeybindingsForCommand(commandId);
      if (keybindings.length > 0) {
        // 取 priority 最高的 keybinding 作展示
        const highPriorityKeybinding = keybindings.reduce((a, b) => ((a.priority || 0) > (b.priority || 0) ? a : b));

        const isKeyCombination =
          Array.isArray(highPriorityKeybinding.resolved) && highPriorityKeybinding.resolved.length > 1;
        let keybinding = this.keybindings.acceleratorFor(highPriorityKeybinding, isOSX ? '' : '+').join(' ');
        if (isKeyCombination) {
          keybinding = `[${keybinding}]`;
        }
        return {
          keybinding,
          rawKeybinding: highPriorityKeybinding.keybinding,
          isKeyCombination,
        };
      }
    }
    return null;
  }
}

@Injectable({ multiple: true })
export class SubmenuItemNode extends MenuNode {
  static readonly ID = 'menu.item.node.submenu';

  @Autowired(ICtxMenuRenderer)
  protected readonly ctxMenuRenderer: ICtxMenuRenderer;

  readonly item: ISubmenuItem;
  readonly submenuId: string;
  readonly icon: string;

  constructor(@Optional() item: ISubmenuItem) {
    super({
      id: SubmenuItemNode.ID,
      label: item.label!,
      type: item.type,
    });
    this.submenuId = item.submenu;
    this.icon = item.iconClass!;
    this.item = item;
  }

  // 支持 submenu 点击展开
  execute(args: any[]): void {
    const [anchor, ...restArgs] = args;
    if (!anchor) {
      return;
    }

    this.ctxMenuRenderer.show({
      anchor,
      menuNodes: this.children || this.submenuId,
      args: restArgs,
    });
  }
}

@Injectable({ multiple: true })
export class ComponentMenuItemNode extends MenuNode {
  static readonly ID = 'menu.item.node.component';
  static nodeIndex = -1;

  readonly item: IComponentMenuItem;
  private _options: IMenuNodeOptions;
  readonly component: React.ComponentType<IComponentMenuItemProps>;
  readonly nodeId: string;

  constructor(
    @Optional() item: IComponentMenuItem,
    @Optional() options: IMenuNodeOptions = {},
    @Optional() private extraTailArgs?: any[],
    @Optional() private argsTransformer?: (...args: any[]) => any[],
  ) {
    super({
      id: ComponentMenuItemNode.ID,
      label: '',
    });
    ComponentMenuItemNode.nodeIndex++;
    this.nodeId = String(ComponentMenuItemNode.nodeIndex);
    this.item = item;
    this.component = item.component;
    this._options = options;
  }

  getExecuteArgs(args: any[] = []): any[] {
    let runArgs = [...(this._options.args || []), ...(args || []), ...(this.extraTailArgs || [])];
    // args 为 createMenu 时提供，同一个 menu 所有的都是同一 args
    // argsTransformer 每个 action 不同，所以先合并 args，然后再经过 transformer
    if (this.argsTransformer) {
      runArgs = this.argsTransformer(...runArgs);
    }

    return runArgs;
  }
}

// 分隔符
export class SeparatorMenuItemNode extends MenuNode {
  static readonly ID = 'menu.item.node.separator';

  constructor(id?: string, label?: string) {
    super({
      id: id || SeparatorMenuItemNode.ID,
      label: label || 'separator',
    });
  }
}

export interface IMenu extends IDisposable {
  /**
   * menu-id
   */
  menuId: string | MenuId;
  readonly onDidChange: Event<IMenu | undefined>;
  getMenuNodes(
    options?: IMenuNodeOptions,
  ): Array<[string, Array<MenuItemNode | SubmenuItemNode | ComponentMenuItemNode>]>;
  onDispose: Event<void>;
}

export function isIMenu(menus: IMenu | IContextMenu): menus is IMenu {
  return 'getMenuNodes' in menus && typeof menus.getMenuNodes === 'function';
}

export interface IContextMenu extends IDisposable {
  /**
   * menu-id
   */
  menuId: string | MenuId;
  /**
   * menu 重新生成后事件，监听即可拿到最新的 menu
   */
  readonly onDidChange: Event<string>;

  /**
   * 获得已分好组并合并的 MenuNodes 列表
   */
  getMergedMenuNodes(): MenuNode[];

  /**
   * 获得已分好组的 MenuNodes 列表
   */
  getGroupedMenuNodes(): TupleMenuNodeResult;
}

export abstract class AbstractMenuService {
  public abstract createMenu(id: MenuId | string, contextKeyService?: IContextKeyService): IMenu;
}

export interface CreateMenuPayload {
  id: MenuId | string;
  config?: IMenuConfig;
  contextKeyService?: IContextKeyService;
}

export abstract class AbstractContextMenuService {
  public abstract createMenu(payload: CreateMenuPayload): IContextMenu;
}

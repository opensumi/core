import { CommandRegistry, CommandService, Command, isOSX } from '@ali/ide-core-common';
import { IDisposable } from '@ali/ide-core-common/lib/disposable';
import { Event } from '@ali/ide-core-common/lib/event';
import { Autowired, Injectable, Optional } from '@ali/common-di';

import { IContextKeyService } from '../../context-key';
import { ISubmenuItem, MenuNode } from './base';
import { MenuId } from './menu-id';
import { KeybindingRegistry } from '../../keybinding';
import { ICtxMenuRenderer } from './renderer/ctxmenu/base';

export type TupleMenuNodeResult = [ MenuNode[], MenuNode[] ];

export interface IMenuNodeOptions {
  args?: any[]; // 固定参数可从这里传入
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
    @Optional() options: IMenuNodeOptions = {},
    @Optional() disabled: boolean,
    @Optional() checked: boolean,
    @Optional() nativeRole?: string,
  ) {
    super({
      id: item.id,
      icon: item.iconClass,
      label: item.label!,
      checked,
      disabled,
      nativeRole,
    });

    this.className = undefined;

    const shortcutDesc = this.getShortcut(item.id);

    this.keybinding = shortcutDesc && shortcutDesc.keybinding || '';
    this.rawKeybinding = shortcutDesc && shortcutDesc.rawKeybinding || '';
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
    });
    this.submenuId = item.submenu;
    this.icon = item.iconClass!;
    this.item = item;
  }

  // 支持 submenu 点击展开
  execute(...args: any[]): void {
    const [anchor, ...restArgs] = args;
    if (!anchor) {
      return;
    }

    this.ctxMenuRenderer.show({
      anchor,
      menuNodes: this.children,
      args: restArgs,
    });
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
  readonly onDidChange: Event<IMenu | undefined>;
  getMenuNodes(options?: IMenuNodeOptions): Array<[string, Array<MenuItemNode | SubmenuItemNode>]>;
}

export interface IContextMenu extends IDisposable {
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
  abstract createMenu(id: MenuId | string, contextKeyService?: IContextKeyService): IMenu;
}

export interface CreateMenuPayload {
  id: MenuId | string;
  config?: IMenuConfig;
  contextKeyService?: IContextKeyService;
}

export abstract class AbstractContextMenuService {
  abstract createMenu(payload: CreateMenuPayload): IContextMenu;
}

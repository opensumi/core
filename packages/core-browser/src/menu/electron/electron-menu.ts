import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ContextMenuRenderer } from '../context-menu-renderer';
import { MenuPath, MenuModelRegistry, CompositeMenuNode, MenuNode, INativeMenuTemplate, ActionMenuNode, CommandService, IElectronMainMenuService, IDisposable, getLogger, WithEventBus, OnEvent, CommandRegistry} from '@ali/ide-core-common';
import { IElectronMenuFactory } from '.';
import { electronEnv } from '../../utils/electron';
import { IContextKeyService, ContextKeyChangeEvent } from '../../context-key';
import { KeybindingRegistry, ScopedKeybinding } from '../../keybinding';

@Injectable()
export class ElectronContextMenuRenderer implements ContextMenuRenderer {

    @Autowired(INJECTOR_TOKEN)
    private readonly injector: Injector;

    render(menuPath: MenuPath, args: any, onHide?: () => void): void {
      this.injector.get(IElectronMenuFactory).createContextMenu(menuPath, args, onHide);
    }

}

@Injectable()
export class ElectronMenuFactory extends WithEventBus implements IElectronMenuFactory {

  @Autowired(MenuModelRegistry)
  private readonly menuProvider: MenuModelRegistry;

  private contextMenuActions = new Map<string, () => void>();

  private applicationMenuActions = new Map<string, () => void>();

  @Autowired(CommandService) protected readonly commandService: CommandService;

  @Autowired(CommandRegistry) protected readonly commandRegistry: CommandRegistry;

  @Autowired(IElectronMainMenuService)
  private electronMainMenuService: IElectronMainMenuService;

  @Autowired(KeybindingRegistry)
  private keybindingRegistry: KeybindingRegistry;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  private id = 0;
  disposeApplicationMenu: IDisposable;

  private currentApplicationMenuPathContextKeys: Set<string> = new Set();

  private currentApplicationMenuPathCommands: Set<string> = new Set();

  private currentApplicationMenuPath: MenuPath | undefined;

  @OnEvent(ContextKeyChangeEvent)
  onContextKeyChangeEvent(e: ContextKeyChangeEvent) {
    if (this.currentApplicationMenuPath && e.payload.affectsSome(this.currentApplicationMenuPathContextKeys)) {
      this.setApplicationMenu(this.currentApplicationMenuPath);
    }
  }

  constructor() {
    super();
    this.keybindingRegistry.onKeybindingsChanged(({affectsCommands}) => {
      if (this.currentApplicationMenuPath) {
        for (const c of affectsCommands) {
          if (this.currentApplicationMenuPathCommands.has(c)) {
            this.setApplicationMenu(this.currentApplicationMenuPath);
            return;
          }
        }
      }
    });
  }

  createContextMenu(menuPath: MenuPath, args: any, onHide?: () => void) {
    const menuModel = this.menuProvider.getMenu(menuPath);
    const node = new CompositeMenuNode('contextMenu-' + this.id++, 'Context Menu' );
    menuModel.children.forEach((c) => {
      node.addNode(c);
    });

    // bind actions in this context
    this.contextMenuActions.clear();
    this.bindActions(node, args, this.contextMenuActions);

    const template = this.getTemplate(node) as INativeMenuTemplate;
    this.createNativeContextMenu(template, onHide);
  }

  setApplicationMenu(menuPath: MenuPath) {
    const menuModel = this.menuProvider.getMenu(menuPath);
    const node = new CompositeMenuNode('ApplicationMenu-' + this.id++, 'Application Menu' );
    menuModel.children.forEach((c) => {
      node.addNode(c);
    });
    this.currentApplicationMenuPath = menuPath;

    // record contextKey that affects
    this.currentApplicationMenuPathContextKeys.clear();
    this.currentApplicationMenuPathCommands.clear();
    this.updateApplicationMenuContextKeys(node);
    // bind actions in this context
    if (this.disposeApplicationMenu) {
      this.disposeApplicationMenu.dispose();
    }
    this.bindActions(node, null, this.applicationMenuActions); // 顶部菜单的args?

    const template = this.getTemplate(node) as INativeMenuTemplate;
    this.setNativeApplicationMenu(template);
  }

  private updateApplicationMenuContextKeys(menu: MenuNode) {
    if (menu instanceof ActionMenuNode) {
      if (menu.enableWhen) {
        try {
          this.contextKeyService.getKeysInWhen(menu.enableWhen).forEach((key) => {
            this.currentApplicationMenuPathContextKeys.add(key);
          });
        } catch (e) {
          getLogger().error(e);
        }
      }
      if (menu.visibleWhen) {
        try {
          this.contextKeyService.getKeysInWhen(menu.visibleWhen).forEach((key) => {
            this.currentApplicationMenuPathContextKeys.add(key);
          });
        } catch (e) {
          getLogger().error(e);
        }
      }
      if (menu.action && menu.action.commandId) {
        this.currentApplicationMenuPathCommands.add(menu.action.commandId);
      }
    } else if (menu instanceof CompositeMenuNode) {
      menu.children.forEach((m) => {
        this.updateApplicationMenuContextKeys(m);
      });
    }
  }

  createNativeContextMenu(template: INativeMenuTemplate, onHide?: () => void) {
    this.electronMainMenuService.showContextMenu(template, electronEnv.currentWebContentsId);
    if (onHide) {
      const disposer = this.electronMainMenuService.on('menuClose', (targetId, contextMenuId) => {
        if (targetId !== electronEnv.currentWebContentsId + '-context') {
          return;
        }
        if (contextMenuId === template.id) {
          disposer.dispose();
          onHide();
        }
      });
    }
    const disposer = this.electronMainMenuService.on('menuClick', (targetId, menuId) => {
      if (targetId !== electronEnv.currentWebContentsId + '-context') {
        return;
      }
      const action = this.contextMenuActions.get(menuId);
      if (action) {
        action();
      }
      disposer.dispose();
    });

  }

  setNativeApplicationMenu(template: INativeMenuTemplate) {
    this.electronMainMenuService.setApplicationMenu(template, electronEnv.currentWindowId);
    const disposer = this.electronMainMenuService.on('menuClick', (targetId, menuId) => {
      if (targetId !== electronEnv.currentWindowId + '-app') {
        return;
      }
      const action = this.applicationMenuActions.get(menuId);
      if (action) {
        action();
      }
    });
    this.disposeApplicationMenu = {
      dispose: () => {
        disposer.dispose();
        this.applicationMenuActions.clear();
      },
    };

  }

  bindActions(menu: MenuNode, args: any, map: Map<string, () => void>) {
    if (menu instanceof ActionMenuNode) {
      if (menu.action.commandId) {
        map.set(menu.id, () => this.commandService.executeCommand(menu.action.commandId!, args));
      }
    } else if (menu instanceof CompositeMenuNode) {
      menu.children.forEach((m) => {
        this.bindActions(m, args, map);
      });
    }
  }

  getTemplate(menuModel: MenuNode): INativeMenuTemplate | INativeMenuTemplate[] | undefined {
    if (menuModel instanceof CompositeMenuNode) {
      if (menuModel.when) {
        if (!this.contextKeyService.match(menuModel.when)) {
          return undefined;
        }
      }
      if (menuModel.isSubmenu) {
        return {
          label: menuModel.label,
          id: menuModel.id,
          submenu: this.getSubmenu(menuModel.children),
        };
      } else {
        return [
          {
            type: 'separator',
          },
          ...this.getSubmenu(menuModel.children),
        ];
      }
    } else if (menuModel instanceof ActionMenuNode) {
      if (menuModel.visibleWhen && !this.contextKeyService.match(menuModel.visibleWhen)) {
        return;
      }
      if (this.commandRegistry.getCommand(menuModel.action.commandId) && !this.commandRegistry.isVisible(menuModel.action.commandId)) {
        return;
      }
      const keybindings = this.keybindingRegistry.getKeybindingsForCommand(menuModel.action.commandId);
      const keybinding: ScopedKeybinding | null = keybindings.length > 0 ? keybindings[0] : null;
      return {
        label: menuModel.label + toCombinedKeyBindingLabel(keybinding),
        id: menuModel.id,
        action: true,
        role: menuModel.nativeRole,
        disabled: menuModel.enableWhen ? !this.contextKeyService.match(menuModel.enableWhen) : false,
        accelerator: keybinding && keybinding.keybinding.indexOf(' ') === -1 ? toElectronAccelerator(keybinding.keybinding) : undefined,
      };
    }
    // TODO disabled, enabled等
  }

  getSubmenu(menuModels: readonly MenuNode[]): INativeMenuTemplate[] {
    const result: INativeMenuTemplate[] = [];
    menuModels.forEach((m, i) => {

      const template = this.getTemplate(m);
      if (template instanceof Array) {
        result.push(...template);
      } else if (template != null) {
        result.push(template);
      }
    });
    return result.filter((r) => !!r);
  }

}

function toElectronAccelerator(keybinding: string) {
  return keybinding.replace('ctrlcmd', 'CmdOrCtrl');
}

function toCombinedKeyBindingLabel(keybinding): string {
  if (!keybinding || keybinding.keybinding.indexOf(' ') === -1) {
    return '';
  } else {
    return ''; // TODO 展示组合键
  }
}

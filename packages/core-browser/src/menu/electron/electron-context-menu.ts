import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ContextMenuRenderer } from '../context-menu-renderer';
import { MenuPath, MenuModelRegistry, CompositeMenuNode, MenuNode, INativeMenuTemplate, ActionMenuNode, CommandService, IElectronMainMenuService} from '@ali/ide-core-common';

@Injectable()
export class ElectronContextMenuRenderer implements ContextMenuRenderer {

    @Autowired(INJECTOR_TOKEN)
    private readonly injector: Injector;

    render(menuPath: MenuPath, args: any, onHide?: () => void): void {
      this.injector.get(ElectronContextMenuFactory).createContextMenu(menuPath, args, onHide);
    }

}

@Injectable()
export class ElectronContextMenuFactory {

  @Autowired(MenuModelRegistry)
  private readonly menuProvider: MenuModelRegistry;

  private contextMenuActions = new Map<string, () => void>();

  @Autowired(CommandService) protected readonly commandService: CommandService;

  @Autowired(IElectronMainMenuService)
  private electronMainMenuService: IElectronMainMenuService;

  private id = 0;

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

  createNativeContextMenu(template: INativeMenuTemplate, onHide?: () => void) {
    this.electronMainMenuService.showContextMenu(template, currentWebContentsId);
    if (onHide) {
      const disposer = this.electronMainMenuService.on('menuClose', (webContentsId, contextMenuId) => {
        if (webContentsId !== currentWebContentsId) {
          return;
        }
        if (contextMenuId === template.id) {
          disposer.dispose();
          onHide();
        }
      });
    }
    const disposer = this.electronMainMenuService.on('menuClick', (webContentsId, menuId) => {
      if (webContentsId !== currentWebContentsId) {
        return;
      }
      const action = this.contextMenuActions.get(menuId);
      if (action) {
        action();
      }
      disposer.dispose();
    });

  }

  bindActions(menu: MenuNode, args: any, map: Map<string, () => void>) {
    if (menu instanceof ActionMenuNode) {
      map.set(menu.id, () => this.commandService.executeCommand(menu.action.commandId, args));
    } else if (menu instanceof CompositeMenuNode) {
      menu.children.forEach((m) => {
        this.bindActions(m, args, map);
      });
    }
  }

  getTemplate(menuModel: MenuNode): INativeMenuTemplate | INativeMenuTemplate[] | undefined {
    if (menuModel instanceof CompositeMenuNode) {
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
      return {
        label: menuModel.label,
        id: menuModel.id,
        action: true,
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

import { NextMenuContribution, IMenuRegistry, AbstractMenuService, ICtxMenuRenderer, IMenu, generateMergedCtxMenu } from '@ali/ide-core-browser/lib/menu/next';
import { Autowired } from '@ali/common-di';
import { Domain, CommandContribution, CommandRegistry, localize, memoize, TreeNode, IQuickInputService, IContextKeyService } from '@ali/ide-core-browser';
import { DebugVariableService } from './debug-variable.service';

export enum MenuId {
  variable = 'debugger.variable',
}

export enum Commands {
  setValue = 'debugger:setValue',
}

@Domain(NextMenuContribution, CommandContribution)
export class VariablesPanelContribution implements NextMenuContribution, CommandContribution {
  @Autowired(IQuickInputService)
  quickInputService: IQuickInputService;

  @Autowired(DebugVariableService)
  service: DebugVariableService;

  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  constructor() {
    this.service.onVariableContextMenu(({ nodes, event }) => {
      this.onContextMenu(nodes, event);
    });
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand({ id: Commands.setValue }, {
      execute: async (nodes: TreeNode[]) => {
        const param = await this.quickInputService.open({
          placeHolder: localize('deugger.menu.setValue.param'),
          value: nodes[0].description as string,
        });
        if (param !== undefined && param !== null) {
          this.service.setNodesValue(nodes, param);
        }
      },
    });
  }

  registerNextMenus(registry: IMenuRegistry) {
    registry.registerMenuItem(MenuId.variable, {
      command: {
        id: Commands.setValue,
        label: localize('deugger.menu.setValue'),
      },
      order: 1,
    });
  }

  @memoize get contextMenu(): IMenu {
    const contributedContextMenu = this.menuService.createMenu(MenuId.variable, this.contextKeyService);
    return contributedContextMenu;
  }

  onContextMenu(nodes: TreeNode[], event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();

    const { x, y } = event.nativeEvent;
    const menus = this.contextMenu;
    const menuNodes = generateMergedCtxMenu({ menus });

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [nodes],
    });
  }
}

import { Injectable, Autowired } from '@ali/common-di';
import { Disposable, Domain, CommandContribution, CommandRegistry } from '@ali/ide-core-common';
import { AbstractMenuService, IMenu, ICtxMenuRenderer, NextMenuContribution, IMenuRegistry, generateCtxMenu } from '@ali/ide-core-browser/lib/menu/next';
import { memoize, IContextKeyService, localize } from '@ali/ide-core-browser';
import { ITerminalController } from '../common';
import { TerminalClient } from './terminal.client';

export enum MenuId {
  TermTab = 'TermTab',
  TermPanel = 'TermPanel',
}

export enum SimpleCommonds {
  search = 'terminal:search',
  split = 'terminal:split',
  selectAll = 'terminal:selectAll',
  copy = 'terminal:copy',
  paste = 'terminal:paste',
  clear = 'terminal:clear',
  stop = 'terminal:stop',
}

export const group = 'panel_menu';

@Domain(NextMenuContribution, CommandContribution)
export class TerminalMenuContribution implements NextMenuContribution, CommandContribution {

  @Autowired(ITerminalController)
  terminalController: ITerminalController;

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand({ id: SimpleCommonds.search }, {
      execute: async () => {
        this.terminalController.openSearchInput();
      },
    });

    registry.registerCommand({ id: SimpleCommonds.split }, {
      execute: async () => {
        this.terminalController.addWidget();
      },
    });

    registry.registerCommand({ id: SimpleCommonds.selectAll }, {
      execute: async () => {
        const client = this.terminalController.getCurrentClient() as TerminalClient;
        if (client) {
          client.selectAll();
        }
      },
    });

    registry.registerCommand({ id: SimpleCommonds.copy }, {
      execute: async () => {
        const client = this.terminalController.getCurrentClient() as TerminalClient;
        if (client) {
          client.copy();
        }
      },
    });

    registry.registerCommand({ id: SimpleCommonds.clear }, {
      execute: async () => {
        const client = this.terminalController.getCurrentClient() as TerminalClient;
        if (client) {
          client.clear();
        }
      },
    });

    registry.registerCommand({ id: SimpleCommonds.stop }, {
      execute: async () => {
        this.terminalController.removeFocused();
      },
    });
  }

  registerNextMenus(menuRegistry: IMenuRegistry) {
    menuRegistry.registerMenuItem(MenuId.TermPanel, {
      command: {
        id: SimpleCommonds.search,
        label: localize('terminal.menu.search'),
      },
      order: 1,
      group,
    });

    menuRegistry.registerMenuItem(MenuId.TermPanel, {
      command: {
        id: SimpleCommonds.split,
        label: localize('terminal.menu.split'),
      },
      order: 2,
      group,
    });

    menuRegistry.registerMenuItem(MenuId.TermPanel, {
      command: {
        id: SimpleCommonds.selectAll,
        label: localize('terminal.menu.selectAll'),
      },
      order: 3,
      group,
    });

    menuRegistry.registerMenuItem(MenuId.TermPanel, {
      command: {
        id: SimpleCommonds.copy,
        label: localize('terminal.menu.copy'),
      },
      order: 4,
      group,
    });

    menuRegistry.registerMenuItem(MenuId.TermPanel, {
      command: {
        id: SimpleCommonds.clear,
        label: localize('terminal.menu.clear'),
      },
      order: 6,
      group,
    });

    menuRegistry.registerMenuItem(MenuId.TermPanel, {
      command: {
        id: SimpleCommonds.stop,
        label: localize('terminal.menu.stop'),
      },
      order: 7,
      group,
    });
  }
}

@Injectable()
export class TerminalContextMenuService extends Disposable {
  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @memoize get contextMenu(): IMenu {
    const contributedContextMenu = this.menuService.createMenu(MenuId.TermPanel, this.contextKeyService);
    this.addDispose(contributedContextMenu);
    return contributedContextMenu;
  }

  onContextMenu(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();

    const { x, y } = event.nativeEvent;
    const menus = this.contextMenu;
    const result = generateCtxMenu({ menus });

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      // 合并结果
      menuNodes: [...result[0], ...result[1]],
      context: [ 'some args for command executor' ],
    });
  }
}

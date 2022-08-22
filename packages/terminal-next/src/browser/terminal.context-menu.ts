import { Injectable, Autowired } from '@opensumi/di';
import { memoize, IContextKeyService } from '@opensumi/ide-core-browser';
import {
  AbstractMenuService,
  IMenu,
  ICtxMenuRenderer,
  generateMergedCtxMenu,
  MenuId,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { Disposable } from '@opensumi/ide-core-common';

import { ITerminalController } from '../common';

@Injectable()
export class TerminalContextMenuService extends Disposable {
  @Autowired(ITerminalController)
  protected readonly controller: ITerminalController;

  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @memoize get contextMenu(): IMenu {
    const contributedContextMenu = this.menuService.createMenu(
      MenuId.TerminalPanelContext,
      this.controller.contextKeyService || this.contextKeyService,
    );
    this.addDispose(contributedContextMenu);
    return contributedContextMenu;
  }

  onContextMenu(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();

    const { x, y } = event.nativeEvent;
    const menus = this.contextMenu;
    const menuNodes = generateMergedCtxMenu({ menus });

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [],
    });
  }

  @memoize get tabContextMenu(): IMenu {
    const contributedContextMenu = this.menuService.createMenu(MenuId.TerminalTabContext, this.contextKeyService);
    this.addDispose(contributedContextMenu);
    return contributedContextMenu;
  }

  @memoize get tabDropDownContextMenu(): IMenu {
    const contributedContextMenu = this.menuService.createMenu(
      MenuId.TerminalNewDropdownContext,
      this.contextKeyService,
    );
    this.addDispose(contributedContextMenu);
    return contributedContextMenu;
  }

  onDropDownContextMenu(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();

    const { x, y } = event.nativeEvent;
    const menus = this.tabDropDownContextMenu;
    const menuNodes = generateMergedCtxMenu({ menus });

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [event.target],
    });
  }

  onTabContextMenu(event: React.MouseEvent<HTMLElement>, index: number) {
    event.stopPropagation();
    event.preventDefault();

    const { x, y } = event.nativeEvent;
    const menus = this.tabContextMenu;
    const menuNodes = generateMergedCtxMenu({ menus });

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [event.target, index],
    });
  }
}

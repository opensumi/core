import omit from 'lodash.omit';

import { Injectable, Autowired } from '@opensumi/di';

import { MenuNode } from '../../base';
import { AbstractContextMenuService } from '../../menu.interface';

import { ICtxMenuRenderer, CtxMenuRenderParams } from './base';

export abstract class IBrowserCtxMenu extends ICtxMenuRenderer {
  visible: boolean;
  onHide: ((canceled: boolean) => void) | undefined;
  point?: {
    pageX: number;
    pageY: number;
  };
  context: any;
  menuNodes: MenuNode[];
  abstract hide(canceled: boolean): void;
}

@Injectable()
export class BrowserCtxMenuRenderer implements ICtxMenuRenderer {
  @Autowired(IBrowserCtxMenu)
  protected readonly browserCtxMenu: IBrowserCtxMenu;

  @Autowired(AbstractContextMenuService)
  private readonly menuService: AbstractContextMenuService;

  public show(payload: CtxMenuRenderParams): void {
    if (typeof payload.menuNodes === 'string') {
      const menus = this.menuService.createMenu({
        id: payload.menuNodes,
        config: {
          args: payload.args,
        },
        contextKeyService: payload.contextKeyService,
      });
      payload.menuNodes = menus.getMergedMenuNodes();
      menus.dispose();
    }

    this.browserCtxMenu.show(omit(payload, ['contextKeyService']));
  }
}

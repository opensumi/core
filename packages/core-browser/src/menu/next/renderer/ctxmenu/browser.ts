import { Injectable, Autowired } from '@ali/common-di';
import * as omit from 'lodash.omit';

import { MenuNode } from '../../base';
import { ICtxMenuRenderer, CtxMenuRenderParams } from './base';
import { AbstractMenuService } from '../../menu-service';
import { generateMergedCtxMenu } from '../../menu-util';

export abstract class IBrowserCtxMenu extends ICtxMenuRenderer {
  visible: boolean;
  onHide: (() => void) | undefined;
  point?: {
    pageX: number;
    pageY: number;
  };
  context: any;
  menuNodes: MenuNode[];
  abstract hide(): void;
}

@Injectable()
export class BrowserCtxMenuRenderer implements ICtxMenuRenderer {
  @Autowired(IBrowserCtxMenu)
  protected readonly browserCtxMenu: IBrowserCtxMenu;

  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  public show(payload: CtxMenuRenderParams): void {
    if (typeof payload.menuNodes === 'string') {
      const menus = this.menuService.createMenu(payload.menuNodes, payload.contextKeyService);
      payload.menuNodes = generateMergedCtxMenu({ menus });
      menus.dispose();
    }

    this.browserCtxMenu.show(omit(payload, ['contextKeyService']));
  }
}

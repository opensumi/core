import { Injectable, Autowired } from '@ali/common-di';

import { MenuNode } from '../../base';
import { ICtxMenuRenderer, CtxMenuRenderParams } from './base';

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

  public show(payload: CtxMenuRenderParams): void {
    this.browserCtxMenu.show(payload);
  }
}

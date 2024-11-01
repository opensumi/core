import omit from 'lodash/omit';

import { Autowired, Injectable } from '@opensumi/di';
import { IObservable } from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/base';

import { MenuNode } from '../../base';
import { AbstractContextMenuService } from '../../menu.interface';

import { CtxMenuRenderParams, ICtxMenuRenderer } from './base';

export interface IMenuRenderProps {
  disabled?: boolean;
  hasSubmenu?: boolean;
}

export abstract class IBrowserCtxMenu extends ICtxMenuRenderer {
  visible: boolean;
  visibleObservable: IObservable<boolean>;

  onHide: ((canceled: boolean) => void) | undefined;
  point?: {
    pageX: number;
    pageY: number;
  };
  context: any;
  menuNodes: MenuNode[];
  abstract hide(canceled: boolean): void;
  renderSubMenuTitle?: (node: MenuNode, props: IMenuRenderProps) => React.ReactNode | undefined | null;
  renderMenuItem?: (node: MenuNode, props: IMenuRenderProps) => React.ReactNode | undefined | null;
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

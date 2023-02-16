import { Injectable, Autowired } from '@opensumi/di';
import {
  AbstractContextMenuService,
  ICtxMenuRenderer,
  MenuId,
  IContextMenu,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { URI } from '@opensumi/ide-core-common';

import { EditorGroup } from '../workbench-editor.service';

@Injectable()
export class BreadCrumbsMenuService {
  @Autowired(AbstractContextMenuService)
  private readonly ctxMenuService: AbstractContextMenuService;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  private _groupContextKeyService;

  show(x: number, y: number, group: EditorGroup, domTarget: Element, uri?: URI) {
    let titleContext;
    if (!this._groupContextKeyService) {
      titleContext = group.contextKeyService.createScoped(domTarget);
    }
    const menus = this.ctxMenuService.createMenu({
      id: MenuId.BreadcrumbsTitleContext,
      contextKeyService: titleContext,
    });
    const menuNodes = menus.getMergedMenuNodes();
    menus.dispose();
    titleContext.dispose();

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [{ uri, group }],
    });
  }
}

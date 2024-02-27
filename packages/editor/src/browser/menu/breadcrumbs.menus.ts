import { Autowired, Injectable } from '@opensumi/di';
import { AbstractContextMenuService, ICtxMenuRenderer, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { URI } from '@opensumi/ide-core-common';

import { EditorGroup } from '../workbench-editor.service';

@Injectable()
export class BreadCrumbsMenuService {
  @Autowired(AbstractContextMenuService)
  private readonly ctxMenuService: AbstractContextMenuService;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  show(x: number, y: number, group: EditorGroup, uri: URI) {
    const titleContext = group.contextKeyService;
    const menus = this.ctxMenuService.createMenu({
      id: MenuId.BreadcrumbsTitleContext,
      contextKeyService: titleContext,
    });
    const menuNodes = menus.getMergedMenuNodes();

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [{ uri, group }],
    });
  }
}

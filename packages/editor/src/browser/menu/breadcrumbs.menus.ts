import { Injectable, Autowired } from '@opensumi/di';
import { ResourceContextKey } from '@opensumi/ide-core-browser/lib/contextkey/resource';
import { AbstractContextMenuService, ICtxMenuRenderer, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { URI } from '@opensumi/ide-core-common';

import { EditorGroup } from '../workbench-editor.service';

@Injectable()
export class BreadCrumbsMenuService {
  @Autowired(AbstractContextMenuService)
  private readonly ctxMenuService: AbstractContextMenuService;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  show(x: number, y: number, uri: URI, group: EditorGroup, domTarget) {
    // 设置resourceScheme
    const titleContext = group.contextKeyService.createScoped(domTarget);
    const resourceContext = new ResourceContextKey(titleContext);
    resourceContext.set(uri);

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

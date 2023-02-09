import { Injectable, Autowired } from '@opensumi/di';
import { IContextKeyService } from '@opensumi/ide-core-browser';
import { ResourceContextKey } from '@opensumi/ide-core-browser/lib/contextkey/resource';
import { AbstractContextMenuService, ICtxMenuRenderer, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { URI } from '@opensumi/ide-core-common';

import { IEditorGroup } from '../../common';
import { EditorGroup } from '../workbench-editor.service';

@Injectable()
export class BreadCrumbsMenuService {
  @Autowired(AbstractContextMenuService)
  ctxMenuService: AbstractContextMenuService;

  @Autowired(ICtxMenuRenderer)
  ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(IContextKeyService)
  contextKeyService: IContextKeyService;

  private _breadcrumbsTitleContextKey;

  private get breadcrumbsTitleContextKey() {
    if (!this._breadcrumbsTitleContextKey) {
      this._breadcrumbsTitleContextKey = this.contextKeyService.createKey('breadcrumbsTitleContext', false);
    }
    return this._breadcrumbsTitleContextKey;
  }

  show(x: number, y: number, uri: URI, group: IEditorGroup) {
    // 设置resourceScheme
    const titleContext = (group as EditorGroup).contextKeyService.createScoped();
    const resourceContext = new ResourceContextKey(titleContext);
    resourceContext.set(uri);
    this.breadcrumbsTitleContextKey.set(true);

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
      onHide: () => {
        this.breadcrumbsTitleContextKey.set(false);
      },
    });
  }
}

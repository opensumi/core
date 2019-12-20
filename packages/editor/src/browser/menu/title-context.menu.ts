import { Injectable, Autowired } from '@ali/common-di';
import { AbstractContextMenuService, ICtxMenuRenderer, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { URI } from '@ali/ide-core-common';
import { IEditorGroup } from '../../common';
import { EditorGroup } from '../workbench-editor.service';
import { ResourceContextKey } from '@ali/ide-core-browser/lib/contextkey/resource';

@Injectable()
export class TabTitleMenuService {

  @Autowired(AbstractContextMenuService)
  ctxMenuService: AbstractContextMenuService;

  @Autowired(ICtxMenuRenderer)
  ctxMenuRenderer: ICtxMenuRenderer;

  show(x: number, y: number, uri: URI, group: IEditorGroup) {
    // 设置resourceScheme
    const titleContext = (group as EditorGroup).contextKeyService.createScoped();
    const resourceContext = new ResourceContextKey(titleContext);
    resourceContext.set(uri);

    const menus = this.ctxMenuService.createMenu({
      id: MenuId.EditorTitleContext,
      contextKeyService: titleContext,
    });
    const menuNodes = menus.getMergedMenuNodes();
    menus.dispose();
    titleContext.dispose();

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [{uri, group}],
    });
  }

}

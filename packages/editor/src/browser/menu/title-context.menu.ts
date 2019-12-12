import { Injectable, Autowired } from '@ali/common-di';
import { AbstractMenuService, ICtxMenuRenderer, IMenu, MenuId, generateCtxMenu } from '@ali/ide-core-browser/lib/menu/next';
import { URI } from '@ali/ide-core-common';
import { IEditorGroup } from '../../common';
import { EditorGroup } from '../workbench-editor.service';
import { ResourceContextKey } from '@ali/ide-core-browser/lib/contextkey/resource';

@Injectable()
export class TabTitleMenuService {

  @Autowired(AbstractMenuService)
  menuService: AbstractMenuService;

  @Autowired(ICtxMenuRenderer)
  ctxMenuRenderer: ICtxMenuRenderer;

  show(x: number, y: number, uri: URI, group: IEditorGroup) {
    // 设置resourceScheme
    const titleContext = (group as EditorGroup).contextKeyService.createScoped();
    const resourceContext = new ResourceContextKey(titleContext);
    resourceContext.set(uri);

    const menus = this.menuService.createMenu(MenuId.EditorTitleContext, titleContext);
    const result = generateCtxMenu({ menus });
    menus.dispose();
    titleContext.dispose();

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      // 合并结果
      menuNodes: [...result[0], ...result[1]],
      context: [{uri, group}],
    });
  }

}

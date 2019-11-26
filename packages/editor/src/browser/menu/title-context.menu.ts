import { Injectable, Autowired } from '@ali/common-di';
import { AbstractMenuService, ICtxMenuRenderer, IMenu, MenuId, generateCtxMenu } from '@ali/ide-core-browser/lib/menu/next';
import { URI } from '@ali/ide-core-common';
import { IEditorGroup } from '../../common';

@Injectable()
export class TabTitleMenuService {

  @Autowired(AbstractMenuService)
  menuService: AbstractMenuService;

  @Autowired(ICtxMenuRenderer)
  ctxMenuRenderer: ICtxMenuRenderer;

  show(x: number, y: number, uri: URI, group: IEditorGroup) {
    const menus = this.menuService.createMenu(MenuId.EditorTitleContext);
    const result = generateCtxMenu({ menus });
    menus.dispose();

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      // 合并结果
      menuNodes: [...result[0], ...result[1]],
      context: [{uri, group}],
    });
  }

}

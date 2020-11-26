import { DebugStackFrame } from '@ali/ide-debug/lib/browser';
import { IContextKeyService } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';
import { AbstractContextMenuService, ICtxMenuRenderer, MenuId } from '@ali/ide-core-browser/lib/menu/next';

@Injectable()
export class DebugCallStackService {

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  private _contextMenuContextKeyService: IContextKeyService;

  public get contextMenuContextKeyService(): IContextKeyService {
    if (!this._contextMenuContextKeyService) {
      this._contextMenuContextKeyService = this.contextKeyService.createScoped();
    }
    return this._contextMenuContextKeyService;
  }

  public handleContextMenu = (event: React.MouseEvent<HTMLDivElement, MouseEvent>, data: DebugStackFrame): void => {
    event.stopPropagation();
    event.preventDefault();

    const { x, y } = event.nativeEvent;

    const menus = this.contextMenuService.createMenu({ id: MenuId.DebugCallStackContext, contextKeyService: this.contextMenuContextKeyService });
    const menuNodes = menus.getMergedMenuNodes();
    menus.dispose();

    const toArgs = () => {
      return [
        data.source ? data.source.uri.toString() : '',
        {
          sessionId: data.session.id,
          threadId: data.thread.id,
          frameId: data.raw.id,
        },
      ];
    };

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: toArgs(),
    });
  }

}

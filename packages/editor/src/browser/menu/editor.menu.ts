import { Injectable, Autowired } from '@ali/common-di';
import { IEditorActionRegistry } from '../types';
import { IDisposable, Disposable, IContextKeyService, ILogger } from '@ali/ide-core-browser';
import { IEditorGroup } from '../../common';
import { MenuId, IMenu, AbstractMenuService } from '@ali/ide-core-browser/lib/menu/next';
import { EditorGroup } from '../workbench-editor.service';

@Injectable()
export class EditorActionRegistryImpl extends Disposable implements IEditorActionRegistry {

  private _cachedMenus = new Map<string, IMenu>();

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  @Autowired(ILogger)
  logger: ILogger;

  registerEditorAction(): IDisposable {
    this.logger.warn(new Error('registerEditorAction has been deprecated, use menu apis instead'));
    return new Disposable();
  }

  getMenu(group: IEditorGroup): IMenu {
    const key = group.currentEditor ? ('editor-menu-' + group.currentEditor.getId()) : ('editor-group-menu-' + group.name);
    if (!this._cachedMenus.has(key)) {
      const contextKeyService = group.currentEditor ? this.contextKeyService.createScoped((group.currentEditor.monacoEditor as any)._contextKeyService) : (group as EditorGroup).contextKeyService;
      const menus = this.registerDispose(this.menuService.createMenu(MenuId.EditorTitle, contextKeyService));
      this._cachedMenus.set(key, menus);
      menus.onDispose(() => {
        if (this._cachedMenus.get(key) === menus) {
          this._cachedMenus.delete(key);
        }
      });
    }
    return this._cachedMenus.get(key)!;
  }

}

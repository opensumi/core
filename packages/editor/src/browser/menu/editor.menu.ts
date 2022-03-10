import { Injectable, Autowired } from '@opensumi/di';
import { IDisposable, Disposable, IContextKeyService, ILogger } from '@opensumi/ide-core-browser';
import { MenuId, IMenu, AbstractMenuService } from '@opensumi/ide-core-browser/lib/menu/next';

import { IEditorGroup } from '../../common';
import { IEditorActionRegistry } from '../types';
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
    const key = group.currentFocusedEditor
      ? 'editor-menu-' + group.currentFocusedEditor.getId()
      : 'editor-group-menu-' + group.name;
    if (!this._cachedMenus.has(key)) {
      const contextKeyService = group.currentFocusedEditor
        ? this.contextKeyService.createScoped((group.currentFocusedEditor.monacoEditor as any)._contextKeyService)
        : (group as EditorGroup).contextKeyService;
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

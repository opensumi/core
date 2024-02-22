import { Autowired, Injectable } from '@opensumi/di';
import { Disposable, IContextKeyService, IDisposable, ILogger } from '@opensumi/ide-core-browser';
import { AbstractContextMenuService, IContextMenu, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';

import { IEditorGroup } from '../../common';
import { IEditorActionRegistry } from '../types';
import { EditorGroup } from '../workbench-editor.service';

@Injectable()
export class EditorActionRegistryImpl extends Disposable implements IEditorActionRegistry {
  private _cachedMenus = new Map<string, IContextMenu>();

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @Autowired(AbstractContextMenuService)
  private readonly menuService: AbstractContextMenuService;

  @Autowired(ILogger)
  logger: ILogger;

  registerEditorAction(): IDisposable {
    this.logger.warn(new Error('registerEditorAction has been deprecated, use menu apis instead'));
    return new Disposable();
  }

  getMenu(group: IEditorGroup): IContextMenu {
    const key = group.currentFocusedEditor
      ? 'editor-menu-' + group.currentFocusedEditor.getId()
      : 'editor-group-menu-' + group.name;
    if (!this._cachedMenus.has(key)) {
      const contextKeyService = group.currentFocusedEditor
        ? this.contextKeyService.createScoped((group.currentFocusedEditor.monacoEditor as any)._contextKeyService)
        : (group as EditorGroup).contextKeyService;
      const menus = this.registerDispose(
        this.menuService.createMenu({
          id: MenuId.EditorTitle,
          contextKeyService,
        }),
      );
      this._cachedMenus.set(key, menus);
    }
    return this._cachedMenus.get(key)!;
  }
}

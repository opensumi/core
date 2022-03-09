import { Injectable, Autowired, Optional, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { IContextKeyService } from '@opensumi/ide-core-browser';
import { MenuId, AbstractContextMenuService, IContextMenu } from '@opensumi/ide-core-browser/lib/menu/next';
import { Disposable } from '@opensumi/ide-core-common/lib/disposable';
import { ISplice } from '@opensumi/ide-core-common/lib/sequence';

import {
  ISCMRepository,
  ISCMProvider,
  ISCMResource,
  ISCMResourceGroup,
  SCMService,
  ISCMRepositoryMenus,
  ISCMMenus,
} from '../common';

import { isSCMResource } from './scm-util';

@Injectable({ multiple: true })
class SCMResourceMenus extends Disposable {
  @Autowired(AbstractContextMenuService)
  private readonly menuService: AbstractContextMenuService;

  constructor(@Optional() private contextKeyService: IContextKeyService) {
    super();
  }

  private _resourceGroupMenu: IContextMenu | undefined;
  /**
   * 获得 SCMResourceGroup Item 的菜单
   */
  public get resourceGroupMenu(): IContextMenu {
    if (!this._resourceGroupMenu) {
      this._resourceGroupMenu = this.registerDispose(
        this.menuService.createMenu({
          id: MenuId.SCMResourceGroupContext,
          contextKeyService: this.contextKeyService,
          config: {
            separator: 'inline',
          },
        }),
      );
    }

    return this._resourceGroupMenu;
  }

  private _resourceFolderMenu: IContextMenu | undefined;
  /**
   * 获得 SCMResourceFolder Item 的菜单
   */
  public get resourceFolderMenu(): IContextMenu {
    if (!this._resourceFolderMenu) {
      this._resourceFolderMenu = this.registerDispose(
        this.menuService.createMenu({
          id: MenuId.SCMResourceFolderContext,
          contextKeyService: this.contextKeyService,
          config: {
            separator: 'inline',
          },
        }),
      );
    }

    return this._resourceFolderMenu;
  }

  // contextValue 为 undefined 的 SCMResource Menu
  // 不直接以 undefined 为 key 存入的原因是避免有 contextValue 就是 undefined 字符串
  private resourceMenu: IContextMenu | undefined;
  private contextualResourceMenu: Map<string /* contextValue 维度缓存 */, IContextMenu> | undefined;

  /**
   * 传入 resource 可以获得 SCMResource Item 的菜单
   */
  public getResourceMenu(resource: ISCMResource): IContextMenu {
    const contextValue = resource.contextValue;
    if (typeof contextValue === 'undefined') {
      if (!this.resourceMenu) {
        this.resourceMenu = this.registerDispose(
          this.menuService.createMenu({
            id: MenuId.SCMResourceContext,
            contextKeyService: this.contextKeyService,
            config: {
              separator: 'inline',
            },
          }),
        );
      }

      return this.resourceMenu;
    }

    if (!this.contextualResourceMenu) {
      this.contextualResourceMenu = new Map();
    }

    let item = this.contextualResourceMenu.get(contextValue);

    if (!item) {
      const contextKeyService = this.contextKeyService.createScoped();

      // 设置 scmResourceState
      if (isSCMResource(resource)) {
        contextKeyService.createKey('scmResourceState', contextValue);
      }

      item = this.registerDispose(
        this.menuService.createMenu({
          id: MenuId.SCMResourceContext,
          contextKeyService,
          config: {
            separator: 'inline',
          },
        }),
      );

      this.addDispose(contextKeyService);

      this.contextualResourceMenu.set(contextValue, item);
    }

    return item;
  }

  public dispose(): void {
    super.dispose();

    this.resourceGroupMenu?.dispose();
    this.resourceMenu?.dispose();

    if (this.contextualResourceMenu) {
      this.contextualResourceMenu.clear();
      this.contextualResourceMenu = undefined;
    }
  }
}

@Injectable({ multiple: true })
class SCMRepositoryMenus extends Disposable implements ISCMRepositoryMenus {
  @Autowired(AbstractContextMenuService)
  private readonly menuService: AbstractContextMenuService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  // internal scoped ctx key service
  private readonly scopedContextKeyService: IContextKeyService;

  constructor(@Optional() provider: ISCMProvider) {
    super();
    const globalContextKeyService: IContextKeyService = this.injector.get(IContextKeyService);
    this.scopedContextKeyService = this.registerDispose(globalContextKeyService.createScoped());
    this.scopedContextKeyService.createKey('scmProvider', provider.contextValue);
    this.scopedContextKeyService.createKey('scmProviderRootUri', provider.rootUri?.toString());
    this.scopedContextKeyService.createKey('scmProviderHasRootUri', !!provider.rootUri);

    this.onDidSpliceGroups({ start: 0, deleteCount: 0, toInsert: provider.groups.elements });
    provider.groups.onDidSplice(this.onDidSpliceGroups, this, this.disposables);
  }

  private readonly resourceGroups: ISCMResourceGroup[] = [];
  private onDidSpliceGroups({ start, deleteCount, toInsert }: ISplice<ISCMResourceGroup>): void {
    const deleted = this.resourceGroups.splice(start, deleteCount, ...toInsert);

    for (const group of deleted) {
      const item = this.resourceGroupMenusItems.get(group);
      item?.dispose();
      this.resourceGroupMenusItems.delete(group);
    }
  }

  public dispose(): void {
    super.dispose();
    this.resourceGroupMenusItems.forEach((item) => item.dispose());
  }

  public getResourceGroupMenu(group: ISCMResourceGroup): IContextMenu {
    return this.getResourceGroupMenus(group).resourceGroupMenu;
  }

  public getResourceMenu(resource: ISCMResource): IContextMenu {
    return this.getResourceGroupMenus(resource.resourceGroup).getResourceMenu(resource);
  }

  public getResourceFolderMenu(group: ISCMResourceGroup): IContextMenu {
    return this.getResourceGroupMenus(group).resourceFolderMenu;
  }

  private readonly resourceGroupMenusItems = new Map<ISCMResourceGroup, SCMResourceMenus>();
  private getResourceGroupMenus(group: ISCMResourceGroup) {
    let result = this.resourceGroupMenusItems.get(group);

    if (!result) {
      const scopedContextKeyService = this.registerDispose(this.scopedContextKeyService.createScoped());
      scopedContextKeyService.createKey('scmResourceGroup', group.id);

      result = this.registerDispose(this.injector.get(SCMResourceMenus, [scopedContextKeyService]));
      this.resourceGroupMenusItems.set(group, result);
    }

    return result;
  }

  /**
   * SCM Title 的 menu
   */
  private _titleMenu: IContextMenu;
  public get titleMenu(): IContextMenu {
    if (!this._titleMenu) {
      this._titleMenu = this.registerDispose(
        this.menuService.createMenu({
          id: MenuId.SCMTitle,
          contextKeyService: this.scopedContextKeyService,
        }),
      );
    }

    return this._titleMenu;
  }

  /**
   * SCM Input 的 menu
   */
  private _inputMenu: IContextMenu;
  public get inputMenu(): IContextMenu {
    if (!this._inputMenu) {
      this._inputMenu = this.registerDispose(
        this.menuService.createMenu({
          id: MenuId.SCMInput,
          contextKeyService: this.scopedContextKeyService,
        }),
      );
    }

    return this._inputMenu;
  }
}

@Injectable()
export class SCMMenus extends Disposable implements ISCMMenus {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(SCMService)
  private readonly scmService: SCMService;

  constructor() {
    super();
    this.scmService.onDidRemoveRepository(this.onDidRemoveRepository, this, this.disposables);
  }

  private readonly menus = new Map<ISCMProvider, { menus: SCMRepositoryMenus; dispose: () => void }>();

  private onDidRemoveRepository(repository: ISCMRepository): void {
    const menus = this.menus.get(repository.provider);
    menus?.dispose();
    this.menus.delete(repository.provider);
  }

  getRepositoryMenus(provider: ISCMProvider): SCMRepositoryMenus {
    let result = this.menus.get(provider);

    if (!result) {
      const menus = this.injector.get(SCMRepositoryMenus, [provider]);
      const dispose = () => {
        menus.dispose();
        this.menus.delete(provider);
      };

      result = { menus, dispose };
      this.menus.set(provider, result);
    }

    return result.menus;
  }
}

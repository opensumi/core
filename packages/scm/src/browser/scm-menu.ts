import { Injectable, Autowired, Optional } from '@ali/common-di';
import { Event, Emitter } from '@ali/ide-core-common/lib/event';
import { IDisposable, dispose, Disposable } from '@ali/ide-core-common/lib/disposable';
import { equals } from '@ali/ide-core-common/lib/utils/arrays';
import { ISplice } from '@ali/ide-core-common/lib/sequence';
import { IContextKeyService } from '@ali/ide-core-browser';
import { MenuId, MenuNode } from '@ali/ide-core-browser/lib/menu/next/base';
import { MenuService, IMenu } from '@ali/ide-core-browser/lib/menu/next/menu-service';
import { splitMenuItems, TupleMenuNodeResult } from '@ali/ide-core-browser/lib/menu/next/menu-util';

import { ISCMProvider, ISCMResource, ISCMResourceGroup } from '../common';
import { getSCMResourceContextKey } from './scm-util';

function actionEquals(a: MenuNode, b: MenuNode): boolean {
  return a.id === b.id;
}

interface ISCMResourceGroupMenuEntry extends IDisposable {
  readonly group: ISCMResourceGroup;
}

interface ISCMMenus {
  readonly resourceGroupMenu: IMenu;
  readonly resourceMenu: IMenu;
}

@Injectable()
export class SCMMenus implements IDisposable {
  private titleMenu: IMenu;

  private titleNavMenus: MenuNode[] = [];
  private titleMoreMenus: MenuNode[] = [];

  private readonly _onDidChangeTitle = new Emitter<void>();
  readonly onDidChangeTitle: Event<void> = this._onDidChangeTitle.event;

  private readonly resourceGroupMenuEntries: ISCMResourceGroupMenuEntry[] = [];
  private readonly resourceGroupMenus = new Map<ISCMResourceGroup, ISCMMenus>();

  private readonly disposables: IDisposable[] = [];

  @Autowired(MenuService)
  private readonly menuService: MenuService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  // internal scoped ctx key service
  private readonly scopedCtxKeyService: IContextKeyService;

  constructor(@Optional() provider?: ISCMProvider) {
    this.scopedCtxKeyService = this.contextKeyService.createScoped();
    const scmProviderKey = this.scopedCtxKeyService.createKey<string | undefined>('scmProvider', undefined);

    if (provider) {
      scmProviderKey.set(provider.contextValue);
      this.onDidSpliceGroups({ start: 0, deleteCount: 0, toInsert: provider.groups.elements });
      provider.groups.onDidSplice(this.onDidSpliceGroups, this, this.disposables);
    } else {
      scmProviderKey.set('');
    }

    this.titleMenu = this.menuService.createMenu(MenuId.SCMTitle, this.scopedCtxKeyService);
    this.disposables.push(this.titleMenu);

    this.titleMenu.onDidChange(this.updateTitleActions, this, this.disposables);
    this.updateTitleActions();
  }

  private updateTitleActions() {
    const groups = this.titleMenu.getMenuNodes();
    const [navMenuNodes, moreMenuNodes] = splitMenuItems(groups);

    if (equals(navMenuNodes, this.titleNavMenus, actionEquals) && equals(moreMenuNodes, this.titleMoreMenus, actionEquals)) {
      return;
    }

    this.titleNavMenus = navMenuNodes;
    this.titleMoreMenus = moreMenuNodes;

    this._onDidChangeTitle.fire();

    return [navMenuNodes, moreMenuNodes];
  }

  getTitleNavActions(): MenuNode[] {
    return this.titleNavMenus;
  }

  getTitleMoreActions(): MenuNode[] {
    return this.titleMoreMenus;
  }

  /**
   * scm resource group 中的 ctx-menu
   */
  getResourceGroupContextActions(group: ISCMResourceGroup): MenuNode[] {
    return this.getCtxMenuNodes(MenuId.SCMResourceGroupContext, group)[1];
  }

  /**
   * scm resource 中的 ctx-menu
   */
  getResourceContextActions(resource: ISCMResource): MenuNode[] {
    return this.getCtxMenuNodes(MenuId.SCMResourceContext, resource)[1];
  }

  /**
   * 获取 scm 文件列表中的 ctx-menu
   */
  private getCtxMenuNodes(menuId: MenuId, resource: ISCMResourceGroup | ISCMResource): TupleMenuNodeResult {
    const contextKeyService = this.scopedCtxKeyService.createScoped();
    contextKeyService.createKey('scmResourceGroup', getSCMResourceContextKey(resource));

    const menu = this.menuService.createMenu(menuId, contextKeyService);
    const groups = menu.getMenuNodes();
    const result = splitMenuItems(groups, 'inline');

    menu.dispose();
    contextKeyService.dispose();

    return result;
  }

  /**
   * 获取 resource group 的 inline actions
   */
  getResourceGroupInlineActions(group: ISCMResourceGroup): IMenu {
    if (!this.resourceGroupMenus.has(group)) {
      throw new Error('SCM Resource Group menu not found');
    }

    return this.resourceGroupMenus.get(group)!.resourceGroupMenu;
  }

  /**
   * 获取 resource 的 inline actions
   */
  getResourceInlineActions(group: ISCMResourceGroup): IMenu {
    if (!this.resourceGroupMenus.has(group)) {
      throw new Error('SCM Resource Group menu not found');
    }

    return this.resourceGroupMenus.get(group)!.resourceMenu;
  }

  // 监听 scm group 的 slice 事件并创建 resource 和 group 的 inline actions
  private onDidSpliceGroups({ start, deleteCount, toInsert }: ISplice<ISCMResourceGroup>): void {
    const menuEntriesToInsert = toInsert.map<ISCMResourceGroupMenuEntry>((group) => {
      const contextKeyService = this.scopedCtxKeyService.createScoped();
      contextKeyService.createKey('scmProvider', group.provider.contextValue);
      contextKeyService.createKey('scmResourceGroup', getSCMResourceContextKey(group));

      const resourceGroupMenu = this.menuService.createMenu(MenuId.SCMResourceGroupContext, contextKeyService);
      const resourceMenu = this.menuService.createMenu(MenuId.SCMResourceContext, contextKeyService);

      this.resourceGroupMenus.set(group, { resourceGroupMenu, resourceMenu });

      return {
        group,
        dispose() {
          contextKeyService.dispose();
          resourceGroupMenu.dispose();
          resourceMenu.dispose();
        },
      };
    });

    const deleted = this.resourceGroupMenuEntries.splice(start, deleteCount, ...menuEntriesToInsert);

    for (const entry of deleted) {
      this.resourceGroupMenus.delete(entry.group);
      entry.dispose();
    }
  }

  dispose(): void {
    dispose(this.disposables);
    dispose(this.resourceGroupMenuEntries);
    this.resourceGroupMenus.clear();
  }
}

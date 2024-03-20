import { Autowired, Injectable } from '@opensumi/di';
import { ComponentContribution, ComponentRegistry, Disposable, Domain } from '@opensumi/ide-core-browser';
import { IMenuRegistry, IMenubarItem, ISubmenuItem, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { MenubarStore } from '@opensumi/ide-menu-bar/lib/browser/menu-bar.store';

import { AI_MENUBAR_CONTAINER_VIEW_ID } from '../../../common';

import { AIMenuBarView } from './menu-bar.view';

@Injectable()
@Domain(ComponentContribution)
export class AIMenuBarContribution extends Disposable implements ComponentContribution {
  @Autowired(MenubarStore)
  private readonly menubarStore: MenubarStore;

  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  constructor() {
    super();

    this.menubarStore.unregisterMenusBarByCompact(MenuId.AIMenuBarTopExtra);

    this.addDispose(
      this.menubarStore.onDidMenuBarChange((menubarItems: IMenubarItem[]) => {
        this.menuRegistry.registerMenuItems(
          MenuId.AIMenuBarTopExtra,
          menubarItems.map(
            (item: IMenubarItem) =>
              ({
                label: item.label,
                submenu: item.id,
                iconClass: item.iconClass,
                group: '1_navigation',
                order: 100,
              } as ISubmenuItem),
          ),
        );
      }),
    );
  }

  registerComponent(registry: ComponentRegistry): void {
    registry.register(AI_MENUBAR_CONTAINER_VIEW_ID, {
      component: AIMenuBarView,
      id: AI_MENUBAR_CONTAINER_VIEW_ID,
    });
  }
}

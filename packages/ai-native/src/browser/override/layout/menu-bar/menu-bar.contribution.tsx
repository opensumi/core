import { Injectable, Autowired } from '@opensumi/di';
import { ComponentContribution, ComponentRegistry, Disposable, Domain } from '@opensumi/ide-core-browser';
import { IMenuRegistry, IMenubarItem, ISubmenuItem, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { MenubarStore } from '@opensumi/ide-menu-bar/lib/browser/menu-bar.store';

import { Ai_MENUBAR_CONTAINER_VIEW_ID } from '../../../../common';

import { AiMenuBarView } from './menu-bar.view';

@Injectable()
@Domain(ComponentContribution)
export class AiMenuBarContribution extends Disposable implements ComponentContribution {
  @Autowired(MenubarStore)
  private readonly menubarStore: MenubarStore;

  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  constructor() {
    super();

    this.menubarStore.unregisterMenusBarByCompact(MenuId.AiMenuBarTopExtra);

    this.addDispose(
      this.menubarStore.onDidMenuBarChange((menubarItems: IMenubarItem[]) => {
        this.menuRegistry.registerMenuItems(
          MenuId.AiMenuBarTopExtra,
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
    registry.register(Ai_MENUBAR_CONTAINER_VIEW_ID, {
      component: AiMenuBarView,
      id: Ai_MENUBAR_CONTAINER_VIEW_ID,
    });
  }
}

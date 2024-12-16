import { Autowired } from '@opensumi/di';
import { ComponentContribution, ComponentRegistry, Disposable, Domain, IDisposable } from '@opensumi/ide-core-browser';
import { IMenuRegistry, IMenubarItem, ISubmenuItem, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { MenubarStore } from '@opensumi/ide-menu-bar/lib/browser/menu-bar.store';

import { DESIGN_MENUBAR_CONTAINER_VIEW_ID } from '../../common';

import { DesignMenuBarView } from './menu-bar.view';

@Domain(ComponentContribution)
export class DesignMenuBarContribution extends Disposable implements ComponentContribution {
  @Autowired(MenubarStore)
  private readonly menubarStore: MenubarStore;

  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  constructor() {
    super();

    this.menubarStore.unregisterMenusBarByCompact(MenuId.DesignMenuBarTopExtra);

    let toDispose: IDisposable | undefined;

    this.addDispose(
      this.menubarStore.onDidMenuBarChange((menubarItems: IMenubarItem[]) => {
        if (toDispose) {
          toDispose.dispose();
        }

        toDispose = this.menuRegistry.registerMenuItems(
          MenuId.DesignMenuBarTopExtra,
          menubarItems.map(
            (item: IMenubarItem) =>
              ({
                label: item.label,
                submenu: item.id,
                iconClass: item.iconClass,
                group: item.group || '1_navigation',
                order: item.order ?? 100,
              } as ISubmenuItem),
          ),
        );
      }),
    );
  }

  registerComponent(registry: ComponentRegistry): void {
    registry.register(DESIGN_MENUBAR_CONTAINER_VIEW_ID, {
      component: DesignMenuBarView,
      id: DESIGN_MENUBAR_CONTAINER_VIEW_ID,
    });
  }
}

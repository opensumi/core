import { Autowired } from '@opensumi/di';
import { Disposable, MenubarSettingId, PreferenceService, getExternalIcon } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';
import { IMenuRegistry, IMenubarItem, ISubmenuItem, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';

import { MenubarStore } from './menu-bar.store';
import { MenuBarMixToolbarAction } from './menu-bar.view';

@Domain(ComponentContribution)
export class MenuBarContribution extends Disposable implements ComponentContribution {
  @Autowired(MenubarStore)
  private readonly menubarStore: MenubarStore;

  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  constructor() {
    super();

    this.addDispose(
      this.menubarStore.onDidMenuBarChange((menubarItems: IMenubarItem[]) => {
        const isCompact = this.preferenceService.getValid<boolean>(MenubarSettingId.CompactMode);

        if (isCompact) {
          this.registerMenusBarByCompact(menubarItems);
        }
      }),
    );

    this.addDispose(
      this.preferenceService.onSpecificPreferenceChange(MenubarSettingId.CompactMode, ({ newValue }) => {
        if (newValue) {
          this.registerMenusBarByCompact();
        } else {
          this.unregisterMenusBarByCompact();
        }
      }),
    );
  }

  private unregisterMenusBarByCompact() {
    const preMenu = this.menuRegistry.getMenuItems(MenuId.MenubarCompactMenu) as ISubmenuItem[];
    preMenu.forEach((c) => {
      this.menuRegistry.unregisterMenuItem(MenuId.MenubarCompactMenu, c.submenu);
    });

    this.menuRegistry.unregisterMenuItem(MenuId.ActivityBarTopExtra, MenuId.MenubarCompactMenu);
  }

  private registerMenusBarByCompact(menubarItems: IMenubarItem[] = this.menubarStore.menubarItems) {
    this.menuRegistry.registerMenuItem(MenuId.ActivityBarTopExtra, {
      submenu: MenuId.MenubarCompactMenu,
      iconClass: getExternalIcon('menu'),
      order: 1,
      group: 'navigation',
    });

    this.menuRegistry.registerMenuItems(
      MenuId.MenubarCompactMenu,
      menubarItems.map(
        (item: IMenubarItem) =>
          ({
            label: item.label,
            submenu: item.id,
          } as ISubmenuItem),
      ),
    );
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register(
      '@opensumi/ide-menu-bar',
      {
        id: 'ide-menu-bar',
        component: MenuBarMixToolbarAction,
      },
      {
        size: 27,
      },
    );
  }
}

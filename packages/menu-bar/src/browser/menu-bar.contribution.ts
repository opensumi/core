import { Autowired } from '@opensumi/di';
import {
  ToolBarActionContribution,
  AppConfig,
  IToolbarRegistry,
  getExternalIcon,
  Disposable,
  PreferenceService,
  MenubarSettingId,
} from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';
import {
  IMenuRegistry,
  IMenubarItem,
  ISubmenuItem,
  MenuContribution,
  MenuId,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';

import { MenubarStore } from './menu-bar.store';
import { MenuBarMixToolbarAction } from './menu-bar.view';
import { ToolbarAction } from './toolbar-action.view';

@Domain(ComponentContribution, ToolBarActionContribution)
export class MenuBarContribution extends Disposable implements ComponentContribution, ToolBarActionContribution {
  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

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

    if (!this.appConfig.isElectronRenderer) {
      registry.register('@opensumi/ide-toolbar-action', {
        id: 'ide-toolbar-action',
        component: ToolbarAction,
      });
    }
  }

  registerToolbarActions(registry: IToolbarRegistry) {
    if (!this.appConfig.isElectronRenderer) {
      registry.addLocation('menu-right');
      registry.addLocation('menu-left');
    }
  }
}

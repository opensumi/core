import { Autowired } from '@opensumi/di';
import { getExternalIcon, Disposable, PreferenceService, MenubarSettingId } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';
import { IMenuRegistry, IMenubarItem, ISubmenuItem, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';

import { MenubarStore } from './menu-bar.store';
import { MenuBarMixToolbarAction } from './menu-bar.view';

@Domain(ComponentContribution)
export class MenuBarContribution extends Disposable implements ComponentContribution {
  @Autowired(MenubarStore)
  private readonly menubarStore: MenubarStore;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  constructor() {
    super();

    this.addDispose(
      this.menubarStore.onDidMenuBarChange((menubarItems: IMenubarItem[]) => {
        const isCompact = this.preferenceService.getValid<boolean>(MenubarSettingId.CompactMode);

        if (isCompact) {
          this.menubarStore.registerMenusBarByCompact(menubarItems);
        }
      }),
    );

    this.addDispose(
      this.preferenceService.onSpecificPreferenceChange(MenubarSettingId.CompactMode, ({ newValue }) => {
        if (newValue) {
          this.menubarStore.registerMenusBarByCompact();
        } else {
          this.menubarStore.unregisterMenusBarByCompact();
        }
      }),
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

import { Injectable, Autowired } from '@opensumi/di';
import {
  ComponentContribution,
  ComponentRegistry,
  Disposable,
  Domain,
  MenubarSettingId,
  PreferenceService,
} from '@opensumi/ide-core-browser';
import { IMenuRegistry, IMenubarItem, ISubmenuItem, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { MenubarStore } from '@opensumi/ide-menu-bar/lib/browser/menu-bar.store';

import { AiMenuBarView } from './menu-bar.view';

@Injectable()
@Domain(ComponentContribution)
export class AiMenuBarContribution extends Disposable implements ComponentContribution {
  static AiMenuBarContainer = 'ai-menubar';

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
    registry.register(AiMenuBarContribution.AiMenuBarContainer, {
      component: AiMenuBarView,
      id: AiMenuBarContribution.AiMenuBarContainer,
    });
  }
}

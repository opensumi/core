import { Injectable, Autowired } from '@opensumi/di';
import {
  ComponentContribution,
  ComponentRegistry,
  Disposable,
  Domain,
  MenubarSettingId,
  PreferenceService,
  getExternalIcon,
} from '@opensumi/ide-core-browser';
import { IMenuRegistry, IMenubarItem, MenuContribution, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { MenubarStore } from '@opensumi/ide-menu-bar/lib/browser/menu-bar.store';

import { AiMenuBarView } from './menu-bar.view';

@Injectable()
@Domain(ComponentContribution, MenuContribution)
export class AiMenuBarContribution extends Disposable implements ComponentContribution, MenuContribution {
  static AiMenuBarContainer = 'ai-menubar';

  @Autowired(MenubarStore)
  private readonly menubarStore: MenubarStore;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  constructor() {
    super();

    this.addDispose(
      this.menubarStore.onDidMenuBarChange((menubarItems: IMenubarItem[]) => {
        const isCompact = this.preferenceService.getValid<boolean>(MenubarSettingId.CompactMode);

        if (!isCompact) {
          this.menubarStore.registerMenusBarByCompact(menubarItems);
        }
      }),
    );
  }

  registerComponent(registry: ComponentRegistry): void {
    registry.register(AiMenuBarContribution.AiMenuBarContainer, {
      component: AiMenuBarView,
      id: AiMenuBarContribution.AiMenuBarContainer,
    });
  }

  registerMenus(menus: IMenuRegistry): void {
    menus.registerMenuItems(MenuId.IconMenubarContext, [
      {
        command: 'main-layout.left-panel.toggle',
        iconClass: getExternalIcon('layout-sidebar-left-off'),
      },
    ]);
  }
}

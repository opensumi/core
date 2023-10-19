import { Injectable, Autowired } from '@opensumi/di';
import {
  ComponentContribution,
  ComponentRegistry,
  Disposable,
  Domain,
  MenubarSettingId,
  PreferenceService,
} from '@opensumi/ide-core-browser';
import { IMenubarItem } from '@opensumi/ide-core-browser/lib/menu/next';
import { MenubarStore } from '@opensumi/ide-menu-bar/lib/browser/menu-bar.store';

import { AiMenuBarView } from './menu-bar.view';

@Injectable()
@Domain(ComponentContribution)
export class AiMenuBarContribution extends Disposable implements ComponentContribution {
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
}
